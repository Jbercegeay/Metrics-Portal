const test = require('node:test');
const assert = require('node:assert/strict');
const {
    getRuntimeConfig,
    validateApplicationEnvironment,
    parseBoolean,
    parseInteger
} = require('../lib/runtime-config');

test('database stays optional during the compatibility period', () => {
    const config = getRuntimeConfig({ NODE_ENV: 'test' });
    assert.equal(config.database.enabled, false);
    assert.equal(config.database.required, false);
    assert.equal(config.port, 3000);
});

test('database URL is required when database support is enabled', () => {
    assert.throws(
        () => getRuntimeConfig({ DATABASE_ENABLED: 'true' }),
        /DATABASE_URL is required/
    );
});

test('a required database cannot be disabled', () => {
    assert.throws(
        () => getRuntimeConfig({ DATABASE_REQUIRED: 'true', DATABASE_URL: 'postgresql://example' }),
        /DATABASE_ENABLED must be true/
    );
});

test('production TLS verification cannot be disabled', () => {
    assert.throws(
        () => getRuntimeConfig({
            NODE_ENV: 'production',
            DATABASE_ENABLED: 'true',
            DATABASE_URL: 'postgresql://example',
            DATABASE_SSL: 'true',
            DATABASE_SSL_REJECT_UNAUTHORIZED: 'false'
        }),
        /cannot be false in production/
    );
});

test('boolean and integer parsers reject ambiguous values', () => {
    assert.equal(parseBoolean('yes'), true);
    assert.equal(parseBoolean('off'), false);
    assert.throws(() => parseBoolean('sometimes'), /Expected a boolean/);
    assert.equal(parseInteger('12', 1, { minimum: 1, maximum: 20 }), 12);
    assert.throws(() => parseInteger('21', 1, { minimum: 1, maximum: 20 }), /Expected an integer/);
});

test('application validation reports missing names without exposing values', () => {
    assert.throws(
        () => validateApplicationEnvironment({}),
        /DEPT_PL_API_TOKEN, DEPT_PL_CONFIG_SHEET_ID, DEPT_PL_MASTER_LOG_SHEET_ID, DEPT_PL_DEFECT_SEEDS_SHEET_ID/
    );
});

test('enabled department writes require their own credentials and destination', () => {
    const base = {
        DEPT_PL_API_TOKEN: 'secret',
        DEPT_PL_CONFIG_SHEET_ID: '1',
        DEPT_PL_MASTER_LOG_SHEET_ID: '2',
        DEPT_PL_DEFECT_SEEDS_SHEET_ID: '3',
        ALLOW_PTFE_MASTER_LOG_WRITES: 'true'
    };
    assert.throws(
        () => validateApplicationEnvironment(base),
        /DEPT_PTFE_API_TOKEN, DEPT_PTFE_MASTER_LOG_SHEET_ID/
    );
});
