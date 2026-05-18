/**
 * Condense list-style Master Configuration columns without restructuring rows.
 *
 * This script compacts values upward inside the configured list columns only:
 *   - PL: Sequences, Sequence Goals, Defects, Events
 *   - PTFE: Sequences, Sequence Goals, Events, Inspection Pareto, Pulling Pareto, Pulling Method
 *   - PI: Sequences, Sequence Goals, Events, Inspection Pareto, Pulling Pareto, Pulling Method
 *
 * It does not move or edit associate schedule/login fields such as
 * Associate Name, Cell, Mon-Sun, Training?, Role, or Password Hash.
 *
 * Run:
 *   node scripts/condense-config-columns.js
 *
 * Optional:
 *   DRY_RUN=1 node scripts/condense-config-columns.js
 */

require('dotenv').config();

const { getClientForDept } = require('../lib/smartsheet');

const DEPARTMENTS = [
    {
        key: 'PL',
        env: 'DEPT_PL_CONFIG_SHEET_ID',
        columns: ['Sequences', 'Sequence Goals', 'Defects', 'Events']
    },
    {
        key: 'PTFE',
        env: 'DEPT_PTFE_CONFIG_SHEET_ID',
        columns: ['Sequences', 'Sequence Goals', 'Events', 'Inspection Pareto', 'Pulling Pareto', 'Pulling Method']
    },
    {
        key: 'PI',
        env: 'DEPT_PI_CONFIG_SHEET_ID',
        columns: ['Sequences', 'Sequence Goals', 'Events', 'Inspection Pareto', 'Pulling Pareto', 'Pulling Method']
    }
];

function envPresent(name) {
    return Boolean(String(process.env[name] || '').trim());
}

function normalizeValue(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed === '' ? null : trimmed;
    }
    return value;
}

function buildColumnLookup(columns) {
    return columns.reduce((lookup, column) => {
        lookup[column.title] = column;
        return lookup;
    }, {});
}

function isCellPopulated(cell) {
    return normalizeValue(cell?.value) !== null;
}

function collectColumnValues(sheet, columnId) {
    return (sheet.rows || [])
        .map((row) => ({
            rowId: row.id,
            value: normalizeValue(row.cells.find((cell) => cell.columnId === columnId)?.value)
        }))
        .filter((entry) => entry.value !== null);
}

function buildUpdateRows(sheet, columnId, values) {
    const updatesByRowId = new Map();
    const rows = sheet.rows || [];

    rows.forEach((row, index) => {
        const currentCell = row.cells.find((cell) => cell.columnId === columnId);
        const currentValue = normalizeValue(currentCell?.value);
        const nextValue = index < values.length ? values[index].value : null;

        if (currentValue === nextValue) {
            return;
        }

        if (!updatesByRowId.has(row.id)) {
            updatesByRowId.set(row.id, { id: row.id, cells: [] });
        }
        updatesByRowId.get(row.id).cells.push({
            columnId,
            value: nextValue
        });
    });

    return Array.from(updatesByRowId.values()).filter((row) => row.cells.length > 0);
}

async function updateRowsInBatches(client, sheetId, updates) {
    const batches = [];
    for (let i = 0; i < updates.length; i += 500) {
        batches.push(updates.slice(i, i + 500));
    }

    const results = [];
    for (const batch of batches) {
        const response = await client.put(`sheets/${sheetId}/rows`, batch);
        results.push(response.data);
    }
    return results;
}

async function condenseDepartment(config) {
    if (!envPresent(config.env)) {
        return {
            dept: config.key,
            sheetId: null,
            status: 'skipped',
            reason: `${config.env} is not set`
        };
    }

    const sheetId = process.env[config.env];
    const client = getClientForDept(config.key);
    const response = await client.get(`sheets/${sheetId}?include=columns,rows`);
    const sheet = response.data;
    const columnLookup = buildColumnLookup(sheet.columns || []);
    const perColumn = [];
    const updatesByRowId = new Map();

    for (const title of config.columns) {
        const column = columnLookup[title];
        if (!column) {
            perColumn.push({ title, status: 'missing-column' });
            continue;
        }

        const values = collectColumnValues(sheet, column.id);
        const updates = buildUpdateRows(sheet, column.id, values);
        if (updates.length) {
            updates.forEach((rowUpdate) => {
                if (!updatesByRowId.has(rowUpdate.id)) {
                    updatesByRowId.set(rowUpdate.id, { id: rowUpdate.id, cells: [] });
                }
                updatesByRowId.get(rowUpdate.id).cells.push(...rowUpdate.cells);
            });
        }

        perColumn.push({
            title,
            status: 'ok',
            before: values.length,
            updates: updates.length
        });
    }

    const flattenedUpdates = Array.from(updatesByRowId.values()).filter((row) => row.cells.length > 0);

    if (process.env.DRY_RUN === '1') {
        return {
            dept: config.key,
            sheetId,
            status: 'dry-run',
            columns: perColumn,
            wouldUpdateRows: flattenedUpdates.length
        };
    }

    if (flattenedUpdates.length === 0) {
        return {
            dept: config.key,
            sheetId,
            status: 'no-change',
            columns: perColumn,
            updatedRows: 0
        };
    }

    await updateRowsInBatches(client, sheetId, flattenedUpdates);

    return {
        dept: config.key,
        sheetId,
        status: 'updated',
        columns: perColumn,
        updatedRows: flattenedUpdates.length
    };
}

async function main() {
    console.log('Condensing Smartsheet config list columns...');
    console.log(`Mode: ${process.env.DRY_RUN === '1' ? 'dry-run' : 'write'}`);

    const results = [];
    for (const config of DEPARTMENTS) {
        try {
            const result = await condenseDepartment(config);
            results.push(result);
        } catch (error) {
            results.push({
                dept: config.key,
                sheetId: process.env[config.env] || null,
                status: 'error',
                reason: error.response?.data?.message || error.message
            });
        }
    }

    console.log('\nSummary:');
    for (const result of results) {
        console.log(`\n${result.dept}: ${result.status}`);
        if (result.sheetId) {
            console.log(`  Sheet: ${result.sheetId}`);
        }
        if (result.reason) {
            console.log(`  Reason: ${result.reason}`);
        }
        if (Array.isArray(result.columns)) {
            result.columns.forEach((column) => {
                if (column.status === 'missing-column') {
                    console.log(`  ${column.title}: missing`);
                    return;
                }
                console.log(`  ${column.title}: ${column.before} populated, ${column.updates} row updates`);
            });
        }
        if (typeof result.updatedRows === 'number') {
            console.log(`  Updated rows: ${result.updatedRows}`);
        }
        if (typeof result.wouldUpdateRows === 'number') {
            console.log(`  Would update rows: ${result.wouldUpdateRows}`);
        }
    }

    const hasError = results.some((result) => result.status === 'error');
    const hasSkip = results.some((result) => result.status === 'skipped');
    if (hasError || hasSkip) {
        process.exitCode = 1;
    }
}

main().catch((error) => {
    console.error('Condense failed:', error.response?.data || error.message);
    process.exit(1);
});
