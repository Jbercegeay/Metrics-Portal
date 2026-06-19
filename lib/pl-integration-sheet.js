const { expectedPlColumns, auditPlDestination } = require('./pl-destination-contract');

const DEFAULT_SHEET_NAME = 'Metrics Portal - PL Integration Test';

function buildPlIntegrationSheet(defectNames = [], name = DEFAULT_SHEET_NAME) {
    const titles = expectedPlColumns(defectNames);
    const columns = titles.map((title, index) => ({
        title,
        type: 'TEXT_NUMBER',
        primary: index === 0,
        width: title === 'Submission ID' ? 220 : 150
    }));
    const audit = auditPlDestination(columns, defectNames);
    if (!audit.ok) {
        throw new Error(`Generated PL integration contract is invalid: ${audit.missing.join(', ') || 'type mismatch'}.`);
    }
    return { name, columns };
}

module.exports = { DEFAULT_SHEET_NAME, buildPlIntegrationSheet };
