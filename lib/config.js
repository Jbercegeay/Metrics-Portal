const { getRequiredEnv, getSheet } = require('./smartsheet');

const MASTER_CONFIG_SHEET_ID = getRequiredEnv('DEPT_PL_CONFIG_SHEET_ID');

const DEPARTMENTS = {
    PL: {
        key: 'PL',
        displayName: 'PrecisionLiner',
        configSheetEnv: 'DEPT_PL_CONFIG_SHEET_ID'
    },
    PTFE: {
        key: 'PTFE',
        displayName: 'PTFE',
        configSheetEnv: 'DEPT_PTFE_CONFIG_SHEET_ID',
        itemsSheetEnv: 'DEPT_PTFE_ITEMS_SHEET_ID',
        standardsSheetEnv: 'DEPT_PTFE_STANDARDS_SHEET_ID'
    },
    PI: {
        key: 'PI',
        displayName: 'Polyimide',
        configSheetEnv: 'DEPT_PI_CONFIG_SHEET_ID',
        itemsSheetEnv: 'DEPT_PI_ITEMS_SHEET_ID',
        standardsSheetEnv: 'DEPT_PI_STANDARDS_SHEET_ID'
    }
};

const CONFIG_COLUMN_MAP = {
    'Associate Name': 6162537289305988,
    Mon: 3910737475620740,
    Tue: 8414337102991236,
    Wed: 1095987708514180,
    Thur: 2132655374815108,
    Fri: 6636255002185604,
    Sat: 4384455188500356,
    Sun: 8888054815870852,
    'Training?': 8569907604836228,
    Role: 1512792438558596,
    'Password Hash': 5268733822717828,
    Sequences: 398046561783684,
    'Sequence Goals': 4901646189154180,
    Defects: 2649846375468932,
    Events: 7153446002839428
};

const PI_PULLING_PARETOS = new Set([
    'Material Breaking',
    'Other (Enter Comments)',
    'Release Issues',
    'Wrong Footage'
]);

function getCellValue(row, columnId) {
    if (!columnId) return null;
    return row.cells.find((cell) => cell.columnId === columnId)?.value ?? null;
}

function normalizeDept(dept = 'PL') {
    const key = String(dept || 'PL').trim().toUpperCase();
    if (!DEPARTMENTS[key]) {
        throw new Error(`Unsupported department: ${dept}`);
    }
    return key;
}

function getDepartmentConfig(dept = 'PL') {
    return DEPARTMENTS[normalizeDept(dept)];
}

function buildColumnMap(sheet) {
    return (sheet.columns || []).reduce((map, column) => {
        map[column.title] = column.id;
        return map;
    }, {});
}

function getColumnId(columnMap, title) {
    return columnMap[title] || CONFIG_COLUMN_MAP[title];
}

function getCellByTitle(row, columnMap, title) {
    return getCellValue(row, getColumnId(columnMap, title));
}

function getThursdayValue(row, columnMap) {
    return getCellByTitle(row, columnMap, 'Thur') ?? getCellByTitle(row, columnMap, 'Thurs') ?? 0;
}

function looksLikeAssociateName(value) {
    const name = String(value || '').trim();
    if (!name) return false;
    if (name.length > 80) return false;
    if (/[?.]/.test(name)) return false;
    return /^[A-Za-z][A-Za-z', -]+$/.test(name);
}

function buildConfigPayload(sheet, options = {}) {
    const dept = normalizeDept(options.dept || 'PL');
    const department = getDepartmentConfig(dept);
    const columnMap = buildColumnMap(sheet);
    const associates = [];
    const sequences = [];
    const defects = [];
    const events = [];
    const inspectionParetos = [];
    const pullingParetos = [];
    const pullingMethods = [];
    const departments = [];

    sheet.rows.forEach((row) => {
        const associateName = getCellByTitle(row, columnMap, 'Associate Name')?.trim();
        if (looksLikeAssociateName(associateName)) {
            associates.push({
                id: row.id,
                name: associateName,
                Cell: getCellByTitle(row, columnMap, 'Cell') || '',
                ScheduledMinutes: getCellByTitle(row, columnMap, 'Scheduled Minutes') || 0,
                Rate: getCellByTitle(row, columnMap, 'Rate') || 0,
                Mon: getCellByTitle(row, columnMap, 'Mon') || 0,
                Tue: getCellByTitle(row, columnMap, 'Tue') || 0,
                Wed: getCellByTitle(row, columnMap, 'Wed') || 0,
                Thur: getThursdayValue(row, columnMap),
                Fri: getCellByTitle(row, columnMap, 'Fri') || 0,
                Sat: getCellByTitle(row, columnMap, 'Sat') || 0,
                Sun: getCellByTitle(row, columnMap, 'Sun') || 0,
                Training: getCellByTitle(row, columnMap, 'Training?') || false,
                Role: getCellByTitle(row, columnMap, 'Role') || 'Associate',
                hasPassword: !!getCellByTitle(row, columnMap, 'Password Hash')
            });
        }

        const sequenceName = getCellByTitle(row, columnMap, 'Sequences')?.trim();
        if (sequenceName) {
            sequences.push({
                id: row.id,
                name: sequenceName,
                goal: getCellByTitle(row, columnMap, 'Sequence Goals') || 0
            });
        }

        const defectName = getCellByTitle(row, columnMap, 'Defects')?.trim();
        if (defectName) {
            defects.push({ id: row.id, name: defectName });
        }

        const eventName = getCellByTitle(row, columnMap, 'Events')?.trim();
        if (eventName) {
            events.push({ id: row.id, name: eventName });
        }

        const inspectionPareto = getCellByTitle(row, columnMap, 'Inspection Pareto')?.trim();
        if (inspectionPareto) {
            inspectionParetos.push({ id: row.id, name: inspectionPareto });
        }

        const pullingPareto = getCellByTitle(row, columnMap, 'Pulling Pareto')?.trim();
        if (pullingPareto) {
            if (department.key !== 'PI' || PI_PULLING_PARETOS.has(pullingPareto)) {
                pullingParetos.push({ id: row.id, name: pullingPareto });
            }
        }

        const pullingMethod = getCellByTitle(row, columnMap, 'Pulling Method')?.trim();
        if (pullingMethod) {
            pullingMethods.push({ id: row.id, name: pullingMethod });
        }

        const departmentLabel = getCellByTitle(row, columnMap, 'Department')?.trim();
        if (departmentLabel) {
            departments.push({ id: row.id, name: departmentLabel });
        }
    });

    if (['PTFE', 'PI'].includes(department.key)) {
        const requiredPtfeEvents = ['Lunch', 'Break', 'Bathroom'];
        const existing = new Set(events.map(e => String(e.name || '').trim().toLowerCase()).filter(Boolean));
        requiredPtfeEvents.forEach((name) => {
            if (!existing.has(name.toLowerCase())) {
                events.push({ id: null, name });
            }
        });
    }

    return {
        departmentKey: department.key,
        department: department.displayName,
        associates,
        sequences,
        defects,
        events,
        inspectionParetos,
        pullingParetos,
        pullingMethods,
        departments
    };
}

function getConfigSheetId(dept = 'PL') {
    return getRequiredEnv(getDepartmentConfig(dept).configSheetEnv);
}

function buildListPayload(sheet, fields) {
    const columnMap = buildColumnMap(sheet);
    return sheet.rows.map((row) => {
        const item = { id: row.id };
        fields.forEach((field) => {
            item[field.key] = getCellByTitle(row, columnMap, field.title);
        });
        return item;
    }).filter((item) => fields.some((field) => item[field.key] !== null && item[field.key] !== ''));
}

async function fetchDepartmentSupplementalData(dept = 'PL') {
    const department = getDepartmentConfig(dept);
    if (!['PTFE', 'PI'].includes(department.key)) {
        return {};
    }

    const [itemsSheet, standardsSheet] = await Promise.all([
        getSheet(getRequiredEnv(department.itemsSheetEnv), department.key),
        getSheet(getRequiredEnv(department.standardsSheetEnv), department.key)
    ]);

    return {
        items: buildListPayload(itemsSheet, [
            { key: 'item', title: 'Item' },
            { key: 'fgLength', title: 'FG Length (in)' },
            { key: 'productFamily', title: 'Product Family' },
            { key: 'unitOfMeasure', title: 'Unit Of Measure' }
        ]),
        standards: buildListPayload(standardsSheet, [
            { key: 'item', title: 'Item' },
            { key: 'sequence', title: 'Sequence' },
            { key: 'goodPphStd', title: 'Good PPH Std' },
            { key: 'totalPphStd', title: 'Total PPH Std' }
        ])
    };
}

async function fetchConfigData(sheetId = null, dept = 'PL', options = {}) {
    const key = normalizeDept(dept);
    const resolvedSheetId = sheetId || getConfigSheetId(key);
    const sheet = await getSheet(resolvedSheetId, key);
    const payload = buildConfigPayload(sheet, { dept: key });
    if (options.includeSupplemental === false) {
        return payload;
    }
    const supplemental = await fetchDepartmentSupplementalData(key);
    return { ...payload, ...supplemental };
}

module.exports = {
    CONFIG_COLUMN_MAP,
    DEPARTMENTS,
    MASTER_CONFIG_SHEET_ID,
    buildConfigPayload,
    buildColumnMap,
    fetchConfigData,
    getCellByTitle,
    getCellValue,
    getConfigSheetId,
    getDepartmentConfig,
    normalizeDept
};
