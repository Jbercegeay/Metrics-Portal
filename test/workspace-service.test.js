const test = require('node:test');
const assert = require('node:assert/strict');
const { createWorkspaceService, normalizeWorkspace } = require('../services/workspaces/workspace-service');
const { ValidationError } = require('../services/submissions/validation');

test('workspace payload normalizes versioned form state', () => {
    const value = normalizeWorkspace({
        version: 0,
        mode: 'JOB',
        workDate: '2026-06-19',
        formData: { lot: 'test-lot' },
        hasUnsavedWork: true
    });
    assert.equal(value.mode, 'job');
    assert.equal(value.version, 0);
    assert.equal(value.hasUnsavedWork, true);
});

test('workspace updates require an ID and valid version', () => {
    assert.throws(() => normalizeWorkspace({
        version: 2, mode: 'job', workDate: '2026-06-19', formData: {}, hasUnsavedWork: false
    }), ValidationError);
});

test('workspace service passes authenticated ownership to repository', async () => {
    let captured;
    const service = createWorkspaceService({
        async save(session, workspace) { captured = { session, workspace }; return { conflict: false, workspace }; }
    });
    const session = { userId: 'user-1', department: 'PL' };
    await service.save(session, { version: 0, mode: 'event', workDate: '2026-06-19', formData: {}, hasUnsavedWork: false });
    assert.equal(captured.session.userId, 'user-1');
});
