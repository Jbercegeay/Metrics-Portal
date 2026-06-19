const test = require('node:test');
const assert = require('node:assert/strict');
const { createSessionMiddleware, createSessionService, readCookie, tokenHash } = require('../services/sessions/session-service');

test('session tokens are hashed and never stored raw', async () => {
    let captured;
    const service = createSessionService({
        repository: { async createSession(input) { captured = input; return { conflict: false, session: { id: 'session-1' } }; } },
        ttlMs: 1000000,
        cookieName: 'metrics_session',
        secure: false
    });
    const result = await service.create({ name: 'Test', role: 'Associate', department: 'PL' }, 'kiosk-1');
    assert.ok(result.token);
    assert.notEqual(captured.tokenHash, result.token);
    assert.equal(captured.tokenHash, tokenHash(result.token));
});

test('session creation requires a kiosk ID', async () => {
    const service = createSessionService({ repository: {}, ttlMs: 1000000, cookieName: 'metrics_session', secure: false });
    await assert.rejects(() => service.create({ name: 'Test' }, ''), /Kiosk ID/);
});

test('cookie parsing returns only the named cookie', () => {
    assert.equal(readCookie({ headers: { cookie: 'theme=dark; metrics_session=abc%20123' } }, 'metrics_session'), 'abc 123');
    assert.equal(readCookie({ headers: {} }, 'metrics_session'), null);
});

test('session middleware attaches a resolved session when enabled', async () => {
    const expected = { id: 'session-1' };
    const middleware = createSessionMiddleware({ enabled: true, service: { resolve: async () => expected } });
    const req = {};
    await new Promise((resolve, reject) => middleware(req, {}, (error) => error ? reject(error) : resolve()));
    assert.equal(req.portalSession, expected);
});
