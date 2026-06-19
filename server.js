require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const {
    fetchConfigData,
    CONFIG_COLUMN_MAP,
    MASTER_CONFIG_SHEET_ID: CONFIG_SHEET_ID,
    buildColumnMap,
    getCellByTitle,
    getConfigSheetId,
    getDepartmentConfig,
    normalizeDept
} = require('./lib/config');
const { getClientForDept, getRequiredEnv, smartsheetApi } = require('./lib/smartsheet');

const app = express();
const PORT = process.env.PORT || 3000;

function isEnvTrue(name) {
    return ['1', 'true', 'yes', 'on'].includes(String(process.env[name] || '').trim().toLowerCase());
}

function toSmartsheetNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function toSmartsheetWholeNumber(value, fallback = 0) {
    return Math.round(toSmartsheetNumber(value, fallback));
}

const MASTER_LOG_NUMERIC_TITLES = new Set([
    'Item',
    'Item Number',
    'Time worked (Min)',
    'Time Worked',
    'Start Quantity',
    'End Quantity',
    'Footage',
    'Processing Length',
    'Scrap Parts',
    'Scrap Rate %',
    'Re-Cuts',
    'Pulling Wraps'
]);

const MASTER_LOG_NON_STRICT_TITLES = new Set([
    'Associate Name',
    'Sequence',
    'Inspection Pareto',
    'Pulling Pareto',
    'Pulling Method',
    'Event'
]);

const MASTER_LOG_MULTI_PICKLIST_TITLES = new Set([
    'Inspection Pareto',
    'Pulling Pareto',
    'Pulling Method'
]);

const masterLogColumnTypeCache = new Map();

function parseMasterLogCellValue(title, value) {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (MASTER_LOG_NUMERIC_TITLES.has(title) && typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return value;
}

function splitMasterLogMultiPicklistValue(value) {
    if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean);
    return String(value || '')
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
}

async function getMasterLogColumnTypes(dept) {
    const key = normalizeDept(dept);
    if (masterLogColumnTypeCache.has(key)) return masterLogColumnTypeCache.get(key);

    const response = await getClientForDept(key).get(`sheets/${getMasterLogSheetId(key)}?include=columns`);
    const typesByTitle = (response.data.columns || []).reduce((map, column) => {
        map[column.title] = column.type || '';
        return map;
    }, {});
    masterLogColumnTypeCache.set(key, typesByTitle);
    return typesByTitle;
}

function buildMasterLogCell(title, columnId, value, columnType = '') {
    const cell = { columnId };
    const isMultiPicklist = columnType === 'MULTI_PICKLIST' || MASTER_LOG_MULTI_PICKLIST_TITLES.has(title);
    if (isMultiPicklist) {
        const values = splitMasterLogMultiPicklistValue(value);
        if (values.length === 0) return null;
        cell.objectValue = {
            objectType: 'MULTI_PICKLIST',
            values
        };
        cell.strict = false;
        return cell;
    }

    cell.value = value;
    if (MASTER_LOG_NON_STRICT_TITLES.has(title)) cell.strict = false;
    return cell;
}

function smartsheetErrorMessage(error, fallback = 'Failed to save config data') {
    const data = error.response?.data;
    if (!data) return error.message || fallback;
    const parts = [data.message, data.detail?.message, data.errorCode ? `Error ${data.errorCode}` : '']
        .filter(Boolean);
    return parts.join(' ') || fallback;
}

function chunkArray(items, size = 400) {
    const chunks = [];
    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size));
    }
    return chunks;
}

function isCellEmpty(cell) {
    return !cell ||
        ((cell.value === undefined || cell.value === null || cell.value === '') &&
        !cell.displayValue &&
        cell.objectValue === undefined);
}

function findFirstBlankRowBlock(rows, columnIds, neededRows) {
    if (!neededRows || neededRows < 1) return [];
    let run = [];
    for (const row of rows) {
        const isBlank = columnIds.every(columnId => isCellEmpty(row.cells.find(cell => cell.columnId === columnId)));
        if (isBlank) {
            run.push(row);
            if (run.length >= neededRows) return run.slice(0, neededRows);
        } else {
            run = [];
        }
    }
    return [];
}

const MASTER_LOG_DUPLICATE_WINDOW_MS = Number(process.env.MASTER_LOG_DUPLICATE_WINDOW_MS || 10 * 60 * 1000);
const recentMasterLogSubmissions = new Map();

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

function buildSubmissionKey(dept, entries, clientSubmissionId = '') {
    const normalizedClientId = String(clientSubmissionId || '').trim();
    if (normalizedClientId) {
        return crypto
            .createHash('sha256')
            .update(JSON.stringify([normalizeDept(dept), normalizedClientId]))
            .digest('hex');
    }
    const normalized = entries
        .filter(([title]) => title !== 'clientSubmissionId')
        .map(([title, value]) => [title, normalizeDuplicateValue(value)])
        .filter(([, value]) => value !== '')
        .sort(([a], [b]) => a.localeCompare(b));
    return crypto
        .createHash('sha256')
        .update(JSON.stringify([normalizeDept(dept), normalized]))
        .digest('hex');
}

function pruneRecentMasterLogSubmissions(now = Date.now()) {
    for (const [key, record] of recentMasterLogSubmissions.entries()) {
        if ((now - record.startedAt) > MASTER_LOG_DUPLICATE_WINDOW_MS) {
            recentMasterLogSubmissions.delete(key);
        }
    }
}

function reserveMasterLogSubmission(dept, entries, clientSubmissionId = '') {
    const now = Date.now();
    pruneRecentMasterLogSubmissions(now);
    const key = buildSubmissionKey(dept, entries, clientSubmissionId);
    if (recentMasterLogSubmissions.has(key)) {
        return { duplicate: true, key, record: recentMasterLogSubmissions.get(key) };
    }
    recentMasterLogSubmissions.set(key, {
        dept: normalizeDept(dept),
        startedAt: now,
        status: 'pending'
    });
    return { duplicate: false, key };
}

function finishMasterLogSubmission(key, status) {
    const record = recentMasterLogSubmissions.get(key);
    if (!record) return;
    if (status === true || status === 'success') {
        record.status = 'success';
        record.completedAt = Date.now();
        return;
    }
    if (status === 'unknown') {
        record.status = 'unknown';
        record.completedAt = Date.now();
        return;
    }
    recentMasterLogSubmissions.delete(key);
}

function isSixDigitItemNumber(value) {
    return /^\d{6}$/.test(String(value || '').trim());
}

function validateItemNumberPayload(data, keys = ['Item', 'Item Number']) {
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            return isSixDigitItemNumber(data[key]);
        }
    }
    return true;
}

const SUBMISSION_SOURCE_COLUMN_TITLE = 'Submission Source';
const SUBMISSION_SOURCE_VALUE = 'new metrics portal';
const SUBMISSION_ID_COLUMN_TITLE = 'Portal Submission ID';
const PORTAL_USAGE_LOG_SHEET_ID = process.env.PORTAL_USAGE_LOG_SHEET_ID || '';
const PORTAL_USAGE_LOG_COLUMNS = [
    { title: 'Timestamp', type: 'TEXT_NUMBER', primary: true },
    { title: 'Event Type', type: 'TEXT_NUMBER' },
    { title: 'Department', type: 'TEXT_NUMBER' },
    { title: 'Associate Name', type: 'TEXT_NUMBER' },
    { title: 'Role', type: 'TEXT_NUMBER' },
    { title: 'Kiosk ID', type: 'TEXT_NUMBER' },
    { title: 'Submission Source', type: 'TEXT_NUMBER' },
    { title: 'Details', type: 'TEXT_NUMBER' }
];
const sheetColumnCache = new Map();
let _portalUsageLogColumnMap = null;

function getMasterLogSheetId(dept) {
    const key = normalizeDept(dept);
    if (key === 'PL') return MASTER_LOG_SHEET_ID;
    return getRequiredEnv(`DEPT_${key}_MASTER_LOG_SHEET_ID`);
}

async function getOrCreateSheetColumn({ dept = 'PL', sheetId, title, type = 'TEXT_NUMBER' }) {
    const key = `${normalizeDept(dept)}:${sheetId}:${title}`;
    if (sheetColumnCache.has(key)) return sheetColumnCache.get(key);

    const client = getClientForDept(dept);
    const sheetRes = await client.get(`sheets/${sheetId}?include=columns`);
    const columns = sheetRes.data.columns || [];
    const existing = columns.find(column => column.title === title);
    if (existing) {
        sheetColumnCache.set(key, existing.id);
        return existing.id;
    }

    const maxIndex = columns.length > 0 ? Math.max(...columns.map(column => column.index || 0)) : 0;
    const createRes = await client.post(`sheets/${sheetId}/columns`, [{
        title,
        type,
        index: maxIndex + 1
    }]);
    const newColumnId = createRes.data.result[0].id;
    sheetColumnCache.set(key, newColumnId);
    console.log(`Created Smartsheet column "${title}" on ${normalizeDept(dept)} sheet ${sheetId} (ID: ${newColumnId})`);
    return newColumnId;
}

async function addSubmissionSourceCell(newRow, dept) {
    const columnId = await getOrCreateSheetColumn({
        dept,
        sheetId: getMasterLogSheetId(dept),
        title: SUBMISSION_SOURCE_COLUMN_TITLE
    });
    newRow.cells.push({
        columnId,
        value: SUBMISSION_SOURCE_VALUE
    });
}

async function addSubmissionIdCell(newRow, dept, clientSubmissionId) {
    if (!clientSubmissionId) return null;
    const columnId = await getOrCreateSheetColumn({
        dept,
        sheetId: getMasterLogSheetId(dept),
        title: SUBMISSION_ID_COLUMN_TITLE
    });
    newRow.cells.push({ columnId, value: clientSubmissionId });
    return columnId;
}

async function masterLogHasSubmissionId(dept, columnId, clientSubmissionId) {
    if (!columnId || !clientSubmissionId) return false;
    const sheetId = getMasterLogSheetId(dept);
    const client = getClientForDept(dept);
    const response = await client.get(`sheets/${sheetId}`, { params: { columnIds: columnId } });
    return (response.data.rows || []).some(row =>
        (row.cells || []).some(cell =>
            cell.columnId === columnId && String(cell.value || '').trim() === clientSubmissionId
        )
    );
}

async function getPortalUsageLogColumnMap() {
    if (!PORTAL_USAGE_LOG_SHEET_ID) return null;
    if (_portalUsageLogColumnMap) return _portalUsageLogColumnMap;

    const client = getClientForDept('PL');
    const response = await client.get(`sheets/${PORTAL_USAGE_LOG_SHEET_ID}?include=columns`);
    const existingMap = buildColumnMap(response.data);
    const columns = response.data.columns || [];
    const missingColumns = PORTAL_USAGE_LOG_COLUMNS.filter(column => !existingMap[column.title]);

    if (missingColumns.length > 0) {
        const maxIndex = columns.length > 0 ? Math.max(...columns.map(column => column.index || 0)) : 0;
        const createRes = await client.post(`sheets/${PORTAL_USAGE_LOG_SHEET_ID}/columns`, missingColumns.map((column, index) => ({
            title: column.title,
            type: column.type,
            index: maxIndex + index + 1
        })));
        for (const column of createRes.data.result || []) {
            existingMap[column.title] = column.id;
        }
    }

    _portalUsageLogColumnMap = existingMap;
    return _portalUsageLogColumnMap;
}

function logPortalUsage(event) {
    if (!PORTAL_USAGE_LOG_SHEET_ID) return;
    recordPortalUsage(event).catch(error => {
        console.warn('[Portal Usage Log] Failed to record event:', error.response?.data || error.message);
    });
}

async function recordPortalUsage(event) {
    const columnMap = await getPortalUsageLogColumnMap();
    if (!columnMap) return;

    const values = {
        Timestamp: new Date().toISOString(),
        'Event Type': event.eventType,
        Department: event.department ? normalizeDept(event.department) : '',
        'Associate Name': event.associateName || '',
        Role: event.role || '',
        'Kiosk ID': event.kioskId || '',
        'Submission Source': SUBMISSION_SOURCE_VALUE,
        Details: event.details || ''
    };

    const cells = [];
    for (const column of PORTAL_USAGE_LOG_COLUMNS) {
        const value = values[column.title];
        if (columnMap[column.title] && value !== undefined && value !== null && value !== '') {
            cells.push({
                columnId: columnMap[column.title],
                value
            });
        }
    }
    if (cells.length === 0) return;

    await getClientForDept('PL').post(`sheets/${PORTAL_USAGE_LOG_SHEET_ID}/rows`, [{
        toTop: true,
        cells
    }]);
}

// Middleware
app.use(cors({ origin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',') }));
app.use(helmet({ contentSecurityPolicy: false })); // CSP off — HTML files use inline scripts
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: true }));

// Serve static frontend files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Sheet IDs (from .env)
const EMPLOYEE_SCHEDULE_SHEET_ID = getRequiredEnv('DEPT_PL_CONFIG_SHEET_ID');
const DEFECT_SEEDS_SHEET_ID = getRequiredEnv('DEPT_PL_DEFECT_SEEDS_SHEET_ID');
const MASTER_LOG_SHEET_ID = getRequiredEnv('DEPT_PL_MASTER_LOG_SHEET_ID');

// ==========================================
// MASTER LOG COLUMN MAP
// ==========================================

// Maps payload key → Smartsheet column ID for the Master Log sheet.
// Defect columns that were added dynamically via the admin panel are persisted
// in data/defect_columns.json and merged in at startup.

const MASTER_LOG_COLUMN_MAP = {
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
    // Defects (all hyphen format)
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
    'Defect-Waviness': 8343573153664900,
};

// Dynamic defect column persistence
const DEFECT_COLUMNS_PATH = path.join(__dirname, 'data', 'defect_columns.json');

function loadDynamicDefectColumns(dept = 'PL') {
    try {
        if (fs.existsSync(DEFECT_COLUMNS_PATH)) {
            const data = JSON.parse(fs.readFileSync(DEFECT_COLUMNS_PATH, 'utf8'));
            return data[dept] || {};
        }
    } catch (e) {
        console.error('Failed to load defect_columns.json:', e.message);
    }
    return {};
}

function saveDynamicDefectColumns(deptColumns, dept = 'PL') {
    try {
        let data = {};
        if (fs.existsSync(DEFECT_COLUMNS_PATH)) {
            data = JSON.parse(fs.readFileSync(DEFECT_COLUMNS_PATH, 'utf8'));
        }
        data[dept] = deptColumns;
        fs.writeFileSync(DEFECT_COLUMNS_PATH, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error('Failed to save defect_columns.json:', e.message);
    }
}

// Merge any dynamically created defect columns into the map at startup
Object.assign(MASTER_LOG_COLUMN_MAP, loadDynamicDefectColumns('PL'));

async function createDefectColumn(defectName) {
    const columnTitle = 'Defect-' + defectName.trim();
    if (MASTER_LOG_COLUMN_MAP[columnTitle]) return; // already mapped

    // Insert after the last existing Defect- column; fall back to end of sheet
    const sheetRes = await smartsheetApi.get(`sheets/${MASTER_LOG_SHEET_ID}?include=columns`);
    const columns = sheetRes.data.columns;
    const defectCols = columns.filter(c => c.title.startsWith('Defect-'));
    const insertAfter = defectCols.length > 0
        ? Math.max(...defectCols.map(c => c.index))
        : Math.max(...columns.map(c => c.index));

    const createRes = await smartsheetApi.post(`sheets/${MASTER_LOG_SHEET_ID}/columns`, [{
        title: columnTitle,
        type: 'TEXT_NUMBER',
        index: insertAfter + 1
    }]);

    const newColumnId = createRes.data.result[0].id;
    MASTER_LOG_COLUMN_MAP[columnTitle] = newColumnId;

    const dynamic = loadDynamicDefectColumns('PL');
    dynamic[columnTitle] = newColumnId;
    saveDynamicDefectColumns(dynamic, 'PL');

    console.log(`Created Smartsheet column "${columnTitle}" (ID: ${newColumnId})`);
}

// ==========================================
// API ENDPOINTS
// ==========================================

// CONFIG_COLUMN_MAP and MASTER_CONFIG_SHEET_ID imported from lib/config.js
const MASTER_CONFIG_SHEET_ID = CONFIG_SHEET_ID;

// Admin session store: token -> { name, expires }
const adminSessions = new Map();

// Config sheet cache — avoids hitting Smartsheet on every login request.
// Populated on first login, expires after 5 minutes, invalidated on password changes.
let _configCache = null;
let _configCacheTime = 0;
const CONFIG_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const TEST_ACCOUNTS = ['test-pl', 'test-ptfe', 'test-pi', 'test-pl-super', 'test-ptfe-super', 'test-pi-super'];
const TEST_ACCOUNT_DETAILS = {
    'test-pl':       { departmentKey: 'PL',   department: 'PrecisionLiner', role: 'Associate' },
    'test-ptfe':     { departmentKey: 'PTFE', department: 'PTFE',           role: 'Associate' },
    'test-pi':       { departmentKey: 'PI',   department: 'Polyimide',      role: 'Associate' },
    'test-pl-super': { departmentKey: 'PL',   department: 'PrecisionLiner', role: 'Supervisor' },
    'test-ptfe-super':{ departmentKey: 'PTFE',department: 'PTFE',           role: 'Supervisor' },
    'test-pi-super': { departmentKey: 'PI',   department: 'Polyimide',      role: 'Supervisor' }
};

const KIOSK_LOCK_TTL_MS = Number(process.env.KIOSK_LOCK_TTL_MS || 18 * 60 * 60 * 1000);
const activeKioskLocks = new Map();

function getKioskLockKey(dept, associate) {
    return `${normalizeDept(dept)}::${String(associate || '').trim().toLowerCase()}`;
}

function getKioskLabel(kioskId) {
    const text = String(kioskId || '').trim();
    return text ? `kiosk ${text.slice(-6)}` : 'another kiosk';
}

function pruneKioskLocks(now = Date.now()) {
    for (const [key, lock] of activeKioskLocks.entries()) {
        if ((now - lock.updatedAt) > KIOSK_LOCK_TTL_MS) {
            activeKioskLocks.delete(key);
        }
    }
}

function reserveKioskLock({ dept, associate, kioskId, role }) {
    const departmentKey = normalizeDept(dept);
    const associateName = String(associate || '').trim();
    const kiosk = String(kioskId || '').trim();
    if (!associateName || !kiosk) return { ok: true };
    if (role === 'Supervisor' || TEST_ACCOUNTS.includes(associateName)) return { ok: true };

    const now = Date.now();
    pruneKioskLocks(now);
    const key = getKioskLockKey(departmentKey, associateName);
    const existing = activeKioskLocks.get(key);
    if (existing && existing.kioskId !== kiosk) {
        return {
            ok: false,
            error: `${associateName} is already signed in on ${getKioskLabel(existing.kioskId)}. End Shift or Exit Without Submitting there first, or ask a supervisor to release the stale session.`,
            lock: existing
        };
    }

    activeKioskLocks.set(key, {
        dept: departmentKey,
        associate: associateName,
        kioskId: kiosk,
        startedAt: existing?.startedAt || now,
        updatedAt: now
    });
    return { ok: true };
}

function releaseKioskLock({ dept, associate, kioskId, force = false }) {
    const associateName = String(associate || '').trim();
    if (!associateName) return false;
    const key = getKioskLockKey(dept, associateName);
    const existing = activeKioskLocks.get(key);
    if (!existing) return false;
    if (!force && (!kioskId || existing.kioskId !== kioskId)) return false;
    activeKioskLocks.delete(key);
    return true;
}

async function getCachedConfigSheet(dept = 'PL') {
    const key = normalizeDept(dept);
    const now = Date.now();
    if (!_configCache) _configCache = {};
    if (!_configCacheTime) _configCacheTime = {};
    if (_configCache[key] && (now - _configCacheTime[key]) < CONFIG_CACHE_TTL) {
        return _configCache[key];
    }
    const response = await getClientForDept(key).get(`sheets/${getConfigSheetId(key)}`);
    _configCache[key] = response.data;
    _configCacheTime[key] = now;
    return _configCache[key];
}

function requireAdmin(req, res, next) {
    const token = req.headers['x-admin-token'];
    const session = token && adminSessions.get(token);
    if (!session || session.expires < Date.now()) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    let requestedDept;
    try {
        requestedDept = normalizeDept(req.body?.dept || req.query?.dept || session.deptKey || 'PL');
    } catch (error) {
        return res.status(400).json({ success: false, error: error.message });
    }

    if (!['PL', 'PTFE', 'PI'].includes(requestedDept)) {
        return res.status(403).json({ success: false, error: 'Admin access is not enabled for this department.' });
    }

    if ((session.deptKey || 'PL') !== requestedDept) {
        return res.status(403).json({ success: false, error: 'Admin session is not valid for this department.' });
    }
    next();
}

app.use('/api/admin', requireAdmin);

// 1. Fetch Unified Config for Dropdowns and Admin Portal
app.get('/api/config', async (req, res) => {
    try {
        const dept = normalizeDept(req.query.dept || 'PL');
        const data = await fetchConfigData(null, dept, {
            includeSupplemental: req.query.scope !== 'login'
        });
        res.json({ success: true, data });
    } catch (error) {
        console.error("Error fetching master config:", error.response?.data || error.message);
        res.status(500).json({ success: false, error: 'Failed to fetch config' });
    }
});

// 2. Admin POST Route to save Config changes
app.post('/api/admin/config/save', async (req, res) => {
    try {
        const { type, items, dept: deptParam } = req.body;
        const dept = normalizeDept(deptParam || 'PL');

        // ── PTFE branch ─────────────────────────────────────────────────────────
        if (['PTFE', 'PI'].includes(dept)) {
            if (type === 'standards') {
                const invalidStandard = (items || []).find(item => {
                    const itemNumber = String(item.item || '').trim();
                    return !item.id && itemNumber && !isSixDigitItemNumber(itemNumber);
                });
                if (invalidStandard) {
                    return res.status(400).json({
                        success: false,
                        error: `Standards item ${invalidStandard.item} must be exactly six digits.`
                    });
                }
            }

            const deptClient = getClientForDept(dept);
            const deptConfig = getDepartmentConfig(dept);
            let sheetId;
            if (type === 'standards') {
                sheetId = getRequiredEnv(deptConfig.standardsSheetEnv);
            } else if (type === 'items') {
                sheetId = getRequiredEnv(deptConfig.itemsSheetEnv);
            } else {
                sheetId = getConfigSheetId(dept);
            }
            const sheetRes = await deptClient.get(`sheets/${sheetId}`);
            const colMap = buildColumnMap(sheetRes.data);
            let reusableColumns = [];
            if (type === 'standards') {
                reusableColumns = ['Item', 'Sequence', 'Good PPH Std', 'Total PPH Std'].map(title => colMap[title]).filter(Boolean);
            } else if (type === 'items') {
                reusableColumns = ['Item', 'FG Length (in)', 'Product Family', 'Unit Of Measure'].map(title => colMap[title]).filter(Boolean);
            }

            const toUpdate = [], toAdd = [], pendingAdds = [];
            items.forEach(item => {
                let cells = [];
                if (type === 'associates') {
                    cells = [
                        { columnId: colMap['Associate Name'], value: item.name },
                        { columnId: colMap['Cell'],           value: item.Cell || '', strict: false },
                        { columnId: colMap['Scheduled Minutes'], value: toSmartsheetWholeNumber(item.ScheduledMinutes) },
                        { columnId: colMap['Mon'],            value: toSmartsheetWholeNumber(item.Mon) },
                        { columnId: colMap['Tue'],            value: toSmartsheetWholeNumber(item.Tue) },
                        { columnId: colMap['Wed'],            value: toSmartsheetWholeNumber(item.Wed) },
                        { columnId: colMap['Thur'] || colMap['Thurs'], value: toSmartsheetWholeNumber(item.Thur) },
                        { columnId: colMap['Fri'],            value: toSmartsheetWholeNumber(item.Fri) },
                        { columnId: colMap['Sat'],            value: toSmartsheetWholeNumber(item.Sat) },
                        { columnId: colMap['Sun'],            value: toSmartsheetWholeNumber(item.Sun) },
                        { columnId: colMap['Training?'],      value: item.Training || false },
                        { columnId: colMap['Role'],           value: item.Role || 'Associate' }
                    ].filter(c => c.columnId);
                } else if (type === 'sequences') {
                    cells = [
                        { columnId: colMap['Sequences'],       value: (item.name || '').trim() },
                        { columnId: colMap['Sequence Goals'],  value: toSmartsheetWholeNumber(item.goal) }
                    ].filter(c => c.columnId);
                } else if (type === 'events') {
                    cells = [{ columnId: colMap['Events'], value: (item.name || '').trim() }].filter(c => c.columnId);
                } else if (type === 'inspectionPareto') {
                    cells = [{ columnId: colMap['Inspection Pareto'], value: (item.name || '').trim() }].filter(c => c.columnId);
                } else if (type === 'pullingPareto') {
                    cells = [{ columnId: colMap['Pulling Pareto'], value: (item.name || '').trim() }].filter(c => c.columnId);
                } else if (type === 'pullingMethod') {
                    cells = [{ columnId: colMap['Pulling Method'], value: (item.name || '').trim() }].filter(c => c.columnId);
                } else if (type === 'standards') {
                    cells = [
                        { columnId: colMap['Item'],          value: (item.item || '').trim(), strict: false },
                        { columnId: colMap['Sequence'],      value: (item.sequence || '').trim(), strict: false },
                        { columnId: colMap['Good PPH Std'],  value: toSmartsheetWholeNumber(item.goodPphStd) },
                        { columnId: colMap['Total PPH Std'], value: toSmartsheetWholeNumber(item.totalPphStd) }
                    ].filter(c => c.columnId);
                } else if (type === 'items') {
                    cells = [
                        { columnId: colMap['Item'],          value: (item.item || '').trim(), strict: false },
                        { columnId: colMap['FG Length (in)'],value: toSmartsheetNumber(item.fgLength) },
                        { columnId: colMap['Product Family'],value: (item.productFamily || '').trim() },
                        { columnId: colMap['Unit Of Measure'],value: (item.unitOfMeasure || '').trim() }
                    ].filter(c => c.columnId);
                }
                if (item.id) {
                    toUpdate.push({ id: item.id, cells });
                } else {
                    pendingAdds.push({ toBottom: true, cells });
                }
            });
            if (pendingAdds.length > 0 && reusableColumns.length > 0) {
                const reusableBlock = findFirstBlankRowBlock(sheetRes.data.rows, reusableColumns, pendingAdds.length);
                if (reusableBlock.length === pendingAdds.length) {
                    pendingAdds.forEach((row, index) => {
                        toUpdate.push({ id: reusableBlock[index].id, cells: row.cells });
                    });
                } else {
                    toAdd.push(...pendingAdds);
                }
            } else {
                toAdd.push(...pendingAdds);
            }
            for (const rows of chunkArray(toUpdate)) {
                await deptClient.put(`sheets/${sheetId}/rows`, rows);
            }
            for (const rows of chunkArray(toAdd)) {
                await deptClient.post(`sheets/${sheetId}/rows`, rows);
            }
            return res.json({ success: true, message: `Successfully saved ${type}` });
        }
        // ── End PTFE branch ──────────────────────────────────────────────────────

        // Fetch current sheet to find "holes" (empty slots) for list-type items
        let availableRows = [];
        if (type !== 'associates') {
            const sheetRes = await smartsheetApi.get(`sheets/${MASTER_CONFIG_SHEET_ID}`);
            const colId = (type === 'sequences') ? CONFIG_COLUMN_MAP['Sequences'] :
                (type === 'defects') ? CONFIG_COLUMN_MAP['Defects'] :
                    CONFIG_COLUMN_MAP['Events'];

            // Collect IDs already being updated so we don't try to double-fill them
            const idsInItems = new Set(items.filter(i => i.id).map(i => i.id));

            availableRows = sheetRes.data.rows.filter(row => {
                if (idsInItems.has(row.id)) return false;
                const cell = row.cells.find(c => c.columnId === colId);
                return !cell || cell.value === undefined || cell.value === null || cell.value === "";
            });
        }

        const toUpdate = [];
        const toAdd = [];

        items.forEach(item => {
            let cells = [];
            if (type === 'associates') {
                cells.push({ columnId: CONFIG_COLUMN_MAP['Associate Name'], value: item.name });
                cells.push({ columnId: CONFIG_COLUMN_MAP['Mon'],  value: Number(item.Mon)  || 0 });
                cells.push({ columnId: CONFIG_COLUMN_MAP['Tue'],  value: Number(item.Tue)  || 0 });
                cells.push({ columnId: CONFIG_COLUMN_MAP['Wed'],  value: Number(item.Wed)  || 0 });
                cells.push({ columnId: CONFIG_COLUMN_MAP['Thur'], value: Number(item.Thur) || 0 });
                cells.push({ columnId: CONFIG_COLUMN_MAP['Fri'],  value: Number(item.Fri)  || 0 });
                cells.push({ columnId: CONFIG_COLUMN_MAP['Sat'],  value: Number(item.Sat)  || 0 });
                cells.push({ columnId: CONFIG_COLUMN_MAP['Sun'],  value: Number(item.Sun)  || 0 });
                cells.push({ columnId: CONFIG_COLUMN_MAP['Training?'], value: item.Training });
                cells.push({ columnId: CONFIG_COLUMN_MAP['Role'], value: item.Role || 'Associate' });
            } else if (type === 'sequences') {
                cells.push({ columnId: CONFIG_COLUMN_MAP['Sequences'], value: (item.name || '').trim() });
                cells.push({ columnId: CONFIG_COLUMN_MAP['Sequence Goals'], value: Number(item.goal) || 0 });
            } else if (type === 'defects') {
                cells.push({ columnId: CONFIG_COLUMN_MAP['Defects'], value: (item.name || '').trim() });
            } else if (type === 'events') {
                cells.push({ columnId: CONFIG_COLUMN_MAP['Events'], value: (item.name || '').trim() });
            }

            if (item.id) {
                toUpdate.push({ id: item.id, cells });
            } else {
                // If we found a row with an empty slot, use it. Otherwise, add to bottom.
                if (availableRows.length > 0) {
                    const row = availableRows.shift();
                    toUpdate.push({ id: row.id, cells });
                } else {
                    toAdd.push({ toBottom: true, cells });
                }
            }
        });

        if (toUpdate.length > 0) {
            await smartsheetApi.put(`sheets/${MASTER_CONFIG_SHEET_ID}/rows`, toUpdate);
        }
        if (toAdd.length > 0) {
            await smartsheetApi.post(`sheets/${MASTER_CONFIG_SHEET_ID}/rows`, toAdd);
        }

        // Auto-create Master Log columns for any new defects
        if (type === 'defects') {
            const newDefects = items.filter(i => !i.id && i.name);
            await Promise.all(newDefects.map(async i => {
                try { await createDefectColumn(i.name); }
                catch (e) { console.error(`Failed to create column for "${i.name}":`, e.response?.data || e.message); }
            }));
        }

        res.json({ success: true, message: `Successfully saved ${type}` });
    } catch (error) {
        console.error("Error saving config:", error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ success: false, error: smartsheetErrorMessage(error) });
    }
});

// 3. Admin DELETE Route to remove Config rows
app.post('/api/admin/config/delete', async (req, res) => {
    try {
        const { rowId, type, dept: deptParam } = req.body;
        if (!rowId || !type) return res.status(400).json({ success: false, error: 'Row ID and type required' });
        const dept = normalizeDept(deptParam || 'PL');

        // ── PTFE branch ─────────────────────────────────────────────────────────
        if (['PTFE', 'PI'].includes(dept)) {
            const deptClient = getClientForDept(dept);
            const deptConfig = getDepartmentConfig(dept);
            let sheetId;
            if (type === 'standards') {
                sheetId = getRequiredEnv(deptConfig.standardsSheetEnv);
            } else if (type === 'items') {
                sheetId = getRequiredEnv(deptConfig.itemsSheetEnv);
            } else {
                sheetId = getConfigSheetId(dept);
            }
            const sheetRes = await deptClient.get(`sheets/${sheetId}`);
            const colMap = buildColumnMap(sheetRes.data);

            if (type === 'standards' || type === 'items') {
                await deptClient.delete(`sheets/${sheetId}/rows`, {
                    params: {
                        ids: rowId,
                        ignoreRowsNotFound: true
                    }
                });
                return res.json({ success: true, message: 'Item deleted successfully' });
            }

            let cells = [];
            if (type === 'associates') {
                cells = ['Associate Name', 'Cell', 'Scheduled Minutes', 'Mon', 'Tue', 'Wed', 'Thur', 'Fri', 'Sat', 'Sun', 'Training?', 'Role', 'Password Hash']
                    .filter(col => colMap[col])
                    .map(col => ({ columnId: colMap[col], value: col === 'Training?' ? false : '' }));
                const thurCol = colMap['Thurs'];
                if (thurCol && !colMap['Thur']) cells.push({ columnId: thurCol, value: '' });
            } else if (type === 'sequences') {
                cells = ['Sequences', 'Sequence Goals'].filter(c => colMap[c]).map(c => ({ columnId: colMap[c], value: '' }));
            } else if (type === 'events') {
                if (colMap['Events']) cells = [{ columnId: colMap['Events'], value: '' }];
            } else if (type === 'inspectionPareto') {
                if (colMap['Inspection Pareto']) cells = [{ columnId: colMap['Inspection Pareto'], value: '' }];
            } else if (type === 'pullingPareto') {
                if (colMap['Pulling Pareto']) cells = [{ columnId: colMap['Pulling Pareto'], value: '' }];
            } else if (type === 'pullingMethod') {
                if (colMap['Pulling Method']) cells = [{ columnId: colMap['Pulling Method'], value: '' }];
            } else if (type === 'standards') {
                cells = ['Item', 'Sequence', 'Good PPH Std', 'Total PPH Std'].filter(c => colMap[c]).map(c => ({ columnId: colMap[c], value: '' }));
            } else if (type === 'items') {
                cells = ['Item', 'FG Length (in)', 'Product Family', 'Unit Of Measure'].filter(c => colMap[c]).map(c => ({ columnId: colMap[c], value: '' }));
            }
            if (cells.length > 0) await deptClient.put(`sheets/${sheetId}/rows`, [{ id: rowId, cells }]);
            return res.json({ success: true, message: 'Item deleted successfully' });
        }
        // ── End PTFE branch ──────────────────────────────────────────────────────

        const cells = [];
        if (type === 'associates') {
            cells.push(
                { columnId: CONFIG_COLUMN_MAP['Associate Name'], value: "" },
                { columnId: CONFIG_COLUMN_MAP['Mon'], value: "" },
                { columnId: CONFIG_COLUMN_MAP['Tue'], value: "" },
                { columnId: CONFIG_COLUMN_MAP['Wed'], value: "" },
                { columnId: CONFIG_COLUMN_MAP['Thur'], value: "" },
                { columnId: CONFIG_COLUMN_MAP['Fri'], value: "" },
                { columnId: CONFIG_COLUMN_MAP['Sat'], value: "" },
                { columnId: CONFIG_COLUMN_MAP['Sun'], value: "" },
                { columnId: CONFIG_COLUMN_MAP['Training?'], value: false },
                { columnId: CONFIG_COLUMN_MAP['Role'], value: "" },
                { columnId: CONFIG_COLUMN_MAP['Password Hash'], value: "" }
            );
        } else if (type === 'sequences') {
            cells.push(
                { columnId: CONFIG_COLUMN_MAP['Sequences'], value: "" },
                { columnId: CONFIG_COLUMN_MAP['Sequence Goals'], value: "" }
            );
        } else if (type === 'defects') {
            cells.push({ columnId: CONFIG_COLUMN_MAP['Defects'], value: "" });
        } else if (type === 'events') {
            cells.push({ columnId: CONFIG_COLUMN_MAP['Events'], value: "" });
        }

        await smartsheetApi.put(`sheets/${MASTER_CONFIG_SHEET_ID}/rows`, [{
            id: rowId,
            cells: cells
        }]);

        res.json({ success: true, message: 'Item deleted successfully' });
    } catch (error) {
        console.error("Error deleting item:", error.response?.data || error.message);
        res.status(500).json({ success: false, error: 'Failed to delete item' });
    }
});

// 4. Authentication Endpoints
app.post('/api/login', async (req, res) => {
    try {
        const { username, password, department, kioskId } = req.body;
        if (!username) return res.status(400).json({ success: false, error: 'Username required' });

        const requestedDept = normalizeDept(department || TEST_ACCOUNT_DETAILS[username]?.departmentKey || 'PL');
        if (TEST_ACCOUNT_DETAILS[username]) {
            const testAccount = TEST_ACCOUNT_DETAILS[username];
            if (testAccount.departmentKey !== requestedDept) {
                return res.json({ success: false, error: 'Training account belongs to another department' });
            }
            if (password !== 'trenton1') {
                return res.json({ success: false, error: 'Incorrect password' });
            }
            const lock = reserveKioskLock({
                dept: testAccount.departmentKey,
                associate: username,
                kioskId,
                role: testAccount.role
            });
            if (!lock.ok) return res.status(409).json({ success: false, error: lock.error, lock: lock.lock });
            const testResponse = {
                success: true,
                user: {
                    name: username,
                    role: testAccount.role,
                    departmentKey: testAccount.departmentKey,
                    department: testAccount.department
                }
            };
            if (testAccount.role === 'Supervisor' && ['PL', 'PTFE', 'PI'].includes(testAccount.departmentKey)) {
                const token = crypto.randomUUID();
                adminSessions.set(token, { name: username, deptKey: testAccount.departmentKey, expires: Date.now() + 8 * 60 * 60 * 1000 });
                testResponse.adminToken = token;
            }
            return res.json(testResponse);
        }

        const sheetData = await getCachedConfigSheet(requestedDept);
        const columnMap = buildColumnMap(sheetData);
        const departmentConfig = getDepartmentConfig(requestedDept);

        let targetRow = null;
        let pHash = '';
        let role = 'Associate';

        for (let row of sheetData.rows) {
            const name = getCellByTitle(row, columnMap, 'Associate Name');
            if (name === username) {
                targetRow = row;
                pHash = getCellByTitle(row, columnMap, 'Password Hash') || '';
                role = getCellByTitle(row, columnMap, 'Role') || 'Associate';
                break;
            }
        }

        if (!targetRow) return res.json({ success: false, error: 'Associate not found' });

        if (!pHash || pHash.trim() === '') {
            // No password exists yet, requires setup
            return res.json({ success: true, requireSetup: true });
        }

        // Compare hash
        const isMatch = await bcrypt.compare(password, pHash);
        if (isMatch) {
            const lock = reserveKioskLock({
                dept: departmentConfig.key,
                associate: username,
                kioskId,
                role
            });
            if (!lock.ok) return res.status(409).json({ success: false, error: lock.error, lock: lock.lock });
            const response = {
                success: true,
                user: {
                    name: username,
                    role,
                    departmentKey: departmentConfig.key,
                    department: departmentConfig.displayName
                }
            };
            if (role === 'Supervisor' && ['PL', 'PTFE', 'PI'].includes(departmentConfig.key)) {
                const token = crypto.randomUUID();
                adminSessions.set(token, { name: username, deptKey: departmentConfig.key, expires: Date.now() + 8 * 60 * 60 * 1000 });
                response.adminToken = token;
            }
            logPortalUsage({
                eventType: 'login_success',
                department: departmentConfig.key,
                associateName: username,
                role,
                kioskId
            });
            res.json(response);
        } else {
            res.json({ success: false, error: 'Incorrect password' });
        }
    } catch (error) {
        console.error("Error logging in:", error);
        res.status(500).json({ success: false, error: 'Server error during login' });
    }
});

app.post('/api/setup-password', async (req, res) => {
    try {
        const { username, newPassword, department, kioskId } = req.body;
        if (!username || !newPassword) return res.status(400).json({ success: false, error: 'Missing parameters' });
        const requestedDept = normalizeDept(department || 'PL');
        const client = getClientForDept(requestedDept);
        const configSheetId = getConfigSheetId(requestedDept);

        // Retrieve row to get ID
        const response = await client.get(`sheets/${configSheetId}`);
        const columnMap = buildColumnMap(response.data);
        const targetRow = response.data.rows.find(row => {
            const name = getCellByTitle(row, columnMap, 'Associate Name');
            return name === username;
        });

        if (!targetRow) return res.json({ success: false, error: 'Associate not found' });

        // Hash the new password
        const salt = await bcrypt.genSalt(10);
        const hashed = await bcrypt.hash(newPassword, salt);

        // Update Smartsheet
        await client.put(`sheets/${configSheetId}/rows`, [{
            id: targetRow.id,
            cells: [{ columnId: columnMap['Password Hash'], value: hashed }]
        }]);

        // Invalidate config cache so the new password hash is picked up on next login
        if (_configCache) _configCache[requestedDept] = null;

        const role = getCellByTitle(targetRow, columnMap, 'Role') || 'Associate';
        const deptConfig = getDepartmentConfig(requestedDept);
        const lock = reserveKioskLock({
            dept: deptConfig.key,
            associate: username,
            kioskId,
            role
        });
        if (!lock.ok) return res.status(409).json({ success: false, error: lock.error, lock: lock.lock });
        const setupResponse = {
            success: true,
            message: 'Password saved',
            user: {
                name: username,
                role,
                departmentKey: deptConfig.key,
                department: deptConfig.displayName
            }
        };
        if (role === 'Supervisor' && ['PL', 'PTFE', 'PI'].includes(deptConfig.key)) {
            const token = crypto.randomUUID();
            adminSessions.set(token, { name: username, deptKey: deptConfig.key, expires: Date.now() + 8 * 60 * 60 * 1000 });
            setupResponse.adminToken = token;
        }
        res.json(setupResponse);
    } catch (error) {
        console.error("Error setting password:", error);
        res.status(500).json({ success: false, error: 'Failed to update password' });
    }
});

app.post('/api/kiosk-lock/release', (req, res) => {
    try {
        const { username, department, kioskId } = req.body || {};
        const released = releaseKioskLock({
            dept: department || 'PL',
            associate: username,
            kioskId
        });
        res.json({ success: true, released });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

app.post('/api/admin/reset-password', async (req, res) => {
    try {
        const { rowId, dept: deptParam } = req.body;
        if (!rowId) return res.status(400).json({ success: false, error: 'Row ID required' });
        const dept = normalizeDept(deptParam || 'PL');

        if (dept === 'PL') {
            // PL: use existing hardcoded path
            await smartsheetApi.put(`sheets/${MASTER_CONFIG_SHEET_ID}/rows`, [{
                id: rowId,
                cells: [{ columnId: CONFIG_COLUMN_MAP['Password Hash'], value: "" }]
            }]);
        } else {
            // Other depts: build column map from live sheet
            const client = getClientForDept(dept);
            const sheetId = getConfigSheetId(dept);
            const sheetRes = await client.get(`sheets/${sheetId}`);
            const colMap = buildColumnMap(sheetRes.data);
            if (!colMap['Password Hash']) throw new Error('Password Hash column not found in config sheet');
            await client.put(`sheets/${sheetId}/rows`, [{
                id: rowId,
                cells: [{ columnId: colMap['Password Hash'], value: "" }]
            }]);
        }

        res.json({ success: true, message: 'Password reset' });
    } catch (error) {
        console.error("Error resetting password:", error);
        res.status(500).json({ success: false, error: 'Failed to reset password' });
    }
});

app.get('/api/admin/kiosk-locks', (req, res) => {
    pruneKioskLocks();
    res.json({ success: true, locks: [...activeKioskLocks.values()] });
});

app.post('/api/admin/kiosk-locks/release', (req, res) => {
    try {
        const { username, department } = req.body || {};
        const released = releaseKioskLock({
            dept: department || req.body?.dept || 'PL',
            associate: username,
            force: true
        });
        res.json({ success: true, released });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

// 3. Handle Form Submissions (Master Log)
app.post('/api/submit', async (req, res) => {
    let submissionKey = null;
    try {
        const data = req.body;
        const dept = normalizeDept(data.department || data.departmentKey || 'PL');
        if (dept === 'PTFE') {
            return submitPtfe(req, res);
        }
        if (dept === 'PI') {
            return submitPi(req, res);
        }

        if (!validateItemNumberPayload(data)) {
            return res.status(400).json({ success: false, error: 'Item number must be exactly six digits.' });
        }

        // --- TEST ACCOUNT INTERCEPTION ---
        if (TEST_ACCOUNTS.includes(data['Associate Name'])) {
            console.log(`[TEST MODE] Intercepted Master Log submission for ${data['Associate Name']}. Bypassing Smartsheet.`);
            return res.json({ success: true, message: "[TEST MODE] Successfully simulated logging data to Smartsheet.", data: [] });
        }
        // ---------------------------------

        // Use module-level MASTER_LOG_COLUMN_MAP (includes dynamically created defect columns)
        const COLUMN_MAP = MASTER_LOG_COLUMN_MAP;
        const columnTypes = await getMasterLogColumnTypes('PL');
        const clientSubmissionId = String(data.clientSubmissionId || '').trim().slice(0, 100);
        const clientSubmissionAttempt = Math.max(1, toSmartsheetWholeNumber(data.clientSubmissionAttempt, 1));

        // Construct the row object for Smartsheet
        const newRow = {
            toTop: true, // Add to the top of the sheet
            cells: []
        };
        const submittedEntries = [];

        // Iterate through the payload and map to columns if it exists
        for (const [key, value] of Object.entries(data)) {
            if (COLUMN_MAP[key] && value !== undefined && value !== null && value !== '') {
                const parsedValue = parseMasterLogCellValue(key, value);

                const cell = buildMasterLogCell(key, COLUMN_MAP[key], parsedValue, columnTypes[key]);
                if (cell) newRow.cells.push(cell);
                submittedEntries.push([key, parsedValue]);
            }
        }

        const submissionIdColumn = await addSubmissionIdCell(newRow, 'PL', clientSubmissionId);
        const retryKey = buildSubmissionKey('PL', submittedEntries, clientSubmissionId);
        pruneRecentMasterLogSubmissions();
        const priorReservation = recentMasterLogSubmissions.get(retryKey);
        if (clientSubmissionId && clientSubmissionAttempt > 1) {
            if (priorReservation?.status === 'pending') {
                return res.status(409).json({
                    success: false,
                    pending: true,
                    error: 'The original submission is still being processed. Wait a few seconds and try again.'
                });
            }
            if (await masterLogHasSubmissionId('PL', submissionIdColumn, clientSubmissionId)) {
                finishMasterLogSubmission(retryKey, true);
                return res.json({
                    success: true,
                    duplicate: true,
                    message: 'This PL submission was already saved. No duplicate row was added.',
                    data: []
                });
            }
            recentMasterLogSubmissions.delete(retryKey);
        }

        const reservation = reserveMasterLogSubmission('PL', submittedEntries, clientSubmissionId);
        submissionKey = reservation.key;
        if (reservation.duplicate) {
            return res.json({
                success: true,
                duplicate: true,
                message: 'Duplicate PL submission ignored because an identical row was already submitted recently.',
                data: []
            });
        }

        await addSubmissionSourceCell(newRow, 'PL');

        // Send the payload to the Master Log Sheet
        const response = await smartsheetApi.post(`sheets/${MASTER_LOG_SHEET_ID}/rows`, [newRow]);
        finishMasterLogSubmission(submissionKey, true);
        logPortalUsage({
            eventType: 'master_log_submit',
            department: 'PL',
            associateName: data['Associate Name'],
            details: data['Entry Type'] || data.Sequence || ''
        });

        res.json({ success: true, message: "Successfully logged data to Smartsheet.", data: response.data });

    } catch (error) {
        if (submissionKey) finishMasterLogSubmission(submissionKey, error.response ? false : 'unknown');
        console.error("Error submitting to Smartsheet:", error.response?.data || error.message);
        if (error.code === 'ECONNABORTED') {
            return res.status(504).json({ success: false, error: 'Smartsheet timed out. Please try again.' });
        }
        if (error.response?.status === 429) {
            return res.status(429).json({ success: false, error: 'Smartsheet is rate limited. Please wait a moment and try again.' });
        }
        res.status(500).json({ success: false, error: 'Failed to submit data.' });
    }
});

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

let _ptfeMasterLogColumnMap = null;

async function getPtfeMasterLogColumnMap() {
    if (_ptfeMasterLogColumnMap) return _ptfeMasterLogColumnMap;
    const client = getClientForDept('PTFE');
    const sheetId = getRequiredEnv('DEPT_PTFE_MASTER_LOG_SHEET_ID');
    const response = await client.get(`sheets/${sheetId}?include=columns`);
    const allColumns = buildColumnMap(response.data);
    _ptfeMasterLogColumnMap = PTFE_MASTER_LOG_WRITE_TITLES.reduce((map, title) => {
        if (allColumns[title]) {
            map[title] = allColumns[title];
        }
        return map;
    }, {});
    return _ptfeMasterLogColumnMap;
}

async function submitPtfe(req, res) {
    let submissionKey = null;
    try {
        const data = req.body;
        let dept = 'PTFE';
        try {
            dept = normalizeDept(data.department || data.departmentKey || 'PTFE');
        } catch (e) {
            return res.status(400).json({ success: false, error: e.message });
        }
        if (dept !== 'PTFE') {
            return res.status(400).json({ success: false, error: 'Invalid department for PTFE submission.' });
        }

        if (!validateItemNumberPayload(data)) {
            return res.status(400).json({ success: false, error: 'Item number must be exactly six digits.' });
        }

        if (TEST_ACCOUNTS.includes(data['Associate Name'])) {
            console.log(`[TEST MODE] Intercepted PTFE Master Log submission for ${data['Associate Name']}. Bypassing Smartsheet.`);
            return res.json({ success: true, message: "[TEST MODE] Successfully simulated PTFE logging to Smartsheet.", data: [] });
        }

        if (!isEnvTrue('ALLOW_PTFE_MASTER_LOG_WRITES')) {
            return res.json({
                success: true,
                simulated: true,
                message: "[SAFE MODE] PTFE submission simulated. Set ALLOW_PTFE_MASTER_LOG_WRITES=true to enable PTFE Master Log writes.",
                data: []
            });
        }

        const columnMap = await getPtfeMasterLogColumnMap();
        const columnTypes = await getMasterLogColumnTypes('PTFE');
        const newRow = { toTop: true, cells: [] };
        const submittedEntries = [];

        for (const title of PTFE_MASTER_LOG_WRITE_TITLES) {
            const value = parseMasterLogCellValue(title, data[title]);
            if (columnMap[title] && value !== undefined && value !== null && value !== '') {
                const cell = buildMasterLogCell(title, columnMap[title], value, columnTypes[title]);
                if (cell) newRow.cells.push(cell);
                submittedEntries.push([title, value]);
            }
        }

        if (newRow.cells.length === 0) {
            return res.status(400).json({ success: false, error: 'No PTFE fields to submit.' });
        }

        const reservation = reserveMasterLogSubmission('PTFE', submittedEntries);
        submissionKey = reservation.key;
        if (reservation.duplicate) {
            return res.json({
                success: true,
                duplicate: true,
                message: 'Duplicate PTFE submission ignored because an identical row was already submitted recently.',
                data: []
            });
        }

        await addSubmissionSourceCell(newRow, 'PTFE');

        const response = await getClientForDept('PTFE').post(`sheets/${getRequiredEnv('DEPT_PTFE_MASTER_LOG_SHEET_ID')}/rows`, [newRow]);
        finishMasterLogSubmission(submissionKey, true);
        logPortalUsage({
            eventType: 'master_log_submit',
            department: 'PTFE',
            associateName: data['Associate Name'],
            details: data['Entry Type'] || data.Sequence || ''
        });
        return res.json({ success: true, message: "Successfully logged PTFE data to Smartsheet.", data: response.data });
    } catch (error) {
        if (submissionKey) finishMasterLogSubmission(submissionKey, false);
        const smartsheetError = error.response?.data;
        console.error("Error submitting PTFE to Smartsheet:", smartsheetError || error.message);
        if (error.code === 'ECONNABORTED') {
            return res.status(504).json({ success: false, error: 'Smartsheet timed out. Please try again.' });
        }
        if (error.response?.status === 429) {
            return res.status(429).json({ success: false, error: 'Smartsheet is rate limited. Please wait a moment and try again.' });
        }
        const details = smartsheetError?.message ? `Failed to submit PTFE data: ${smartsheetError.message}` : 'Failed to submit PTFE data.';
        return res.status(500).json({ success: false, error: details });
    }
}

app.post('/api/submit-ptfe', submitPtfe);

// 4a. Handle PTFE Job x Job shift tracker submissions
const PTFE_JOB_LOG_SHEET_ID = getRequiredEnv('DEPT_PTFE_JOB_LOG_SHEET_ID');

const PTFE_JOB_LOG_COLUMN_MAP = {
    'Row ID':          3775244732239748,
    'Work Date':       8278844359610244,
    'Associate Name':  960494965133188,
    'Cell':            5464094592503684,
    'Job Slot':        3212294778818436,
    'Row Type':        7715894406188932,
    'Item Number':     2086394871975812,
    'Lot Number':      6589994499346308,
    'Std PPH':         4338194685661060,
    'Actual PPH':      8841794313031556,
    'OE %':            256807523356548,
    'Time (Min)':      4760407150727044,
    'Start Qty':       2508607337041796,
    'End Qty':         7012206964412292,
    'Loss Reason':     1382707430199172,
    'Countermeasures': 5886307057569668
};

app.post('/api/submit-ptfe-jxj', async (req, res) => {
    try {
        const rows = req.body; // array of row objects
        if (!Array.isArray(rows) || rows.length === 0) {
            return res.status(400).json({ success: false, error: 'No rows provided.' });
        }
        if (rows.some(row => row['Row Type'] !== 'Event' && !validateItemNumberPayload(row, ['Item Number']))) {
            return res.status(400).json({ success: false, error: 'Item number must be exactly six digits.' });
        }
        // Test account interception
        if (TEST_ACCOUNTS.includes(rows[0]['Associate Name'])) {
            return res.json({ success: true, message: '[TEST MODE] PTFE JxJ simulated.', data: [] });
        }
        // Safe mode gate — reuse same flag as master log
        if (!isEnvTrue('ALLOW_PTFE_MASTER_LOG_WRITES')) {
            return res.json({ success: true, simulated: true, message: '[SAFE MODE] PTFE JxJ simulated.' });
        }
        const columnMap = {
            ...PTFE_JOB_LOG_COLUMN_MAP,
            'Event': await getOrCreateSheetColumn({
                dept: 'PTFE',
                sheetId: PTFE_JOB_LOG_SHEET_ID,
                title: 'Event'
            })
        };
        const numericCols = new Set(['Std PPH', 'Actual PPH', 'OE %', 'Time (Min)', 'Start Qty', 'End Qty']);
        const smartsheetRows = rows.map(row => {
            const newRow = { toTop: true, cells: [] };
            for (const [key, colId] of Object.entries(columnMap)) {
                let value = row[key];
                if (value === undefined || value === null || value === '') continue;
                if (numericCols.has(key) && typeof value === 'string') {
                    const parsed = Number(value);
                    if (!isNaN(parsed)) value = parsed;
                }
                const cell = { columnId: colId, value };
                if (['Associate Name', 'Cell', 'Row Type'].includes(key)) cell.strict = false;
                newRow.cells.push(cell);
            }
            return newRow;
        }).filter(r => r.cells.length > 0);

        const response = await getClientForDept('PTFE').post(`sheets/${PTFE_JOB_LOG_SHEET_ID}/rows`, smartsheetRows);
        logPortalUsage({
            eventType: 'jxj_submit',
            department: 'PTFE',
            associateName: rows[0]['Associate Name'],
            details: `Rows: ${smartsheetRows.length}`
        });
        res.json({ success: true, message: `Logged ${smartsheetRows.length} JxJ row(s).`, data: response.data });
    } catch (error) {
        const smartsheetError = error.response?.data;
        console.error('Error submitting PTFE JxJ:', smartsheetError || error.message);
        if (error.code === 'ECONNABORTED') return res.status(504).json({ success: false, error: 'Smartsheet timed out.' });
        if (error.response?.status === 429) return res.status(429).json({ success: false, error: 'Rate limited.' });
        const details = smartsheetError?.message ? `Failed to submit PTFE JxJ data: ${smartsheetError.message}` : 'Failed to submit PTFE JxJ data.';
        res.status(500).json({ success: false, error: details });
    }
});

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

let _piMasterLogColumnMap = null;

async function getPiMasterLogColumnMap() {
    if (_piMasterLogColumnMap) return _piMasterLogColumnMap;
    const client = getClientForDept('PI');
    const sheetId = getRequiredEnv('DEPT_PI_MASTER_LOG_SHEET_ID');
    const response = await client.get(`sheets/${sheetId}?include=columns`);
    const allColumns = buildColumnMap(response.data);
    const missingColumns = PI_MASTER_LOG_WRITE_TITLES.filter(title => !allColumns[title]);
    if (missingColumns.length > 0) {
        throw new Error(`PI Master Log is missing required column(s): ${missingColumns.join(', ')}`);
    }
    _piMasterLogColumnMap = PI_MASTER_LOG_WRITE_TITLES.reduce((map, title) => {
        if (allColumns[title]) {
            map[title] = allColumns[title];
        }
        return map;
    }, {});
    return _piMasterLogColumnMap;
}

async function submitPi(req, res) {
    let submissionKey = null;
    try {
        const data = req.body;
        let dept = 'PI';
        try {
            dept = normalizeDept(data.department || data.departmentKey || 'PI');
        } catch (e) {
            return res.status(400).json({ success: false, error: e.message });
        }
        if (dept !== 'PI') {
            return res.status(400).json({ success: false, error: 'Invalid department for PI submission.' });
        }

        if (!validateItemNumberPayload(data)) {
            return res.status(400).json({ success: false, error: 'Item number must be exactly six digits.' });
        }

        if (TEST_ACCOUNTS.includes(data['Associate Name'])) {
            console.log(`[TEST MODE] Intercepted PI Master Log submission for ${data['Associate Name']}. Bypassing Smartsheet.`);
            return res.json({ success: true, message: "[TEST MODE] Successfully simulated PI logging to Smartsheet.", data: [] });
        }

        if (!isEnvTrue('ALLOW_PI_MASTER_LOG_WRITES')) {
            return res.json({
                success: true,
                simulated: true,
                message: "[SAFE MODE] PI submission simulated. Set ALLOW_PI_MASTER_LOG_WRITES=true to enable PI Master Log writes.",
                data: []
            });
        }

        const columnMap = await getPiMasterLogColumnMap();
        const columnTypes = await getMasterLogColumnTypes('PI');
        const newRow = { toTop: true, cells: [] };
        const submittedEntries = [];

        for (const title of PI_MASTER_LOG_WRITE_TITLES) {
            const value = parseMasterLogCellValue(title, data[title]);
            if (columnMap[title] && value !== undefined && value !== null && value !== '') {
                const cell = buildMasterLogCell(title, columnMap[title], value, columnTypes[title]);
                if (cell) newRow.cells.push(cell);
                submittedEntries.push([title, value]);
            }
        }

        if (newRow.cells.length === 0) {
            return res.status(400).json({ success: false, error: 'No PI fields to submit.' });
        }

        const reservation = reserveMasterLogSubmission('PI', submittedEntries);
        submissionKey = reservation.key;
        if (reservation.duplicate) {
            return res.json({
                success: true,
                duplicate: true,
                message: 'Duplicate PI submission ignored because an identical row was already submitted recently.',
                data: []
            });
        }

        await addSubmissionSourceCell(newRow, 'PI');

        const response = await getClientForDept('PI').post(`sheets/${getRequiredEnv('DEPT_PI_MASTER_LOG_SHEET_ID')}/rows`, [newRow]);
        finishMasterLogSubmission(submissionKey, true);
        logPortalUsage({
            eventType: 'master_log_submit',
            department: 'PI',
            associateName: data['Associate Name'],
            details: data['Entry Type'] || data.Sequence || ''
        });
        return res.json({ success: true, message: "Successfully logged PI data to Smartsheet.", data: response.data });
    } catch (error) {
        if (submissionKey) finishMasterLogSubmission(submissionKey, false);
        console.error("Error submitting PI to Smartsheet:", error.response?.data || error.message);
        if (error.code === 'ECONNABORTED') {
            return res.status(504).json({ success: false, error: 'Smartsheet timed out. Please try again.' });
        }
        if (error.response?.status === 429) {
            return res.status(429).json({ success: false, error: 'Smartsheet is rate limited. Please wait a moment and try again.' });
        }
        return res.status(500).json({ success: false, error: 'Failed to submit PI data.' });
    }
}

app.post('/api/submit-pi', submitPi);

let _piJobLogColumnMap = null;

async function getPiJobLogColumnMap() {
    if (_piJobLogColumnMap) return _piJobLogColumnMap;
    const client = getClientForDept('PI');
    const sheetId = getRequiredEnv('DEPT_PI_JOB_LOG_SHEET_ID');
    await getOrCreateSheetColumn({ dept: 'PI', sheetId, title: 'Event' });
    const response = await client.get(`sheets/${sheetId}?include=columns`);
    _piJobLogColumnMap = buildColumnMap(response.data);
    return _piJobLogColumnMap;
}

app.post('/api/submit-pi-jxj', async (req, res) => {
    try {
        const rows = req.body;
        if (!Array.isArray(rows) || rows.length === 0) {
            return res.status(400).json({ success: false, error: 'No rows provided.' });
        }
        const invalidDeptRow = rows.find(row => row.Department && normalizeDept(row.Department) !== 'PI');
        if (invalidDeptRow) {
            return res.status(400).json({ success: false, error: 'Invalid department for PI JxJ submission.' });
        }
        if (rows.some(row => row['Row Type'] !== 'Event' && !validateItemNumberPayload(row, ['Item Number']))) {
            return res.status(400).json({ success: false, error: 'Item number must be exactly six digits.' });
        }

        if (rows.some(row => TEST_ACCOUNTS.includes(row['Associate Name']))) {
            return res.json({ success: true, message: '[TEST MODE] PI JxJ simulated.', data: [] });
        }

        if (!isEnvTrue('ALLOW_PI_MASTER_LOG_WRITES')) {
            return res.json({ success: true, simulated: true, message: '[SAFE MODE] PI JxJ simulated.' });
        }

        const columnMap = await getPiJobLogColumnMap();
        const writeFields = [
            { key: 'Row ID', columns: ['Row ID'] },
            { key: 'Work Date', columns: ['Work Date'] },
            { key: 'Associate Name', columns: ['Associate Name'] },
            { key: 'Cell', columns: ['Cell'] },
            { key: 'Job Slot', columns: ['Job Slot'] },
            { key: 'Row Type', columns: ['Row Type'] },
            { key: 'Event', columns: ['Event'] },
            { key: 'Item Number', columns: ['Item Number'] },
            { key: 'Lot Number', columns: ['Lot Number'] },
            { key: 'Std PPH', columns: ['Std PPH'], numeric: true },
            { key: 'Actual PPH', columns: ['Actual PPH'], numeric: true },
            { key: 'OE %', columns: ['OE %', 'OE Pct'], numeric: true },
            { key: 'Time (Min)', columns: ['Time (Min)', 'Time Min'], numeric: true },
            { key: 'Start Qty', columns: ['Start Qty'], numeric: true },
            { key: 'End Qty', columns: ['End Qty'], numeric: true },
            { key: 'Loss Reason', columns: ['Loss Reason'] },
            { key: 'Countermeasures', columns: ['Countermeasures'] }
        ];
        const missingColumns = writeFields
            .filter(field => !field.columns.some(column => columnMap[column]))
            .map(field => field.columns.join(' or '));
        if (missingColumns.length > 0) {
            throw new Error(`PI JxJ Log is missing required column(s): ${missingColumns.join(', ')}`);
        }
        const smartsheetRows = rows.map(row => {
            const newRow = { toTop: true, cells: [] };
            for (const field of writeFields) {
                const colTitle = field.columns.find(column => columnMap[column]);
                const colId = columnMap[colTitle];
                let value = row[field.key];
                if (!colId || value === undefined || value === null || value === '') continue;
                if (field.numeric && typeof value === 'string') {
                    const parsed = Number(value);
                    if (!isNaN(parsed)) value = parsed;
                }
                const cell = { columnId: colId, value };
                if (['Associate Name', 'Cell', 'Row Type'].includes(field.key)) cell.strict = false;
                newRow.cells.push(cell);
            }
            return newRow;
        }).filter(r => r.cells.length > 0);

        const response = await getClientForDept('PI').post(`sheets/${getRequiredEnv('DEPT_PI_JOB_LOG_SHEET_ID')}/rows`, smartsheetRows);
        logPortalUsage({
            eventType: 'jxj_submit',
            department: 'PI',
            associateName: rows[0]['Associate Name'],
            details: `Rows: ${smartsheetRows.length}`
        });
        res.json({ success: true, message: `Logged ${smartsheetRows.length} PI JxJ row(s).`, data: response.data });
    } catch (error) {
        const smartsheetError = error.response?.data;
        console.error('Error submitting PI JxJ:', smartsheetError || error.message);
        if (error.code === 'ECONNABORTED') return res.status(504).json({ success: false, error: 'Smartsheet timed out.' });
        if (error.response?.status === 429) return res.status(429).json({ success: false, error: 'Rate limited.' });
        const details = smartsheetError?.message ? `Failed to submit PI JxJ data: ${smartsheetError.message}` : 'Failed to submit PI JxJ data.';
        res.status(500).json({ success: false, error: details });
    }
});

// 5. Test Route just to check if server is working
app.get('/api/status', (req, res) => {
    res.json({ status: 'Online', message: 'Smartsheet API Gateway is running.' });
});

// Start the Server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on http://0.0.0.0:${PORT}`);
    console.log(`Local access: http://localhost:${PORT}`);
    if (process.env.SHOW_LAN_HINT === 'true' && process.env.SERVER_HOST) {
        console.log(`LAN access: http://${process.env.SERVER_HOST}:${PORT}`);
    }
});
