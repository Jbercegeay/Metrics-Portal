const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');
const { normalizeSubmission } = require('../services/submissions/validation');

test('authenticated envelope overrides client reporting identity in destination payload', () => {
    const submission = normalizeSubmission({
        id: crypto.randomUUID(), department: 'PL', associateName: 'Authenticated Associate',
        entryType: 'job', workDate: '2026-06-19', kioskId: 'kiosk-1',
        payload: {
            'Entry Type': 'Event', 'Work Date': '1999-01-01',
            'Associate Name': 'Impersonated Associate', Item: '123456'
        }
    });

    assert.equal(submission.payload['Entry Type'], 'Job');
    assert.equal(submission.payload['Work Date'], '2026-06-19');
    assert.equal(submission.payload['Associate Name'], 'Authenticated Associate');
    assert.equal(submission.payload.Item, '123456');
});
