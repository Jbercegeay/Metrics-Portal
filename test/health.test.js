const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const { createHealthRouter } = require('../routes/health');
const { createLogger, requestContext } = require('../lib/logger');

function buildApp(database) {
    const app = express();
    const logger = createLogger({ level: 'silent', version: 'test', environment: 'test' });
    app.use(requestContext(logger));
    app.use('/api/v2', createHealthRouter({ database, version: 'test', startedAt: Date.now() }));
    return app;
}

test('liveness does not depend on database readiness', async () => {
    const app = buildApp({ checkReadiness: async () => ({ ok: false, status: 'unavailable' }) });
    const response = await request(app).get('/api/v2/health').expect(200);
    assert.equal(response.body.status, 'alive');
    assert.equal(response.body.requestId, response.headers['x-request-id']);
});

test('readiness succeeds only when the database check succeeds', async () => {
    const app = buildApp({ checkReadiness: async () => ({ ok: true, status: 'ready', latencyMs: 2 }) });
    const response = await request(app).get('/api/v2/health/ready').expect(200);
    assert.equal(response.body.status, 'ready');
    assert.equal(response.body.checks.database.status, 'ready');
});

test('readiness returns 503 when a required check fails', async () => {
    const app = buildApp({ checkReadiness: async () => ({ ok: false, status: 'migration_required' }) });
    const response = await request(app).get('/api/v2/health/ready').expect(503);
    assert.equal(response.body.status, 'not_ready');
});

test('caller request IDs are preserved for correlation', async () => {
    const app = buildApp({ checkReadiness: async () => ({ ok: true, status: 'ready' }) });
    const response = await request(app).get('/api/v2/health').set('x-request-id', 'operator-check-42').expect(200);
    assert.equal(response.headers['x-request-id'], 'operator-check-42');
});
