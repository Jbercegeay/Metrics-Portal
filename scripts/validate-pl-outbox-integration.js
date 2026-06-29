require('dotenv').config({ quiet: true });

const crypto = require('crypto');
const { createDatabase } = require('../db');
const { getClientForDept, getRequiredEnv } = require('../lib/smartsheet');
const { createSubmissionRepository } = require('../repositories/submission-repository');
const { createSmartsheetDeliveryAdapter } = require('../services/smartsheet/delivery-adapter');
const { createOutboxWorker } = require('../services/submissions/outbox-worker');
const { createSubmissionService } = require('../services/submissions/submission-service');

const CONFIRMATION = 'VALIDATE PL DATABASE OUTBOX';

function getArgument(name) {
    const prefix = `${name}=`;
    const argument = process.argv.slice(2).find((value) => value.startsWith(prefix));
    return argument ? argument.slice(prefix.length) : null;
}

function quietLogger() {
    const write = () => {};
    return { debug: write, info: write, warn: write, error: write, fatal: write };
}

async function main() {
    if (getArgument('--confirmation') !== CONFIRMATION) {
        throw new Error(`Validation requires --confirmation="${CONFIRMATION}".`);
    }
    const databaseUrl = process.env.DATABASE_URL;
    const sheetId = process.env.PL_INTEGRATION_SHEET_ID;
    if (!databaseUrl) throw new Error('DATABASE_URL is required.');
    if (!sheetId) throw new Error('PL_INTEGRATION_SHEET_ID is required.');
    if (sheetId === getRequiredEnv('DEPT_PL_MASTER_LOG_SHEET_ID')) {
        throw new Error('Outbox validation refuses the production PL master log.');
    }

    const logger = quietLogger();
    const database = createDatabase({
        enabled: true,
        required: true,
        url: databaseUrl,
        poolMax: 2,
        connectionTimeoutMs: 5000,
        statementTimeoutMs: 15000,
        ssl: false
    }, logger);
    const client = getClientForDept('PL');
    const repository = createSubmissionRepository(database);
    const submissionService = createSubmissionService(repository);
    const deliveryAdapter = createSmartsheetDeliveryAdapter({
        getClientForDept: () => client,
        getRequiredEnv: (name) => {
            if (name === 'DEPT_PL_MASTER_LOG_SHEET_ID') return sheetId;
            return getRequiredEnv(name);
        }
    });
    const worker = createOutboxWorker({
        repository,
        deliveryAdapter,
        logger,
        workerId: `integration:${crypto.randomUUID()}`,
        leaseMs: 60000,
        maxAttempts: 1,
        baseBackoffMs: 100,
        maximumBackoffMs: 1000,
        random: () => 0.5
    });
    const submissionId = crypto.randomUUID();
    let remoteRowId = null;
    let databaseCreated = false;

    try {
        const existing = await database.query(`
            SELECT count(*)::integer AS count
            FROM submission_outbox
            WHERE state IN ('pending', 'processing')
        `);
        if (existing.rows[0].count !== 0) {
            throw new Error('Outbox is not empty; refusing a non-isolated worker validation.');
        }

        await submissionService.create({
            id: submissionId,
            department: 'PL',
            entryType: 'job',
            associateName: 'METRICS PORTAL INTEGRATION TEST',
            workDate: new Date().toISOString().slice(0, 10),
            kioskId: 'INTEGRATION-TEST',
            payload: {
                Sequence: 'INTEGRATION TEST',
                'Lot Number': `TEST-${submissionId.slice(0, 8)}`,
                Item: '000000',
                'Time worked (Min)': 1,
                Notes: 'Synthetic database/outbox validation',
                'Start Quantity': 1,
                'End Quantity': 1
            }
        }, {
            name: 'METRICS PORTAL INTEGRATION TEST',
            role: 'Technical validation',
            workstation: 'INTEGRATION-TEST'
        });
        databaseCreated = true;

        const result = await worker.processOnce();
        if (!result.processed || !result.success || !result.result?.remoteRowId) {
            throw new Error('One-shot outbox worker did not complete the synthetic delivery.');
        }
        remoteRowId = result.result.remoteRowId;

        const evidence = await database.query(`
            SELECT s.sync_status, s.remote_row_id, o.state AS outbox_state,
                   o.attempt_count, d.result AS delivery_result
            FROM submissions s
            JOIN submission_outbox o ON o.submission_id = s.id
            JOIN submission_deliveries d ON d.submission_id = s.id
            WHERE s.id = $1
        `, [submissionId]);
        const row = evidence.rows[0];
        if (!row || row.sync_status !== 'submitted' || row.outbox_state !== 'submitted' ||
            row.delivery_result !== 'submitted' || Number(row.attempt_count) !== 1 ||
            String(row.remote_row_id) !== String(remoteRowId)) {
            throw new Error('Database, outbox, and delivery evidence did not converge to submitted.');
        }

        const idle = await worker.processOnce();
        if (idle.processed) throw new Error('Worker processed unexpected additional outbox work.');

        console.log('PL database/outbox integration validation');
        console.log('  Database capture: committed');
        console.log('  Outbox attempts: 1');
        console.log('  Delivery state: submitted');
        console.log('  Remote row linked: yes');
        console.log('  Unexpected pending work: no');
        console.log('  Result: READY');
    } finally {
        const cleanupErrors = [];
        if (remoteRowId) {
            try {
                await client.delete(`sheets/${sheetId}/rows`, {
                    params: { ids: remoteRowId, ignoreRowsNotFound: true }
                });
                console.log('  Test Smartsheet rows removed: 1');
            } catch (error) {
                cleanupErrors.push(`Smartsheet row cleanup: ${error.response?.data?.message || error.message}`);
            }
        }
        if (databaseCreated) {
            try {
                await database.withTransaction(async (transaction) => {
                    await transaction.query(
                        "DELETE FROM audit_events WHERE entity_type = 'submission' AND entity_id = $1",
                        [submissionId]
                    );
                    await transaction.query('DELETE FROM submission_deliveries WHERE submission_id = $1', [submissionId]);
                    await transaction.query('DELETE FROM submission_outbox WHERE submission_id = $1', [submissionId]);
                    await transaction.query('DELETE FROM submissions WHERE id = $1', [submissionId]);
                });
                console.log('  Test database rows removed: yes');
            } catch (error) {
                cleanupErrors.push(`database cleanup: ${error.message}`);
            }
        }
        try {
            await database.close();
        } catch (error) {
            cleanupErrors.push(`database close: ${error.message}`);
        }
        if (cleanupErrors.length) {
            throw new Error(`Validation cleanup failed; ${cleanupErrors.join('; ')}`);
        }
    }
}

main().catch((error) => {
    console.error(`PL outbox integration failed: ${error.response?.data?.message || error.message}`);
    process.exitCode = 1;
});
