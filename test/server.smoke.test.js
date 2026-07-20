const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.DATABASE_ENABLED = 'false';
process.env.DATABASE_REQUIRED = 'false';
process.env.DURABLE_SUBMISSIONS_ENABLED = 'false';
process.env.DEPT_PL_API_TOKEN = process.env.DEPT_PL_API_TOKEN || 'test-token';
process.env.DEPT_PL_CONFIG_SHEET_ID = process.env.DEPT_PL_CONFIG_SHEET_ID || '1';
process.env.DEPT_PL_MASTER_LOG_SHEET_ID = process.env.DEPT_PL_MASTER_LOG_SHEET_ID || '2';
process.env.DEPT_PL_DEFECT_SEEDS_SHEET_ID = process.env.DEPT_PL_DEFECT_SEEDS_SHEET_ID || '3';
const additionalEnvironment = [
    'DEPT_PTFE_API_TOKEN', 'DEPT_PTFE_CONFIG_SHEET_ID', 'DEPT_PTFE_MASTER_LOG_SHEET_ID',
    'DEPT_PTFE_STANDARDS_SHEET_ID', 'DEPT_PTFE_ITEMS_SHEET_ID', 'DEPT_PTFE_JOB_LOG_SHEET_ID',
    'DEPT_PI_API_TOKEN', 'DEPT_PI_CONFIG_SHEET_ID', 'DEPT_PI_MASTER_LOG_SHEET_ID',
    'DEPT_PI_STANDARDS_SHEET_ID', 'DEPT_PI_ITEMS_SHEET_ID', 'DEPT_PI_JOB_LOG_SHEET_ID'
];
for (const [index, name] of additionalEnvironment.entries()) {
    process.env[name] = process.env[name] || String(index + 10);
}

const { app, database } = require('../server');

test.after(async () => {
    await database.close();
});

test('foundation health endpoints are mounted in the real application', async () => {
    const liveness = await request(app).get('/api/v2/health').expect(200);
    assert.equal(liveness.body.status, 'alive');

    const readiness = await request(app).get('/api/v2/health/ready').expect(200);
    assert.equal(readiness.body.status, 'ready');
    assert.equal(readiness.body.checks.database.status, 'disabled');
});

test('legacy status endpoint remains available during migration', async () => {
    const response = await request(app).get('/api/status').expect(200);
    assert.equal(response.body.status, 'Online');
});
