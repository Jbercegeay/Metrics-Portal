const assert = require('node:assert/strict');
const test = require('node:test');
const { auditPlDestination, expectedPlColumns } = require('../lib/pl-destination-contract');

function columns(titles) {
    return titles.map((title) => ({ title, type: 'TEXT_NUMBER' }));
}

test('PL destination audit requires exact static and configured defect titles', () => {
    const expected = expectedPlColumns(['Wrinkle', 'Cut']);
    const result = auditPlDestination(columns(expected), ['Wrinkle', 'Cut']);
    assert.equal(result.ok, true);
    assert.deepEqual(result.missing, []);
});

test('PL destination audit detects missing ID, duplicate titles, and writable formulas', () => {
    const expected = expectedPlColumns(['Wrinkle']);
    const supplied = columns(expected.filter((title) => title !== 'Submission ID'));
    supplied.push({ title: 'Item', type: 'TEXT_NUMBER' });
    supplied.find((column) => column.title === 'Notes').formula = '=1';
    const result = auditPlDestination(supplied, ['Wrinkle']);
    assert.equal(result.ok, false);
    assert.deepEqual(result.missing, ['Submission ID']);
    assert.deepEqual(result.duplicates, ['Item']);
    assert.deepEqual(result.formulaColumns, ['Notes']);
    assert.equal(result.submissionIdTypeValid, false);
});

test('PL Submission ID must use a text-compatible destination type', () => {
    const supplied = columns(expectedPlColumns());
    supplied.find((column) => column.title === 'Submission ID').type = 'DATE';
    const result = auditPlDestination(supplied);
    assert.equal(result.ok, false);
    assert.equal(result.submissionIdType, 'DATE');
});
