const test = require('node:test');
const assert = require('node:assert/strict');
const { createDatabase } = require('../db');
const { createIdentityRepository } = require('../repositories/identity-repository');
const { createWorkspaceRepository } = require('../repositories/workspace-repository');
const { createSessionService, tokenHash } = require('../services/sessions/session-service');
const { createWorkspaceService } = require('../services/workspaces/workspace-service');

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
if (process.env.REQUIRE_DATABASE_TESTS === 'true' && !databaseUrl) throw new Error('Database URL required.');

test('sessions isolate kiosks and workspaces reject stale tabs', { skip: !databaseUrl }, async () => {
    const db = createDatabase({ enabled: true, required: true, url: databaseUrl, poolMax: 5, connectionTimeoutMs: 5000, statementTimeoutMs: 15000, ssl: false }, { error() {} });
    const identity = createIdentityRepository(db);
    const workspaces = createWorkspaceService(createWorkspaceRepository(db));
    const sessions = createSessionService({ repository: identity, ttlMs: 60 * 60 * 1000, cookieName: 'test_session', secure: false });
    let session;
    try {
        const created = await sessions.create({ name: 'Session Test Associate', role: 'Associate', department: 'PL' }, 'kiosk-a');
        assert.equal(created.conflict, false);
        session = created.session;
        const resolved = await identity.findSession(tokenHash(created.token), new Date(Date.now() + 60 * 60 * 1000));
        assert.equal(resolved.userId, session.userId);

        const conflict = await sessions.create({ name: 'Session Test Associate', role: 'Associate', department: 'PL' }, 'kiosk-b');
        assert.equal(conflict.conflict, true);

        const first = await workspaces.save(resolved, {
            version: 0, mode: 'job', workDate: '2026-06-19', formData: { lot: 'A' }, hasUnsavedWork: true
        });
        assert.equal(first.conflict, false);
        const updated = await workspaces.save(resolved, {
            id: first.workspace.id, version: first.workspace.version, mode: 'job', workDate: '2026-06-19', formData: { lot: 'B' }, hasUnsavedWork: true
        });
        assert.equal(updated.workspace.version, 2);
        const stale = await workspaces.save(resolved, {
            id: first.workspace.id, version: 1, mode: 'job', workDate: '2026-06-19', formData: { lot: 'stale' }, hasUnsavedWork: true
        });
        assert.equal(stale.conflict, true);
        assert.equal(stale.workspace.formData.lot, 'B');

        const blocked = await sessions.revoke(resolved, 'user_logout', {});
        assert.equal(blocked.unsavedWorkspace, true);
        const revoked = await sessions.revoke(resolved, 'user_logout', { discard: true, discardReason: 'Integration test cleanup' });
        assert.equal(revoked.revoked, true);
        const active = await identity.findSession(tokenHash(created.token), new Date(Date.now() + 60 * 60 * 1000));
        assert.equal(active, null);
    } finally {
        if (session?.userId) {
            await db.query('DELETE FROM audit_events WHERE entity_id IN (SELECT id::text FROM sessions WHERE user_id = $1) OR entity_id IN (SELECT id::text FROM workspaces WHERE user_id = $1) OR entity_id = $1::text', [session.userId]);
            await db.query('DELETE FROM workspaces WHERE user_id = $1', [session.userId]);
            await db.query('DELETE FROM kiosk_locks WHERE user_id = $1', [session.userId]);
            await db.query('DELETE FROM sessions WHERE user_id = $1', [session.userId]);
            await db.query('DELETE FROM users WHERE id = $1', [session.userId]);
        }
        await db.close();
    }
});
