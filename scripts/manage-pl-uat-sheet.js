require('dotenv').config({ quiet: true });

const { fetchConfigData } = require('../lib/config');
const { auditPlDestination } = require('../lib/pl-destination-contract');
const { getClientForDept, getRequiredEnv } = require('../lib/smartsheet');

const CLEAR_CONFIRMATION = 'CLEAR PL UAT TEST SHEET';

function getArgument(name) {
    const prefix = `${name}=`;
    const argument = process.argv.slice(2).find((value) => value.startsWith(prefix));
    return argument ? argument.slice(prefix.length) : null;
}

function chunk(values, size) {
    const chunks = [];
    for (let index = 0; index < values.length; index += size) chunks.push(values.slice(index, index + size));
    return chunks;
}

async function main() {
    const clear = process.argv.includes('--clear');
    const confirmation = getArgument('--confirmation');
    const sheetId = getRequiredEnv('PL_INTEGRATION_SHEET_ID');
    const productionSheetId = getRequiredEnv('DEPT_PL_MASTER_LOG_SHEET_ID');

    if (sheetId === productionSheetId) throw new Error('The PL UAT sheet must not be the production master log.');
    if (clear && confirmation !== CLEAR_CONFIRMATION) {
        throw new Error(`Cleanup requires --confirmation="${CLEAR_CONFIRMATION}".`);
    }

    const client = getClientForDept('PL');
    const [config, response] = await Promise.all([
        fetchConfigData(null, 'PL', { includeSupplemental: false }),
        client.get(`sheets/${sheetId}?include=columns`)
    ]);
    const rows = response.data.rows || [];
    const defects = (config.defects || []).map((defect) => defect.name);
    const audit = auditPlDestination(response.data.columns || [], defects);
    if (!audit.ok) throw new Error(`PL UAT sheet contract is not ready; missing: ${audit.missing.join(', ') || 'none'}.`);

    console.log('Precision Liner UAT-sheet guard');
    console.log(`  Mode: ${clear ? 'CLEAR' : 'CHECK EMPTY'}`);
    console.log(`  Contract columns: ${audit.actualCount}`);
    console.log(`  Rows before: ${rows.length}`);

    if (!clear && rows.length > 0) {
        throw new Error('The dedicated PL UAT sheet is not empty. Run the guarded cleanup before starting a new rehearsal.');
    }

    if (clear) {
        for (const ids of chunk(rows.map((row) => row.id), 100)) {
            await client.delete(`sheets/${sheetId}/rows`, {
                params: { ids: ids.join(','), ignoreRowsNotFound: true }
            });
        }
    }

    console.log(`  Rows removed: ${clear ? rows.length : 0}`);
    console.log('  Production destination touched: no');
    console.log('  Result: READY');
}

main().catch((error) => {
    console.error(`PL UAT-sheet guard failed: ${error.response?.data?.message || error.message}`);
    process.exitCode = 1;
});
