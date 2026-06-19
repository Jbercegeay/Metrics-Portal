const { Pool } = require('pg');

const EXPECTED_FOUNDATION_TABLE = 'app_metadata';

function createDatabase(config, logger) {
    if (!config.enabled) {
        return {
            enabled: false,
            required: config.required,
            async checkReadiness() {
                return { ok: !config.required, status: 'disabled' };
            },
            async close() {}
        };
    }

    const pool = new Pool({
        connectionString: config.url,
        max: config.poolMax,
        connectionTimeoutMillis: config.connectionTimeoutMs,
        statement_timeout: config.statementTimeoutMs,
        application_name: 'metrics-portal',
        ssl: config.ssl
    });

    pool.on('error', (error) => {
        logger.error({ err: error }, 'unexpected idle database client error');
    });

    return {
        enabled: true,
        required: config.required,
        pool,
        query(text, values) {
            return pool.query(text, values);
        },
        async withTransaction(callback) {
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                const result = await callback(client);
                await client.query('COMMIT');
                return result;
            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }
        },
        async checkReadiness() {
            const startedAt = Date.now();
            try {
                const result = await pool.query(
                    `SELECT EXISTS (
                        SELECT 1
                        FROM information_schema.tables
                        WHERE table_schema = 'public' AND table_name = $1
                    ) AS migration_ready`,
                    [EXPECTED_FOUNDATION_TABLE]
                );
                const migrationReady = result.rows[0]?.migration_ready === true;
                return {
                    ok: migrationReady,
                    status: migrationReady ? 'ready' : 'migration_required',
                    latencyMs: Date.now() - startedAt
                };
            } catch (error) {
                logger.error({ err: error }, 'database readiness check failed');
                return {
                    ok: false,
                    status: 'unavailable',
                    latencyMs: Date.now() - startedAt
                };
            }
        },
        async close() {
            await pool.end();
        }
    };
}

module.exports = {
    createDatabase,
    EXPECTED_FOUNDATION_TABLE
};
