const assert = require('node:assert/strict');
const test = require('node:test');
const { buildPlIntegrationSheet } = require('../lib/pl-integration-sheet');
const { planPlSubmissionIdExpansion } = require('../lib/pl-submission-id-migration');

const defects = ['Wrinkle', 'Cut'];
const complete = buildPlIntegrationSheet(defects).columns;

test('PL production expansion is ready when Submission ID already satisfies the contract', () => {
    assert.equal(planPlSubmissionIdExpansion(complete, defects).action, 'ready');
});

test('PL production expansion adds only a missing Submission ID column', () => {
    const withoutId = complete.filter((column) => column.title !== 'Submission ID');
    const plan = planPlSubmissionIdExpansion(withoutId, defects);
    assert.equal(plan.action, 'add');
    assert.deepEqual(plan.blockers, []);
});

test('PL production expansion blocks unrelated drift and invalid existing ID types', () => {
    const missingOther = complete.filter((column) => column.title !== 'Lot Number');
    assert.equal(planPlSubmissionIdExpansion(missingOther, defects).action, 'blocked');
    const invalidId = complete.map((column) => column.title === 'Submission ID' ? { ...column, type: 'CHECKBOX' } : column);
    assert.equal(planPlSubmissionIdExpansion(invalidId, defects).action, 'blocked');
});
