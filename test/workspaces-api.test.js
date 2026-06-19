const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const { createWorkspaceRouter } = require('../routes/workspaces');

function app(service, session = { userId: 'user-1', department: 'PL' }) {
    const instance = express();
    instance.use(express.json());
    instance.use((req, res, next) => { req.portalSession = session; next(); });
    instance.use('/api/v2/workspaces', createWorkspaceRouter({ enabled: true, service }));
    return instance;
}

test('workspace version conflicts return the authoritative state', async () => {
    const authoritative = { id: 'workspace-1', version: 4 };
    const service = { save: async () => ({ conflict: true, workspace: authoritative }) };
    const response = await request(app(service)).put('/api/v2/workspaces/current').send({}).expect(409);
    assert.equal(response.body.workspace.version, 4);
});

test('workspace endpoints require an authenticated session', async () => {
    await request(app({}, null)).get('/api/v2/workspaces/current').expect(401);
});
