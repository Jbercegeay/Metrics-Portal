const { auditPlDestination } = require('./pl-destination-contract');

function planPlSubmissionIdExpansion(columns, defectNames = []) {
    const audit = auditPlDestination(columns, defectNames);
    const submissionColumns = columns.filter((column) => column.title === 'Submission ID');
    const otherMissing = audit.missing.filter((title) => title !== 'Submission ID');
    const blockers = [];

    if (submissionColumns.length > 1) blockers.push('Submission ID exists more than once.');
    if (otherMissing.length > 0) blockers.push(`Other required columns are missing: ${otherMissing.join(', ')}.`);
    if (audit.duplicates.length > 0) blockers.push(`Duplicate writable columns exist: ${audit.duplicates.join(', ')}.`);
    if (audit.formulaColumns.length > 0) blockers.push(`Writable formula columns exist: ${audit.formulaColumns.join(', ')}.`);
    if (submissionColumns.length === 1 && !audit.submissionIdTypeValid) blockers.push(`Submission ID has unsupported type ${audit.submissionIdType || 'unknown'}.`);

    if (blockers.length > 0) return { action: 'blocked', audit, blockers };
    if (submissionColumns.length === 1) return { action: 'ready', audit, blockers: [] };
    return { action: 'add', audit, blockers: [] };
}

module.exports = { planPlSubmissionIdExpansion };
