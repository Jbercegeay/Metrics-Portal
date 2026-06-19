require('dotenv').config({ quiet: true });

const crypto = require('crypto');
const { getClientForDept, getRequiredEnv } = require('../lib/smartsheet');
const { createSmartsheetDeliveryAdapter } = require('../services/smartsheet/delivery-adapter');

const CONFIRMATION = 'WRITE AND DELETE PL INTEGRATION ROW';

function getArgument(name) {
    const prefix = `${name}=`;
    const argument = process.argv.slice(2).find((value) => value.startsWith(prefix));
    return argument ? argument.slice(prefix.length) : null;
}

function sleep(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForExactSearch(client, sheetId, submissionId, expectedRowId, attempts = 120) {
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        const response = await client.get(`search/sheets/${sheetId}`, {
            params: { query: `"${submissionId}"`, scopes: 'cellData' }
        });
        const found = (response.data.results || []).some((result) =>
            result.objectType === 'row' && String(result.objectId) === expectedRowId
        );
        if (found) return attempt;
        if (attempt % 12 === 0) {
            console.log(`  Exact-ID search indexing pending: ${attempt * 5} seconds`);
        }
        if (attempt < attempts) await sleep(5000);
    }
    throw new Error('Created test row did not become searchable within 10 minutes.');
}

async function main() {
    const confirmation = getArgument('--confirmation');
    if (confirmation !== CONFIRMATION) {
        throw new Error(`Validation requires --confirmation="${CONFIRMATION}".`);
    }

    const sheetId = process.env.PL_INTEGRATION_SHEET_ID;
    if (!sheetId) throw new Error('PL_INTEGRATION_SHEET_ID is required.');
    if (sheetId === getRequiredEnv('DEPT_PL_MASTER_LOG_SHEET_ID')) {
        throw new Error('Integration validation refuses the production PL master log.');
    }

    const client = getClientForDept('PL');
    const submissionId = crypto.randomUUID();
    const payload = {
        'Entry Type': 'Job',
        'Work Date': new Date().toISOString().slice(0, 10),
        'Associate Name': 'METRICS PORTAL INTEGRATION TEST',
        'Sequence': 'INTEGRATION TEST',
        'Lot Number': `TEST-${submissionId.slice(0, 8)}`,
        'Item': '000000',
        'Time worked (Min)': 1,
        'Notes': 'Automated non-production delivery validation',
        'Start Quantity': 1,
        'End Quantity': 1
    };
    const claim = {
        destination: 'smartsheet:PL:master_log',
        submission_id: submissionId,
        payload
    };
    const adapter = createSmartsheetDeliveryAdapter({
        getClientForDept: () => client,
        getRequiredEnv: (name) => {
            if (name === 'DEPT_PL_MASTER_LOG_SHEET_ID') return sheetId;
            return getRequiredEnv(name);
        }
    });
    const createdRowIds = [];

    try {
        const first = await adapter.deliver(claim);
        if (first.alreadyExists || !first.remoteRowId) {
            throw new Error('Initial delivery did not create exactly one identifiable row.');
        }
        createdRowIds.push(first.remoteRowId);

        const searchAttempts = await waitForExactSearch(
            client,
            sheetId,
            submissionId,
            first.remoteRowId
        );
        const replay = await adapter.deliver(claim);
        if (!replay.alreadyExists || replay.remoteRowId !== first.remoteRowId) {
            if (replay.remoteRowId && replay.remoteRowId !== first.remoteRowId) {
                createdRowIds.push(replay.remoteRowId);
            }
            throw new Error('Replay did not resolve to the original exact Submission ID row.');
        }

        const [columnsResponse, rowResponse] = await Promise.all([
            client.get(`sheets/${sheetId}/columns`),
            client.get(`sheets/${sheetId}/rows/${first.remoteRowId}`)
        ]);
        const columns = columnsResponse.data.data || columnsResponse.data.columns || [];
        const titleById = new Map(columns.map((column) => [String(column.id), column.title]));
        const values = new Map((rowResponse.data.cells || []).map((cell) => [
            titleById.get(String(cell.columnId)),
            cell.value
        ]));
        for (const [title, expected] of Object.entries({ 'Submission ID': submissionId, ...payload })) {
            if (String(values.get(title) ?? '') !== String(expected)) {
                throw new Error(`Mapped value mismatch for ${title}.`);
            }
        }

        console.log('PL controlled integration delivery');
        console.log('  Destination: non-production sheet');
        console.log('  Initial rows created: 1');
        console.log(`  Exact-ID search attempts: ${searchAttempts}`);
        console.log('  Replay inserted another row: no');
        console.log(`  Mapped fields verified: ${Object.keys(payload).length + 1}`);
        console.log('  Result: READY');
    } finally {
        if (createdRowIds.length) {
            await client.delete(`sheets/${sheetId}/rows`, {
                params: {
                    ids: [...new Set(createdRowIds)].join(','),
                    ignoreRowsNotFound: true
                }
            });
            console.log(`  Test rows removed: ${[...new Set(createdRowIds)].length}`);
        }
    }
}

main().catch((error) => {
    console.error(`PL integration delivery failed: ${error.response?.data?.message || error.message}`);
    process.exitCode = 1;
});
