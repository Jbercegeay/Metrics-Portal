const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const { createSubmissionRouter } = require('../routes/submissions');
const { ValidationError } = require('../services/submissions/validation');

function app(options = {}) {
    const instance = express();
    instance.use(express.json());
    instance.use('/api/v2/submissions', createSubmissionRouter({
        databaseEnabled: options.databaseEnabled ?? true,
        service: options.service || {},
        getSupervisorActor: (req) => req.get('x-admin-token') === 'valid' ? { name: 'Supervisor', role: 'Supervisor', department: 'PL', kioskId: 'test' } : null,
        getSessionActor: async () => ({ name: 'Associate', role: 'Associate', department: 'PL', kioskId: 'test-kiosk' })
    }));
    return instance;
}

test('capture returns 201 for a new commit and 200 for an idempotent replay', async () => {
    let created = true;
    const service = {
        async create(input) {
            const result = { created, duplicate: !created, submission: { ...input, syncStatus: 'pending', lifecycleStatus: 'committed' } };
            created = false;
            return result;
        }
    };
    const body = { id: 'id-1', department: 'PL', associateName: 'Associate', entryType: 'job', workDate: '2026-06-19' };
    const first = await request(app({ service })).post('/api/v2/submissions').send(body).expect(201);
    assert.equal(first.body.duplicate, false);
    const replay = await request(app({ service })).post('/api/v2/submissions').send(body).expect(200);
    assert.equal(replay.body.duplicate, true);
});

test('validation responses identify fields', async () => {
    const service = { async create() { throw new ValidationError({ workDate: 'Required.' }); } };
    const response = await request(app({ service })).post('/api/v2/submissions').send({}).expect(400);
    assert.equal(response.body.fields.workDate, 'Required.');
});

test('supervisor list and retry require authorization', async () => {
    const service = { list: async () => [], getById: async () => ({ id: 'id-1', department: 'PL' }), retry: async () => true };
    await request(app({ service })).get('/api/v2/submissions').expect(401);
    await request(app({ service })).get('/api/v2/submissions').set('x-admin-token', 'valid').expect(200);
    await request(app({ service })).post('/api/v2/submissions/id-1/retry').send({ reason: 'Operator request' }).expect(401);
    await request(app({ service })).post('/api/v2/submissions/id-1/retry').set('x-admin-token', 'valid').send({ reason: 'Operator request' }).expect(200);
});

test('supervisors cannot manage another department', async () => {
    const service = { list: async () => [], getById: async () => ({ id: 'id-1', department: 'PTFE' }), retry: async () => true };
    await request(app({ service })).get('/api/v2/submissions?dept=PTFE').set('x-admin-token', 'valid').expect(403);
    await request(app({ service })).post('/api/v2/submissions/id-1/retry').set('x-admin-token', 'valid').send({ reason: 'No' }).expect(403);
});

test('disabled database returns a clear service unavailable response', async () => {
    const response = await request(app({ databaseEnabled: false })).post('/api/v2/submissions').send({}).expect(503);
    assert.match(response.body.error, /not enabled/);
});
