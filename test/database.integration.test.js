const test = require('node:test');
const assert = require('node:assert/strict');
const { createDatabase } = require('../db');

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (process.env.REQUIRE_DATABASE_TESTS === 'true' && !databaseUrl) {
    throw new Error('TEST_DATABASE_URL or DATABASE_URL is required when REQUIRE_DATABASE_TESTS=true.');
}

test('migrated PostgreSQL foundation is ready and transactions roll back', { skip: !databaseUrl }, async () => {
    const messages = [];
    const logger = { error(value, message) { messages.push({ value, message }); } };
    const database = createDatabase({
        enabled: true,
        required: true,
        url: databaseUrl,
        poolMax: 2,
        connectionTimeoutMs: 5000,
        statementTimeoutMs: 15000,
        ssl: false
    }, logger);

    try {
        const readiness = await database.checkReadiness();
        assert.equal(readiness.ok, true);

        await assert.rejects(
            database.withTransaction(async (client) => {
                await client.query(
                    `INSERT INTO app_metadata (key, value) VALUES ($1, $2::jsonb)`,
                    ['rollback-check', '{}']
                );
                throw new Error('force rollback');
            }),
            /force rollback/
        );

        const result = await database.query('SELECT key FROM app_metadata WHERE key = $1', ['rollback-check']);
        assert.equal(result.rowCount, 0);
        assert.deepEqual(messages, []);
    } finally {
        await database.close();
    }
});
