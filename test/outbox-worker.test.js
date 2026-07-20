const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateBackoffMs, createOutboxWorker, safeError } = require('../services/submissions/outbox-worker');

function logger() { return { info() {}, warn() {}, error() {} }; }
function claim(attempt = 1) {
    return { id: 10, submission_id: 'submission-1', attempt_count: attempt, lease_owner: 'worker-1', submission: { department: 'PL' } };
}

test('backoff is exponential, capped, and jittered deterministically', () => {
    assert.equal(calculateBackoffMs(1, { baseMs: 1000, maximumMs: 5000, random: () => 0.5 }), 1000);
    assert.equal(calculateBackoffMs(4, { baseMs: 1000, maximumMs: 5000, random: () => 0.5 }), 5000);
});

test('successful delivery completes the claimed outbox record', async () => {
    const calls = [];
    const repository = {
        claimNext: async () => claim(),
        completeSuccess: async (...args) => calls.push(['success', ...args]),
        completeFailure: async (...args) => calls.push(['failure', ...args])
    };
    const worker = createOutboxWorker({
        repository,
        deliveryAdapter: { deliver: async () => ({ remoteRowId: '99', alreadyExists: false }) },
        logger: logger(), workerId: 'worker-1'
    });
    const result = await worker.processOnce();
    assert.equal(result.success, true);
    assert.equal(calls[0][0], 'success');
});

test('timeout is retryable and records a future attempt', async () => {
    let failure;
    const repository = {
        claimNext: async () => claim(1),
        completeSuccess: async () => {},
        completeFailure: async (value, result) => { failure = result; }
    };
    const worker = createOutboxWorker({
        repository,
        deliveryAdapter: { deliver: async () => { const error = new Error('timeout'); error.code = 'ECONNABORTED'; throw error; } },
        logger: logger(), workerId: 'worker-1', now: () => new Date('2026-06-19T12:00:00Z'), random: () => 0.5,
        baseBackoffMs: 1000, maximumBackoffMs: 5000
    });
    const result = await worker.processOnce();
    assert.equal(result.terminal, false);
    assert.equal(failure.terminal, false);
    assert.equal(failure.code, 'ECONNABORTED');
    assert.equal(failure.nextAttemptAt.toISOString(), '2026-06-19T12:00:01.000Z');
});

test('maximum attempts move retryable failures to needs review', async () => {
    let failure;
    const repository = {
        claimNext: async () => claim(3),
        completeSuccess: async () => {},
        completeFailure: async (value, result) => { failure = result; }
    };
    const worker = createOutboxWorker({
        repository,
        deliveryAdapter: { deliver: async () => { throw new Error('network'); } },
        logger: logger(), workerId: 'worker-1', maxAttempts: 3
    });
    const result = await worker.processOnce();
    assert.equal(result.terminal, true);
    assert.equal(failure.terminal, true);
});

test('authentication and mapping errors are permanent', () => {
    assert.equal(safeError({ response: { status: 401 } }).retryable, false);
    assert.equal(safeError({ response: { status: 429 } }).retryable, true);
    assert.equal(safeError({ permanent: true, message: 'missing column' }).retryable, false);
});
