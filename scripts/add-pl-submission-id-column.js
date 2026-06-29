require('dotenv').config({ quiet: true });

const { fetchConfigData } = require('../lib/config');
const { planPlSubmissionIdExpansion } = require('../lib/pl-submission-id-migration');
const { getClientForDept, getRequiredEnv } = require('../lib/smartsheet');

const CONFIRMATION = 'ADD PL PRODUCTION SUBMISSION ID';

function getArgument(name) {
    const prefix = `${name}=`;
    const argument = process.argv.slice(2).find((value) => value.startsWith(prefix));
    return argument ? argument.slice(prefix.length) : null;
}

async function listColumns(client, sheetId) {
    const response = await client.get(`sheets/${sheetId}/columns`);
    return response.data.data || response.data.columns || [];
}

async function main() {
    const apply = process.argv.includes('--apply');
    const confirmation = getArgument('--confirmation');
    if (apply && confirmation !== CONFIRMATION) throw new Error(`Production expansion requires --confirmation="${CONFIRMATION}".`);

    const sheetId = getRequiredEnv('DEPT_PL_MASTER_LOG_SHEET_ID');
    const client = getClientForDept('PL');
    const [config, columns] = await Promise.all([
        fetchConfigData(null, 'PL', { includeSupplemental: false }),
        listColumns(client, sheetId)
    ]);
    const defectNames = (config.defects || []).map((defect) => defect.name);
    const plan = planPlSubmissionIdExpansion(columns, defectNames);

    console.log('Precision Liner production Submission ID expansion');
    console.log(`  Mode: ${apply ? 'APPLY' : 'DRY RUN'}`);
    console.log(`  Current columns: ${columns.length}`);
    console.log(`  Planned action: ${plan.action.toUpperCase()}`);
    console.log('  Existing rows changed: 0');

    if (plan.action === 'blocked') throw new Error(plan.blockers.join(' '));
    if (plan.action === 'ready') {
        console.log('  Result: READY; no change required.');
        return;
    }
    if (!apply) {
        console.log('  Result: READY TO APPLY; no Smartsheet change made.');
        return;
    }

    await client.post(`sheets/${sheetId}/columns`, [{ title: 'Submission ID', type: 'TEXT_NUMBER', index: columns.length }]);
    const verifiedColumns = await listColumns(client, sheetId);
    const verified = planPlSubmissionIdExpansion(verifiedColumns, defectNames);
    if (verified.action !== 'ready') throw new Error(`Post-change verification failed: ${verified.blockers.join(' ') || verified.action}.`);

    console.log(`  Verified columns: ${verifiedColumns.length}`);
    console.log('  Existing rows changed: 0');
    console.log('  Result: READY');
}

main().catch((error) => {
    console.error(`PL production expansion failed: ${error.response?.data?.message || error.message}`);
    process.exitCode = 1;
});
