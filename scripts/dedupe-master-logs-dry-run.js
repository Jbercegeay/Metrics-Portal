require('dotenv').config({ quiet: true });

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getClientForDept, getRequiredEnv } = require('../lib/smartsheet');

const DEFAULT_WINDOW_MINUTES = 10;
const DELETE_CHUNK_SIZE = 100;
const DEFECT_COLUMNS_PATH = path.join(__dirname, '..', 'data', 'defect_columns.json');

const PL_MASTER_LOG_COLUMN_MAP = {
    'Entry Type': 1351153963716484,
    'Work Date': 455303208062852,
    'Associate Name': 4958902835433348,
    'Sequence': 2555116879826820,
    'Lot Number': 4806916693512068,
    'Item': 2707103021748100,
    'Time worked (Min)': 7058716507197316,
    'Notes': 5039889678290820,
    'Event': 4366886188568452,
    'Start Quantity': 1429216972984196,
    'End Quantity': 5932816600354692,
    'PTFE Oven Head': 4450127486603140,
    'PTFE  Operators': 8953727113973636,
    'Etch Operators': 52080975499140,
    'Teco Oven Head': 4555680602869636,
    'Teco Operators': 2303880789184388,
    'Pebax Oven  Head': 6807480416554884,
    'Pebax Operators': 1177980882341764,
    'Did Operators leave a Comment?': 5681580509712260,
    '=< 50% Yield': 6701927300288388,
    'Defect-Wrinkles': 8184616414039940,
    'Defect-Stuck Parts': 866267019562884,
    'Defect-Brown Spots Mandrel': 5369866646933380,
    'Defect-Brown Spots Etching Fluid': 3118066833248132,
    'Defect-Foreign Material': 7621666460618628,
    'Defect-Chatter': 1992166926405508,
    'Defect-Stretched PTFE': 6495766553776004,
    'Defect-Exposed Mandrel': 4243966740090756,
    'Defect-Channel': 8747566367461252,
    'Defect-Discoloration': 6091773339979652,
    'Defect-Blisters/Bubbles': 3839973526294404,
    'Defect-Waviness': 8343573153664900
};

const PTFE_MASTER_LOG_WRITE_TITLES = [
    'Entry Type',
    'Associate Name',
    'Date',
    'Time Worked',
    'Item',
    'Lot #',
    'Start Quantity',
    'End Quantity',
    'Sequence',
    'Footage',
    'Processing Length',
    'Scrap Parts',
    'Scrap Rate %',
    'Re-Cuts',
    'Inspection Pareto',
    'Pulling Pareto',
    'Pulling Wraps',
    'Pulling Method',
    'Event',
    'Comments'
];

const PI_MASTER_LOG_WRITE_TITLES = [
    'Entry Type',
    'Associate Name',
    'Date',
    'Time Worked',
    'Item',
    'Lot #',
    'Start Quantity',
    'End Quantity',
    'Sequence',
    'Footage',
    'Processing Length',
    'Scrap Parts',
    'Scrap Rate %',
    'Re-Cuts',
    'Inspection Pareto',
    'Pulling Pareto',
    'Pulling Wraps',
    'Pulling Method',
    'Event',
    'Comments'
];

function parseArgs(argv) {
    const options = {
        apply: false,
        includeClusters: false,
        windowMinutes: DEFAULT_WINDOW_MINUTES
    };

    argv.forEach((arg) => {
        if (arg === '--apply') {
            options.apply = true;
            return;
        }
        if (arg === '--include-clusters') {
            options.includeClusters = true;
            return;
        }
        if (arg.startsWith('--window-minutes=')) {
            const value = Number(arg.split('=')[1]);
            if (!Number.isFinite(value) || value <= 0) {
                throw new Error(`Invalid --window-minutes value: ${arg}`);
            }
            options.windowMinutes = value;
            return;
        }
        throw new Error(`Unknown argument: ${arg}`);
    });

    return options;
}

function loadDynamicPlDefectColumns() {
    try {
        if (!fs.existsSync(DEFECT_COLUMNS_PATH)) return {};
        const raw = JSON.parse(fs.readFileSync(DEFECT_COLUMNS_PATH, 'utf8'));
        return raw.PL || {};
    } catch (error) {
        throw new Error(`Failed to read ${DEFECT_COLUMNS_PATH}: ${error.message}`);
    }
}

function normalizeDuplicateValue(value) {
    if (value === undefined || value === null) return '';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    const text = String(value).trim();
    if (!text) return '';
    const numberLike = text.replace(/,/g, '');
    if (/^-?\d+(\.\d+)?$/.test(numberLike)) {
        const parsed = Number(numberLike);
        if (Number.isFinite(parsed)) return String(parsed);
    }
    return text.replace(/\s+/g, ' ');
}

function buildSignature(entries) {
    const normalizedEntries = entries
        .map(([title, value]) => [title, normalizeDuplicateValue(value)])
        .filter(([, value]) => value !== '')
        .sort(([a], [b]) => a.localeCompare(b));
    if (normalizedEntries.length === 0) return null;
    return crypto.createHash('sha256').update(JSON.stringify(normalizedEntries)).digest('hex');
}

function getCellValueByColumnId(row, columnId) {
    const cell = (row.cells || []).find((candidate) => candidate.columnId === columnId);
    return cell ? cell.value : undefined;
}

function buildDepartmentConfigs() {
    const plMap = { ...PL_MASTER_LOG_COLUMN_MAP, ...loadDynamicPlDefectColumns() };
    return [
        {
            dept: 'PL',
            sheetId: getRequiredEnv('DEPT_PL_MASTER_LOG_SHEET_ID'),
            getColumnMap: async () => plMap,
            includeTitle: (title) => Object.prototype.hasOwnProperty.call(plMap, title)
        },
        {
            dept: 'PTFE',
            sheetId: getRequiredEnv('DEPT_PTFE_MASTER_LOG_SHEET_ID'),
            getColumnMap: async () => {
                const client = getClientForDept('PTFE');
                const response = await client.get(`sheets/${getRequiredEnv('DEPT_PTFE_MASTER_LOG_SHEET_ID')}?include=columns`);
                return (response.data.columns || []).reduce((map, column) => {
                    if (PTFE_MASTER_LOG_WRITE_TITLES.includes(column.title)) {
                        map[column.title] = column.id;
                    }
                    return map;
                }, {});
            },
            includeTitle: (title) => PTFE_MASTER_LOG_WRITE_TITLES.includes(title)
        },
        {
            dept: 'PI',
            sheetId: getRequiredEnv('DEPT_PI_MASTER_LOG_SHEET_ID'),
            getColumnMap: async () => {
                const client = getClientForDept('PI');
                const response = await client.get(`sheets/${getRequiredEnv('DEPT_PI_MASTER_LOG_SHEET_ID')}?include=columns`);
                return (response.data.columns || []).reduce((map, column) => {
                    if (PI_MASTER_LOG_WRITE_TITLES.includes(column.title)) {
                        map[column.title] = column.id;
                    }
                    return map;
                }, {});
            },
            includeTitle: (title) => PI_MASTER_LOG_WRITE_TITLES.includes(title)
        }
    ];
}

function buildRowRecord(row, columnMap) {
    const entries = Object.entries(columnMap).map(([title, columnId]) => [title, getCellValueByColumnId(row, columnId)]);
    const signature = buildSignature(entries);
    if (!signature) return null;

    const createdAtMs = Date.parse(row.createdAt || '');
    if (!Number.isFinite(createdAtMs)) return null;

    return {
        id: row.id,
        rowNumber: row.rowNumber,
        createdAt: row.createdAt,
        createdAtMs,
        signature,
        normalizedValues: Object.fromEntries(
            entries
                .map(([title, value]) => [title, normalizeDuplicateValue(value)])
                .filter(([, value]) => value !== '')
        )
    };
}

function clusterRows(records, windowMs) {
    const sorted = [...records].sort((a, b) => a.createdAtMs - b.createdAtMs || a.id - b.id);
    const clusters = [];
    let currentCluster = [];
    let clusterStartMs = null;

    sorted.forEach((record) => {
        if (!currentCluster.length) {
            currentCluster = [record];
            clusterStartMs = record.createdAtMs;
            return;
        }

        if ((record.createdAtMs - clusterStartMs) <= windowMs) {
            currentCluster.push(record);
            return;
        }

        clusters.push(currentCluster);
        currentCluster = [record];
        clusterStartMs = record.createdAtMs;
    });

    if (currentCluster.length) {
        clusters.push(currentCluster);
    }

    return clusters.filter((cluster) => cluster.length > 1);
}

function summarizeClusters(clusters) {
    return clusters.map((cluster) => {
        const sorted = [...cluster].sort((a, b) => a.createdAtMs - b.createdAtMs || a.id - b.id);
        const keeper = sorted[sorted.length - 1];
        const duplicates = sorted.slice(0, -1);
        return {
            signature: keeper.signature,
            rowIds: sorted.map((record) => record.id),
            keeperRowId: keeper.id,
            deletedRowIds: duplicates.map((record) => record.id),
            createdAtRange: {
                oldest: sorted[0].createdAt,
                newest: keeper.createdAt
            },
            sampleValues: keeper.normalizedValues
        };
    });
}

function buildAlertReasons(summary) {
    const reasons = [];
    if (!summary.ok) {
        reasons.push('department_error');
    }
    if (summary.deletedRows > 0) {
        reasons.push('rows_deleted');
    }
    return reasons;
}

async function deleteRows(client, sheetId, rowIds) {
    if (!rowIds.length) {
        return [];
    }

    const deleted = [];
    for (let index = 0; index < rowIds.length; index += DELETE_CHUNK_SIZE) {
        const chunk = rowIds.slice(index, index + DELETE_CHUNK_SIZE);
        await client.delete(`sheets/${sheetId}/rows`, {
            params: {
                ids: chunk.join(',')
            }
        });
        deleted.push(...chunk);
    }
    return deleted;
}

async function analyzeDepartment(config, options) {
    const client = getClientForDept(config.dept);
    const columnMap = await config.getColumnMap();
    const response = await client.get(`sheets/${config.sheetId}`);
    const rows = response.data.rows || [];
    const windowMs = options.windowMinutes * 60 * 1000;

    const records = rows
        .map((row) => buildRowRecord(row, columnMap))
        .filter(Boolean);

    const groups = new Map();
    records.forEach((record) => {
        const bucket = groups.get(record.signature) || [];
        bucket.push(record);
        groups.set(record.signature, bucket);
    });

    const clusters = [];
    groups.forEach((group) => {
        clusters.push(...clusterRows(group, windowMs));
    });

    const clusterSummaries = summarizeClusters(clusters);
    const rowIdsToDelete = clusterSummaries.flatMap((cluster) => cluster.deletedRowIds);
    const deletedRowIds = options.apply
        ? await deleteRows(client, config.sheetId, rowIdsToDelete)
        : [];
    const result = {
        sheetId: config.sheetId,
        apply: options.apply,
        scannedRows: rows.length,
        eligibleRows: records.length,
        duplicateClusters: clusterSummaries.length,
        duplicateRows: rowIdsToDelete.length,
        deletedRows: deletedRowIds.length,
        deletedRowIds
    };

    if (options.includeClusters) {
        result.clusters = clusterSummaries;
    }

    return result;
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    const departmentConfigs = buildDepartmentConfigs();
    const deleteResults = {};
    const summary = {
        ok: true,
        apply: options.apply,
        includeClusters: options.includeClusters,
        windowMinutes: options.windowMinutes,
        generatedAt: new Date().toISOString(),
        deletedRows: 0,
        departmentsWithDeletes: [],
        departmentsWithErrors: [],
        deleteResults
    };

    for (const config of departmentConfigs) {
        try {
            deleteResults[config.dept] = await analyzeDepartment(config, options);
            summary.deletedRows += deleteResults[config.dept].deletedRows;
            if (deleteResults[config.dept].deletedRows > 0) {
                summary.departmentsWithDeletes.push(config.dept);
            }
        } catch (error) {
            summary.ok = false;
            summary.departmentsWithErrors.push(config.dept);
            deleteResults[config.dept] = {
                error: error.response?.data || error.message
            };
        }
    }

    summary.alertReasons = buildAlertReasons(summary);
    summary.shouldAlert = summary.alertReasons.length > 0;

    console.log(JSON.stringify(summary, null, 2));

    if (!summary.ok) {
        process.exitCode = 1;
    }
}

main().catch((error) => {
    console.error(JSON.stringify({
        ok: false,
        error: error.response?.data || error.message
    }, null, 2));
    process.exitCode = 1;
});
