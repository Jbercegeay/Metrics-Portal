const path = require('path');

function parseBoolean(value, fallback = false) {
    if (value === undefined || value === null || String(value).trim() === '') return fallback;
    const normalized = String(value).trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    throw new Error(`Expected a boolean value but received "${value}".`);
}

function parseInteger(value, fallback, options = {}) {
    if (value === undefined || value === null || String(value).trim() === '') return fallback;
    const parsed = Number(value);
    const minimum = options.minimum ?? Number.MIN_SAFE_INTEGER;
    const maximum = options.maximum ?? Number.MAX_SAFE_INTEGER;
    if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
        throw new Error(`Expected an integer between ${minimum} and ${maximum} but received "${value}".`);
    }
    return parsed;
}

function getRuntimeConfig(env = process.env) {
    const nodeEnv = String(env.NODE_ENV || 'development').trim().toLowerCase();
    const databaseEnabled = parseBoolean(env.DATABASE_ENABLED, false);
    const databaseRequired = parseBoolean(env.DATABASE_REQUIRED, databaseEnabled);
    const databaseUrl = String(env.DATABASE_URL || '').trim();

    if ((databaseEnabled || databaseRequired) && !databaseUrl) {
        throw new Error('DATABASE_URL is required when DATABASE_ENABLED or DATABASE_REQUIRED is true.');
    }

    if (databaseRequired && !databaseEnabled) {
        throw new Error('DATABASE_ENABLED must be true when DATABASE_REQUIRED is true.');
    }
    const durableSubmissionsEnabled = parseBoolean(env.DURABLE_SUBMISSIONS_ENABLED, false);
    if (durableSubmissionsEnabled && !databaseEnabled) {
        throw new Error('DATABASE_ENABLED must be true when DURABLE_SUBMISSIONS_ENABLED is true.');
    }
    const serverSessionsEnabled = parseBoolean(env.SERVER_SESSIONS_ENABLED, false);
    const serverWorkspacesEnabled = parseBoolean(env.SERVER_WORKSPACES_ENABLED, false);
    const plDatabaseSubmissionsEnabled = parseBoolean(env.PL_DATABASE_SUBMISSIONS_ENABLED, false);
    const plServerSessionsEnabled = parseBoolean(env.PL_SERVER_SESSIONS_ENABLED, false);
    const ptfeServerSessionsEnabled = parseBoolean(env.PTFE_SERVER_SESSIONS_ENABLED, false);
    const piServerSessionsEnabled = parseBoolean(env.PI_SERVER_SESSIONS_ENABLED, false);
    if (serverSessionsEnabled && !databaseEnabled) throw new Error('DATABASE_ENABLED must be true when SERVER_SESSIONS_ENABLED is true.');
    if ((plServerSessionsEnabled || ptfeServerSessionsEnabled || piServerSessionsEnabled) && !serverSessionsEnabled) {
        throw new Error('SERVER_SESSIONS_ENABLED must be true before enabling department server sessions.');
    }
    if (serverWorkspacesEnabled && !serverSessionsEnabled) throw new Error('SERVER_SESSIONS_ENABLED must be true when SERVER_WORKSPACES_ENABLED is true.');
    if (plDatabaseSubmissionsEnabled && (!durableSubmissionsEnabled || !serverWorkspacesEnabled || !plServerSessionsEnabled)) {
        throw new Error('Durable submissions, server workspaces, and PL server sessions must be enabled before PL database submissions.');
    }

    const sslEnabled = parseBoolean(env.DATABASE_SSL, false);
    if (nodeEnv === 'production' && sslEnabled && parseBoolean(env.DATABASE_SSL_REJECT_UNAUTHORIZED, true) === false) {
        throw new Error('DATABASE_SSL_REJECT_UNAUTHORIZED cannot be false in production.');
    }

    return {
        nodeEnv,
        port: parseInteger(env.PORT, 3000, { minimum: 1, maximum: 65535 }),
        host: String(env.SERVER_HOST || '0.0.0.0').trim(),
        logLevel: String(env.LOG_LEVEL || (nodeEnv === 'production' ? 'info' : 'debug')).trim(),
        serviceVersion: String(env.APP_VERSION || require('../package.json').version).trim(),
        database: {
            enabled: databaseEnabled,
            required: databaseRequired,
            url: databaseUrl,
            poolMax: parseInteger(env.DATABASE_POOL_MAX, 10, { minimum: 1, maximum: 100 }),
            connectionTimeoutMs: parseInteger(env.DATABASE_CONNECTION_TIMEOUT_MS, 5000, { minimum: 100, maximum: 60000 }),
            statementTimeoutMs: parseInteger(env.DATABASE_STATEMENT_TIMEOUT_MS, 15000, { minimum: 100, maximum: 300000 }),
            ssl: sslEnabled ? {
                rejectUnauthorized: parseBoolean(env.DATABASE_SSL_REJECT_UNAUTHORIZED, true)
            } : false
        },
        migrationsDir: path.join(__dirname, '..', 'db', 'migrations'),
        features: {
            durableSubmissions: durableSubmissionsEnabled,
            serverSessions: serverSessionsEnabled,
            serverWorkspaces: serverWorkspacesEnabled,
            plDatabaseSubmissions: plDatabaseSubmissionsEnabled,
            sessionDepartments: {
                PL: plServerSessionsEnabled,
                PTFE: ptfeServerSessionsEnabled,
                PI: piServerSessionsEnabled
            }
        },
        sessions: {
            ttlMs: parseInteger(env.SESSION_TTL_MS, 12 * 60 * 60 * 1000, { minimum: 15 * 60 * 1000, maximum: 7 * 24 * 60 * 60 * 1000 }),
            cookieName: String(env.SESSION_COOKIE_NAME || 'metrics_session').trim(),
            secureCookie: parseBoolean(env.SESSION_COOKIE_SECURE, nodeEnv === 'production')
        },
        worker: {
            pollIntervalMs: parseInteger(env.WORKER_POLL_INTERVAL_MS, 1000, { minimum: 100, maximum: 60000 }),
            leaseMs: parseInteger(env.WORKER_LEASE_MS, 60000, { minimum: 5000, maximum: 600000 }),
            maxAttempts: parseInteger(env.WORKER_MAX_ATTEMPTS, 10, { minimum: 1, maximum: 100 }),
            baseBackoffMs: parseInteger(env.WORKER_BASE_BACKOFF_MS, 5000, { minimum: 100, maximum: 60000 }),
            maximumBackoffMs: parseInteger(env.WORKER_MAX_BACKOFF_MS, 900000, { minimum: 1000, maximum: 86400000 })
        }
    };
}

function validateApplicationEnvironment(env = process.env) {
    const required = [
        'DEPT_PL_API_TOKEN',
        'DEPT_PL_CONFIG_SHEET_ID',
        'DEPT_PL_MASTER_LOG_SHEET_ID',
        'DEPT_PL_DEFECT_SEEDS_SHEET_ID',
        'DEPT_PTFE_API_TOKEN',
        'DEPT_PTFE_CONFIG_SHEET_ID',
        'DEPT_PTFE_MASTER_LOG_SHEET_ID',
        'DEPT_PTFE_STANDARDS_SHEET_ID',
        'DEPT_PTFE_ITEMS_SHEET_ID',
        'DEPT_PTFE_JOB_LOG_SHEET_ID',
        'DEPT_PI_API_TOKEN',
        'DEPT_PI_CONFIG_SHEET_ID',
        'DEPT_PI_MASTER_LOG_SHEET_ID',
        'DEPT_PI_STANDARDS_SHEET_ID',
        'DEPT_PI_ITEMS_SHEET_ID',
        'DEPT_PI_JOB_LOG_SHEET_ID'
    ];

    const missing = required.filter((name) => !String(env[name] || '').trim());
    if (missing.length > 0) {
        throw new Error(`Missing required environment variable(s): ${missing.join(', ')}`);
    }
    return { required, missing: [] };
}

module.exports = {
    getRuntimeConfig,
    validateApplicationEnvironment,
    parseBoolean,
    parseInteger
};
