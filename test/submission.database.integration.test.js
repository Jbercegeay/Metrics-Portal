const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { createDatabase } = require('../db');
const { createSubmissionRepository } = require('../repositories/submission-repository');
const { createSubmissionService } = require('../services/submissions/submission-service');
const { ConflictError } = require('../services/submissions/validation');

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (process.env.REQUIRE_DATABASE_TESTS === 'true' && !databaseUrl) {
    throw new Error('TEST_DATABASE_URL or DATABASE_URL is required when REQUIRE_DATABASE_TESTS=true.');
}

function database() {
    return createDatabase({
        enabled: true, required: true, url: databaseUrl, poolMax: 5,
        connectionTimeoutMs: 5000, statementTimeoutMs: 15000, ssl: false
    }, { error() {} });
}

function submission(id, payload = { 'Entry Type': 'Job', Item: '123456' }) {
    return {
        id,
        department: 'PL',
        associateName: 'Database Test Associate',
        entryType: 'job',
        workDate: '2026-06-19',
        kioskId: 'database-test-kiosk',
        payload
    };
}

test('database enforces atomic idempotency and one worker lease', { skip: !databaseUrl }, async () => {
    const db = database();
    const repository = createSubmissionRepository(db);
    const service = createSubmissionService(repository);
    const id = crypto.randomUUID();
    try {
        const results = await Promise.all([
            service.create(submission(id)),
            service.create(submission(id)),
            service.create(submission(id))
        ]);
        assert.equal(results.filter((result) => result.created).length, 1);
        assert.equal(results.filter((result) => result.duplicate).length, 2);

        const counts = await db.query(`
            SELECT
                (SELECT count(*) FROM submissions WHERE id = $1::uuid)::integer AS submissions,
                (SELECT count(*) FROM submission_outbox WHERE submission_id = $1::uuid)::integer AS outbox,
                (SELECT count(*) FROM audit_events WHERE entity_id = $1::text AND action = 'submission.created')::integer AS audits
        `, [id]);
        assert.deepEqual(counts.rows[0], { submissions: 1, outbox: 1, audits: 1 });

        await assert.rejects(() => service.create(submission(id, { Item: '654321' })), ConflictError);

        const claims = await Promise.all([
            repository.claimNext('worker-a', 60000),
            repository.claimNext('worker-b', 60000)
        ]);
        const claimed = claims.filter(Boolean);
        assert.equal(claimed.length, 1);
        await db.query(`
            UPDATE submission_outbox
            SET lease_expires_at = current_timestamp - interval '1 second'
            WHERE submission_id = $1
        `, [id]);
        const recovered = await repository.claimNext('worker-after-restart', 60000);
        assert.ok(recovered);
        assert.equal(recovered.submission_id, id);
        assert.equal(Number(recovered.attempt_count), 2);
        await repository.completeFailure(recovered, {
            terminal: true,
            nextAttemptAt: new Date(),
            code: 'TEST_COMPLETE',
            message: 'Database integration cleanup.'
        });

        const stored = await service.getById(id);
        assert.equal(stored.syncStatus, 'needs_review');
        assert.equal(stored.retryCount, 1);
    } finally {
        await db.query('DELETE FROM audit_events WHERE entity_id = $1', [id]);
        await db.query('DELETE FROM submission_deliveries WHERE submission_id = $1', [id]);
        await db.query('DELETE FROM submission_outbox WHERE submission_id = $1', [id]);
        await db.query('DELETE FROM submissions WHERE id = $1', [id]);
        await db.close();
    }
});
