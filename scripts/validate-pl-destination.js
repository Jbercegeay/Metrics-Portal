require('dotenv').config({ quiet: true });

const { fetchConfigData } = require('../lib/config');
const { auditPlDestination } = require('../lib/pl-destination-contract');
const { getClientForDept, getRequiredEnv } = require('../lib/smartsheet');

async function main() {
    const client = getClientForDept('PL');
    const sheetId = getRequiredEnv('DEPT_PL_MASTER_LOG_SHEET_ID');
    const [config, response] = await Promise.all([
        fetchConfigData(null, 'PL', { includeSupplemental: false }),
        client.get(`sheets/${sheetId}?include=columns`)
    ]);
    const defectNames = (config.defects || []).map((defect) => defect.name);
    const columns = response.data.columns || [];
    const audit = auditPlDestination(columns, defectNames);

    console.log('Precision Liner destination contract (read-only)');
    console.log(`  Expected writable columns: ${audit.expectedCount}`);
    console.log(`  Destination columns present: ${audit.actualCount}`);
    console.log(`  Submission ID type: ${audit.submissionIdType || 'missing'}`);
    if (audit.missing.length) console.log(`  Missing: ${audit.missing.join(', ')}`);
    if (audit.duplicates.length) console.log(`  Duplicate exact titles: ${audit.duplicates.join(', ')}`);
    if (audit.formulaColumns.length) console.log(`  Writable columns with formulas: ${audit.formulaColumns.join(', ')}`);
    console.log(`  Result: ${audit.ok ? 'READY' : 'NOT READY'}`);
    if (!audit.ok) process.exitCode = 1;
}

main().catch((error) => {
    console.error(`PL destination audit failed: ${error.response?.data?.message || error.message}`);
    process.exitCode = 1;
});
