const STATIC_PL_COLUMNS = [
    'Submission ID', 'Entry Type', 'Work Date', 'Associate Name', 'Sequence',
    'Lot Number', 'Item', 'Time worked (Min)', 'Notes', 'Event',
    'Start Quantity', 'End Quantity', 'PTFE Oven Head', 'PTFE  Operators',
    'Etch Operators', 'Teco Oven Head', 'Teco Operators', 'Pebax Oven  Head',
    'Pebax Operators', 'Did Operators leave a Comment?', '=< 50% Yield',
    'Reason for Fail', 'Spool Check Sequence', 'Check #'
];

function expectedPlColumns(defectNames = []) {
    return [
        ...STATIC_PL_COLUMNS,
        ...defectNames.map((name) => `Defect-${String(name).trim()}`).filter((name) => name !== 'Defect-')
    ];
}

function auditPlDestination(columns = [], defectNames = []) {
    const expected = expectedPlColumns(defectNames);
    const byTitle = columns.reduce((map, column) => {
        if (!map.has(column.title)) map.set(column.title, []);
        map.get(column.title).push(column);
        return map;
    }, new Map());
    const missing = expected.filter((title) => !byTitle.has(title));
    const duplicates = expected.filter((title) => (byTitle.get(title) || []).length > 1);
    const formulaColumns = expected.filter((title) => (byTitle.get(title) || []).some((column) => Boolean(column.formula)));
    const submissionIdColumns = byTitle.get('Submission ID') || [];
    const submissionIdType = submissionIdColumns[0]?.type || null;
    const submissionIdTypeValid = ['TEXT_NUMBER', 'PICKLIST'].includes(submissionIdType);
    return {
        ok: missing.length === 0 && duplicates.length === 0 && formulaColumns.length === 0 && submissionIdTypeValid,
        expectedCount: expected.length,
        actualCount: columns.length,
        missing,
        duplicates,
        formulaColumns,
        submissionIdType,
        submissionIdTypeValid
    };
}

module.exports = { STATIC_PL_COLUMNS, auditPlDestination, expectedPlColumns };
