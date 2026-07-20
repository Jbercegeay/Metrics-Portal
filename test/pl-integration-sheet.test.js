const test = require('node:test');
const assert = require('node:assert/strict');

const { auditPlDestination, expectedPlColumns } = require('../lib/pl-destination-contract');
const { DEFAULT_SHEET_NAME, buildPlIntegrationSheet } = require('../lib/pl-integration-sheet');

test('PL integration sheet is empty-compatible and satisfies the destination contract', () => {
    const defectNames = ['Wrinkle', 'Cut'];
    const sheet = buildPlIntegrationSheet(defectNames);
    assert.equal(sheet.name, DEFAULT_SHEET_NAME);
    assert.deepEqual(sheet.columns.map((column) => column.title), expectedPlColumns(defectNames));
    assert.equal(sheet.columns.filter((column) => column.primary).length, 1);
    assert.equal(sheet.columns[0].title, 'Submission ID');
    assert.equal(sheet.columns.every((column) => column.type === 'TEXT_NUMBER'), true);
    assert.equal(auditPlDestination(sheet.columns, defectNames).ok, true);
});

test('PL integration sheet accepts a controlled custom name', () => {
    const sheet = buildPlIntegrationSheet([], 'Controlled PL Test');
    assert.equal(sheet.name, 'Controlled PL Test');
});
