require('dotenv').config({ quiet: true });

const { PL_OPERATOR_ROSTER } = require('../lib/pl-operator-roster');
const { getClientForDept, getRequiredEnv } = require('../lib/smartsheet');

const CONFIRMATION = 'ADD PL CONFIG OPERATORS';
const COLUMN_TITLE = 'Operators';

function getArgument(name) {
    const prefix = `${name}=`;
    const argument = process.argv.slice(2).find((value) => value.startsWith(prefix));
    return argument ? argument.slice(prefix.length) : null;
}

function getColumn(sheet, title) {
    return (sheet.columns || []).find((column) => column.title === title);
}

function getCellValue(row, columnId) {
    return row.cells.find((cell) => cell.columnId === columnId)?.value || '';
}

function normalizeName(value) {
    return String(value || '').trim();
}

function uniqueNames(names) {
    return Array.from(new Set(names.map(normalizeName).filter(Boolean)));
}

function planOperatorColumn(sheet) {
    const column = getColumn(sheet, COLUMN_TITLE);
    const existingNames = column
        ? uniqueNames((sheet.rows || []).map((row) => getCellValue(row, column.id)))
        : [];
    const existingSet = new Set(existingNames.map((name) => name.toLowerCase()));
    const missingNames = PL_OPERATOR_ROSTER.filter((name) => !existingSet.has(name.toLowerCase()));
    const availableRows = column
        ? (sheet.rows || []).filter((row) => !normalizeName(getCellValue(row, column.id))).length
        : (sheet.rows || []).length;
    const rowsToAdd = Math.max(0, missingNames.length - availableRows);

    return {
        hasColumn: Boolean(column),
        column,
        existingNames,
        missingNames,
        availableRows,
        rowsToAdd
    };
}

async function fetchSheet(client, sheetId) {
    const response = await client.get(`sheets/${sheetId}`);
    return response.data;
}

async function addOperatorsColumn(client, sheetId, index) {
    const response = await client.post(`sheets/${sheetId}/columns`, [{
        title: COLUMN_TITLE,
        type: 'TEXT_NUMBER',
        index
    }]);
    const columns = response.data.result || response.data.data || [];
    return Array.isArray(columns) ? columns[0] : columns;
}

async function updateRows(client, sheetId, rows) {
    if (!rows.length) return;
    await client.put(`sheets/${sheetId}/rows`, rows);
}

async function addRows(client, sheetId, columnId, names) {
    if (!names.length) return;
    await client.post(`sheets/${sheetId}/rows`, names.map((name) => ({
        toBottom: true,
        cells: [{ columnId, value: name, strict: false }]
    })));
}

async function main() {
    const apply = process.argv.includes('--apply');
    const confirmation = getArgument('--confirmation');
    if (apply && confirmation !== CONFIRMATION) {
        throw new Error(`PL operator config migration requires --confirmation="${CONFIRMATION}".`);
    }

    const sheetId = getRequiredEnv('DEPT_PL_CONFIG_SHEET_ID');
    const client = getClientForDept('PL');
    const sheet = await fetchSheet(client, sheetId);
    const plan = planOperatorColumn(sheet);

    console.log('Precision Liner configuration Operators column');
    console.log(`  Mode: ${apply ? 'APPLY' : 'DRY RUN'}`);
    console.log(`  Current columns: ${(sheet.columns || []).length}`);
    console.log(`  Operators column: ${plan.hasColumn ? 'present' : 'missing'}`);
    console.log(`  Existing operators: ${plan.existingNames.length}`);
    console.log(`  Missing seeded operators: ${plan.missingNames.length}`);
    console.log(`  Rows to add: ${plan.rowsToAdd}`);

    if (!plan.missingNames.length && plan.hasColumn) {
        console.log('  Result: READY; no change required.');
        return;
    }
    if (!apply) {
        console.log('  Result: READY TO APPLY; no Smartsheet change made.');
        return;
    }

    let column = plan.column;
    if (!column) {
        column = await addOperatorsColumn(client, sheetId, (sheet.columns || []).length);
    }

    const latestSheet = await fetchSheet(client, sheetId);
    const latestColumn = getColumn(latestSheet, COLUMN_TITLE);
    if (!latestColumn) throw new Error('Could not verify Operators column after add.');

    const latestExisting = new Set(uniqueNames((latestSheet.rows || []).map((row) => getCellValue(row, latestColumn.id))).map((name) => name.toLowerCase()));
    const namesToPlace = PL_OPERATOR_ROSTER.filter((name) => !latestExisting.has(name.toLowerCase()));
    const blankRows = (latestSheet.rows || []).filter((row) => !normalizeName(getCellValue(row, latestColumn.id)));
    const updates = [];
    const addNames = [];

    namesToPlace.forEach((name, index) => {
        const row = blankRows[index];
        if (row) {
            updates.push({ id: row.id, cells: [{ columnId: latestColumn.id, value: name, strict: false }] });
        } else {
            addNames.push(name);
        }
    });

    await updateRows(client, sheetId, updates);
    await addRows(client, sheetId, latestColumn.id, addNames);

    const verifiedSheet = await fetchSheet(client, sheetId);
    const verified = planOperatorColumn(verifiedSheet);
    if (!verified.hasColumn || verified.missingNames.length) {
        throw new Error(`Post-change verification failed; missing operators: ${verified.missingNames.length}.`);
    }

    console.log(`  Verified columns: ${(verifiedSheet.columns || []).length}`);
    console.log(`  Operators verified: ${verified.existingNames.length}`);
    console.log(`  Rows updated: ${updates.length}`);
    console.log(`  Rows added: ${addNames.length}`);
    console.log('  Result: READY');
}

main().catch((error) => {
    console.error(`PL operator config migration failed: ${error.response?.data?.message || error.message}`);
    process.exitCode = 1;
});
