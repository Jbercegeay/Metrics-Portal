const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { createSubmissionService } = require('../services/submissions/submission-service');
const { ConflictError, ValidationError, hashPayload } = require('../services/submissions/validation');

function input(overrides = {}) {
    return {
        id: crypto.randomUUID(),
        department: 'PL',
        associateName: 'Test Associate',
        entryType: 'job',
        workDate: '2026-06-19',
        kioskId: 'kiosk-test',
        payload: { Item: '123456', Sequence: 'Test' },
        ...overrides
    };
}

test('submission service normalizes and creates one durable destination', async () => {
    let captured;
    const service = createSubmissionService({
        async create(submission, destination, actor) {
            captured = { submission, destination, actor };
            return { created: true, submission: { ...submission, syncStatus: 'pending' } };
        }
    });
    const value = input({ department: 'pl', entryType: 'JOB' });
    const result = await service.create(value);
    assert.equal(result.created, true);
    assert.equal(captured.submission.department, 'PL');
    assert.equal(captured.submission.payload['Entry Type'], 'Job');
    assert.equal(captured.submission.payload['Work Date'], '2026-06-19');
    assert.equal(captured.submission.payload['Associate Name'], 'Test Associate');
    assert.equal(captured.destination, 'smartsheet:PL:master_log');
    assert.equal(captured.actor.name, 'Test Associate');
});

test('same ID and payload returns the existing result', async () => {
    const value = input();
    const service = createSubmissionService({
        async create(submission) {
            return { created: false, submission: { ...submission, payloadHash: submission.payloadHash } };
        }
    });
    const result = await service.create(value);
    assert.equal(result.duplicate, true);
});

test('same ID with a different payload is rejected', async () => {
    const value = input();
    const service = createSubmissionService({
        async create(submission) {
            return { created: false, submission: { ...submission, payloadHash: hashPayload({ different: true }) } };
        }
    });
    await assert.rejects(() => service.create(value), ConflictError);
});

test('field validation is specific and Job x Job batches are rejected', async () => {
    const service = createSubmissionService({ create() { throw new Error('should not execute'); } });
    await assert.rejects(
        () => service.create(input({ id: 'bad', workDate: 'not-a-date', payload: [] })),
        (error) => Boolean(error instanceof ValidationError && error.fields.id && error.fields.workDate && error.fields.payload)
    );
});

test('PL Job x Job destination is explicitly unsupported', async () => {
    const service = createSubmissionService({ create() { throw new Error('should not execute'); } });
    await assert.rejects(() => service.create(input({ entryType: 'jxj' })), ValidationError);
});
