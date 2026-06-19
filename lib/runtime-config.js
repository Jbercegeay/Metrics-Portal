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
        migrationsDir: path.join(__dirname, '..', 'db', 'migrations')
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
