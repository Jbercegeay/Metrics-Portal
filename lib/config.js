const { getRequiredEnv, getSheet } = require('./smartsheet');

const MASTER_CONFIG_SHEET_ID = getRequiredEnv('EMPLOYEE_SCHEDULE_SHEET_ID');

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

function getCellValue(row, columnId) {
    return row.cells.find((cell) => cell.columnId === columnId)?.value ?? null;
}

function buildConfigPayload(sheet) {
    const associates = [];
    const sequences = [];
    const defects = [];
    const events = [];

    sheet.rows.forEach((row) => {
        const associateName = getCellValue(row, CONFIG_COLUMN_MAP['Associate Name'])?.trim();
        if (associateName) {
            associates.push({
                id: row.id,
                name: associateName,
                Mon: getCellValue(row, CONFIG_COLUMN_MAP.Mon) || 0,
                Tue: getCellValue(row, CONFIG_COLUMN_MAP.Tue) || 0,
                Wed: getCellValue(row, CONFIG_COLUMN_MAP.Wed) || 0,
                Thur: getCellValue(row, CONFIG_COLUMN_MAP.Thur) || 0,
                Fri: getCellValue(row, CONFIG_COLUMN_MAP.Fri) || 0,
                Sat: getCellValue(row, CONFIG_COLUMN_MAP.Sat) || 0,
                Sun: getCellValue(row, CONFIG_COLUMN_MAP.Sun) || 0,
                Training: getCellValue(row, CONFIG_COLUMN_MAP['Training?']) || false,
                Role: getCellValue(row, CONFIG_COLUMN_MAP.Role) || 'Associate',
                hasPassword: !!getCellValue(row, CONFIG_COLUMN_MAP['Password Hash'])
            });
        }

        const sequenceName = getCellValue(row, CONFIG_COLUMN_MAP.Sequences)?.trim();
        if (sequenceName) {
            sequences.push({
                id: row.id,
                name: sequenceName,
                goal: getCellValue(row, CONFIG_COLUMN_MAP['Sequence Goals']) || 0
            });
        }

        const defectName = getCellValue(row, CONFIG_COLUMN_MAP.Defects)?.trim();
        if (defectName) {
            defects.push({ id: row.id, name: defectName });
        }

        const eventName = getCellValue(row, CONFIG_COLUMN_MAP.Events)?.trim();
        if (eventName) {
            events.push({ id: row.id, name: eventName });
        }
    });

    return { associates, sequences, defects, events };
}

async function fetchConfigData() {
    const sheet = await getSheet(MASTER_CONFIG_SHEET_ID);
    return buildConfigPayload(sheet);
}

module.exports = {
    CONFIG_COLUMN_MAP,
    MASTER_CONFIG_SHEET_ID,
    buildConfigPayload,
    fetchConfigData,
    getCellValue
};
