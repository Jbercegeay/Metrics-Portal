require('dotenv').config({ quiet: true });

const { fetchConfigData } = require('../lib/config');
const { auditPlDestination } = require('../lib/pl-destination-contract');
const { DEFAULT_SHEET_NAME, buildPlIntegrationSheet } = require('../lib/pl-integration-sheet');
const { getClientForDept } = require('../lib/smartsheet');

const CONFIRMATION = 'CREATE EMPTY PL INTEGRATION SHEET';

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
    const name = getArgument('--name') || DEFAULT_SHEET_NAME;
    if (apply && confirmation !== CONFIRMATION) {
        throw new Error(`Creation requires --confirmation="${CONFIRMATION}".`);
    }

    const config = await fetchConfigData(null, 'PL', { includeSupplemental: false });
    const defectNames = (config.defects || []).map((defect) => defect.name);
    const definition = buildPlIntegrationSheet(defectNames, name);

    console.log('Precision Liner integration-sheet creation');
    console.log(`  Mode: ${apply ? 'APPLY' : 'DRY RUN'}`);
    console.log(`  Sheet name: ${definition.name}`);
    console.log(`  Empty columns: ${definition.columns.length}`);
    console.log('  Production rows copied: 0');

    if (!apply) {
        console.log('  Result: dry run passed; no Smartsheet object created.');
        return;
    }

    const client = getClientForDept('PL');
    const response = await client.post('sheets', definition, {
        headers: {
            'smartsheet-integration-source': 'SCRIPT,Internal,Metrics-Portal-Readiness'
        }
    });
    const created = response.data.result || response.data;
    if (!created.id) {
        throw new Error('Smartsheet did not return a created sheet ID.');
    }

    const columns = await listColumns(client, created.id);
    const audit = auditPlDestination(columns, defectNames);
    if (!audit.ok) {
        throw new Error(`Created sheet failed its destination audit; missing: ${audit.missing.join(', ') || 'none'}.`);
    }

    console.log(`  Sheet ID: ${created.id}`);
    console.log(`  Permalink: ${created.permalink}`);
    console.log(`  Verified columns: ${columns.length}`);
    console.log('  Result: READY');
}

main().catch((error) => {
    console.error(`PL integration-sheet creation failed: ${error.response?.data?.message || error.message}`);
    process.exitCode = 1;
});
