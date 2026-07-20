const assert = require('node:assert/strict');
const test = require('node:test');

const { buildConfigPayload } = require('../lib/config');
const { PL_OPERATOR_ROSTER } = require('../lib/pl-operator-roster');

function cell(columnId, value) {
    return { columnId, value };
}

function sheetWithOperators(operatorValues = []) {
    const columns = [
        { id: 1, title: 'Associate Name' },
        { id: 2, title: 'Operators' }
    ];
    const rows = operatorValues.map((operator, index) => ({
        id: 100 + index,
        cells: [
            cell(1, index === 0 ? 'Ashley West' : ''),
            cell(2, operator)
        ]
    }));
    return { columns, rows };
}

test('PL config exposes operators from the Operators column', () => {
    const payload = buildConfigPayload(sheetWithOperators(['Chris Keith', 'Chris Keith', 'Adam Yarbrough']), { dept: 'PL' });

    assert.deepEqual(payload.operators.map((operator) => operator.name), ['Chris Keith', 'Chris Keith', 'Adam Yarbrough']);
    assert.deepEqual(payload.associates.map((associate) => associate.name), ['Ashley West']);
});

test('PL config falls back to the legacy RCA roster until the Operators column is added', () => {
    const payload = buildConfigPayload({ columns: [{ id: 1, title: 'Associate Name' }], rows: [] }, { dept: 'PL' });

    assert.equal(payload.operators.length, PL_OPERATOR_ROSTER.length);
    assert.equal(payload.operators[0].name, PL_OPERATOR_ROSTER[0]);
    assert.equal(payload.operators.at(-1).name, PL_OPERATOR_ROSTER.at(-1));
});
