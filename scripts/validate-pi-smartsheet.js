require('dotenv').config();

const { getClientForDept } = require('../lib/smartsheet');

const EXPECTED = [
    {
        label: 'PI Master Configuration',
        env: 'DEPT_PI_CONFIG_SHEET_ID',
        columns: [
            'Associate Name',
            'Cell',
            'Scheduled Minutes',
            'Rate',
            'Mon',
            'Tue',
            'Wed',
            ['Thur', 'Thurs'],
            'Fri',
            'Sat',
            'Sun',
            'Training?',
            'Role',
            'Password Hash',
            'Department',
            'Sequences',
            'Sequence Goals',
            'Events',
            'Inspection Pareto',
            'Pulling Pareto',
            'Pulling Method'
        ]
    },
    {
        label: 'PI Items',
        env: 'DEPT_PI_ITEMS_SHEET_ID',
        columns: ['Item', 'FG Length (in)', 'Product Family', 'Unit Of Measure']
    },
    {
        label: 'PI Standards',
        env: 'DEPT_PI_STANDARDS_SHEET_ID',
        columns: ['Item', 'Sequence', 'Good PPH Std', 'Total PPH Std']
    },
    {
        label: 'PI Master Log',
        env: 'DEPT_PI_MASTER_LOG_SHEET_ID',
        columns: [
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
        ]
    },
    {
        label: 'PI JxJ Log',
        env: 'DEPT_PI_JOB_LOG_SHEET_ID',
        columns: [
            'Row ID',
            'Work Date',
            'Associate Name',
            'Cell',
            'Job Slot',
            'Row Type',
            'Item Number',
            'Lot Number',
            'Std PPH',
            'Actual PPH',
            ['OE %', 'OE Pct'],
            ['Time (Min)', 'Time Min'],
            'Start Qty',
            'End Qty',
            'Loss Reason',
            'Countermeasures',
            'Submitted At'
        ]
    }
];

const ENV_KEYS = [
    'DEPT_PI_API_TOKEN',
    'DEPT_PI_CONFIG_SHEET_ID',
    'DEPT_PI_ITEMS_SHEET_ID',
    'DEPT_PI_STANDARDS_SHEET_ID',
    'DEPT_PI_MASTER_LOG_SHEET_ID',
    'DEPT_PI_JOB_LOG_SHEET_ID',
    'ALLOW_PI_MASTER_LOG_WRITES'
];

function envPresent(name) {
    return Boolean(String(process.env[name] || '').trim());
}

function expectedColumnPresent(expected, titleSet) {
    if (Array.isArray(expected)) {
        return expected.some((title) => titleSet.has(title));
    }
    return titleSet.has(expected);
}

function expectedColumnLabel(expected) {
    return Array.isArray(expected) ? expected.join(' or ') : expected;
}

async function validateSheet(client, check) {
    const sheetId = process.env[check.env];
    if (!envPresent(check.env)) {
        return {
            label: check.label,
            env: check.env,
            status: 'missing-env',
            ok: false,
            details: `${check.env} is not set`
        };
    }

    try {
        const response = await client.get(`sheets/${sheetId}?include=columns`);
        const sheet = response.data;
        const columns = sheet.columns || [];
        const titleSet = new Set(columns.map((column) => column.title));
        const missing = check.columns
            .filter((expected) => !expectedColumnPresent(expected, titleSet))
            .map(expectedColumnLabel);
        const formulaWrites = columns
            .filter((column) => check.columns.some((expected) => {
                const matches = Array.isArray(expected)
                    ? expected.includes(column.title)
                    : expected === column.title;
                return matches && column.formula;
            }))
            .map((column) => column.title);

        return {
            label: check.label,
            env: check.env,
            status: missing.length || formulaWrites.length ? 'check' : 'ok',
            ok: missing.length === 0 && formulaWrites.length === 0,
            sheetName: sheet.name,
            sheetId,
            columns: columns.length,
            rows: sheet.totalRowCount ?? (sheet.rows || []).length,
            missing,
            formulaWrites
        };
    } catch (error) {
        return {
            label: check.label,
            env: check.env,
            status: 'error',
            ok: false,
            details: error.response?.data?.message || error.message
        };
    }
}

async function main() {
    console.log('PI environment presence:');
    ENV_KEYS.forEach((key) => {
        console.log(`  ${key}: ${envPresent(key) ? 'set' : 'missing'}`);
    });

    if (!envPresent('DEPT_PI_API_TOKEN')) {
        console.log('\nCannot validate Smartsheet sheets without DEPT_PI_API_TOKEN.');
        process.exitCode = 1;
        return;
    }

    const client = getClientForDept('PI');
    const results = [];
    for (const check of EXPECTED) {
        results.push(await validateSheet(client, check));
    }

    console.log('\nPI Smartsheet mapping:');
    results.forEach((result) => {
        console.log(`\n${result.ok ? 'OK' : 'CHECK'} ${result.label}`);
        if (result.sheetName) {
            console.log(`  Sheet: ${result.sheetName} (${result.sheetId})`);
            console.log(`  Columns: ${result.columns}, Rows: ${result.rows}`);
        }
        if (result.details) console.log(`  ${result.details}`);
        if (result.missing?.length) console.log(`  Missing columns: ${result.missing.join(', ')}`);
        if (result.formulaWrites?.length) console.log(`  Write columns with formulas: ${result.formulaWrites.join(', ')}`);
    });

    if (results.some((result) => !result.ok)) {
        process.exitCode = 1;
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
