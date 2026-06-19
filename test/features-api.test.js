const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');
const request = require('supertest');
const { createFeatureRouter } = require('../routes/features');

test('feature endpoint exposes rollout state without configuration secrets', async () => {
    const features = {
        durableSubmissions: true,
        serverSessions: true,
        serverWorkspaces: true,
        plDatabaseSubmissions: true,
        sessionDepartments: { PL: true, PTFE: false, PI: false }
    };
    const app = express();
    app.use('/api/v2', createFeatureRouter(features));

    const response = await request(app).get('/api/v2/features').expect(200);
    assert.deepEqual(response.body, { success: true, features });
    assert.equal(JSON.stringify(response.body).includes('TOKEN'), false);
});
