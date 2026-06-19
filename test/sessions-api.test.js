const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const { createSessionRouter } = require('../routes/sessions');

function app(session, service, enabled = true) {
    const instance = express();
    instance.use(express.json());
    instance.use((req, res, next) => { req.portalSession = session; next(); });
    instance.use('/api/v2/sessions', createSessionRouter({ enabled, service }));
    return instance;
}

test('sign-out is blocked while unsaved workspace data exists', async () => {
    const service = { revoke: async () => ({ revoked: false, unsavedWorkspace: true }), clearCookie() {} };
    const response = await request(app({ id: 's1' }, service)).delete('/api/v2/sessions/current').expect(409);
    assert.equal(response.body.unsavedWorkspace, true);
});

test('intentional discard requires a reason', async () => {
    const service = { revoke: async () => ({ revoked: true }), clearCookie() {} };
    await request(app({ id: 's1' }, service)).delete('/api/v2/sessions/current?discard=true').send({}).expect(400);
});

test('supervisor lock release is authorized and reasoned', async () => {
    let captured;
    const service = { async releaseLock(userId, actor, reason) { captured = { userId, actor, reason }; return { released: true }; } };
    const session = { name: 'Supervisor', role: 'Supervisor', department: 'PL', kioskId: 'k1' };
    await request(app(session, service)).post('/api/v2/sessions/kiosk-locks/user-1/release').send({ reason: 'Stale workstation' }).expect(200);
    assert.equal(captured.reason, 'Stale workstation');
});

test('associate cannot release kiosk locks', async () => {
    await request(app({ role: 'Associate' }, {})).post('/api/v2/sessions/kiosk-locks/user-1/release').send({ reason: 'No' }).expect(403);
});
