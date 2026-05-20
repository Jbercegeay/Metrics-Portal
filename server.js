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

function buildSubmissionKey(dept, entries) {
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

function reserveMasterLogSubmission(dept, entries) {
    const now = Date.now();
    pruneRecentMasterLogSubmissions(now);
    const key = buildSubmissionKey(dept, entries);
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

function finishMasterLogSubmission(key, success) {
    const record = recentMasterLogSubmissions.get(key);
    if (!record) return;
    if (success) {
        record.status = 'success';
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
const HOUR_BY_HOUR_SHEET_ID = getRequiredEnv('DEPT_PL_HOUR_BY_HOUR_SHEET_ID');

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

            const toUpdate = [], toAdd = [];
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
                        { columnId: colMap['Item'],          value: (item.item || '').trim() },
                        { columnId: colMap['Sequence'],      value: (item.sequence || '').trim() },
                        { columnId: colMap['Good PPH Std'],  value: toSmartsheetWholeNumber(item.goodPphStd) },
                        { columnId: colMap['Total PPH Std'], value: toSmartsheetWholeNumber(item.totalPphStd) }
                    ].filter(c => c.columnId);
                } else if (type === 'items') {
                    cells = [
                        { columnId: colMap['Item'],          value: (item.item || '').trim() },
                        { columnId: colMap['FG Length (in)'],value: toSmartsheetNumber(item.fgLength) },
                        { columnId: colMap['Product Family'],value: (item.productFamily || '').trim() },
                        { columnId: colMap['Unit Of Measure'],value: (item.unitOfMeasure || '').trim() }
                    ].filter(c => c.columnId);
                }
                if (item.id) {
                    toUpdate.push({ id: item.id, cells });
                } else {
                    toAdd.push({ toBottom: true, cells });
                }
            });
            if (toUpdate.length > 0) await deptClient.put(`sheets/${sheetId}/rows`, toUpdate);
            if (toAdd.length > 0) await deptClient.post(`sheets/${sheetId}/rows`, toAdd);
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
        res.status(500).json({ success: false, error: 'Failed to save config data' });
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

        // Construct the row object for Smartsheet
        const newRow = {
            toTop: true, // Add to the top of the sheet
            cells: []
        };
        const submittedEntries = [];

        // Iterate through the payload and map to columns if it exists
        for (const [key, value] of Object.entries(data)) {
            if (COLUMN_MAP[key] && value !== undefined && value !== null && value !== '') {
                let parsedValue = value;
                // Smartsheet requires strict booleans for Checkbox columns, not strings.
                if (value === 'true') parsedValue = true;
                if (value === 'false') parsedValue = false;

                newRow.cells.push({
                    columnId: COLUMN_MAP[key],
                    value: parsedValue
                });
                submittedEntries.push([key, parsedValue]);
            }
        }

        const reservation = reserveMasterLogSubmission('PL', submittedEntries);
        submissionKey = reservation.key;
        if (reservation.duplicate) {
            return res.json({
                success: true,
                duplicate: true,
                message: 'Duplicate PL submission ignored because an identical row was already submitted recently.',
                data: []
            });
        }

        // Send the payload to the Master Log Sheet
        const response = await smartsheetApi.post(`sheets/${MASTER_LOG_SHEET_ID}/rows`, [newRow]);
        finishMasterLogSubmission(submissionKey, true);

        res.json({ success: true, message: "Successfully logged data to Smartsheet.", data: response.data });

    } catch (error) {
        if (submissionKey) finishMasterLogSubmission(submissionKey, false);
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
        const newRow = { toTop: true, cells: [] };
        const submittedEntries = [];
        const numericTitles = new Set([
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

        for (const title of PTFE_MASTER_LOG_WRITE_TITLES) {
            let value = data[title];
            if (numericTitles.has(title) && typeof value === 'string' && value.trim() !== '') {
                const parsed = Number(value);
                if (!Number.isNaN(parsed)) value = parsed;
            }
            if (columnMap[title] && value !== undefined && value !== null && value !== '') {
                const cell = { columnId: columnMap[title], value: value };
                if (title === 'Associate Name') cell.strict = false;
                newRow.cells.push(cell);
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

        const response = await getClientForDept('PTFE').post(`sheets/${getRequiredEnv('DEPT_PTFE_MASTER_LOG_SHEET_ID')}/rows`, [newRow]);
        finishMasterLogSubmission(submissionKey, true);
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
        if (rows.some(row => !validateItemNumberPayload(row, ['Item Number']))) {
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
        const numericCols = new Set(['Std PPH', 'Actual PPH', 'OE %', 'Time (Min)', 'Start Qty', 'End Qty']);
        const smartsheetRows = rows.map(row => {
            const newRow = { toTop: true, cells: [] };
            for (const [key, colId] of Object.entries(PTFE_JOB_LOG_COLUMN_MAP)) {
                let value = row[key];
                if (value === undefined || value === null || value === '') continue;
                if (numericCols.has(key) && typeof value === 'string') {
                    const parsed = Number(value);
                    if (!isNaN(parsed)) value = parsed;
                }
                const cell = { columnId: colId, value };
                if (key === 'Associate Name') cell.strict = false;
                newRow.cells.push(cell);
            }
            return newRow;
        }).filter(r => r.cells.length > 0);

        const response = await getClientForDept('PTFE').post(`sheets/${PTFE_JOB_LOG_SHEET_ID}/rows`, smartsheetRows);
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
        const newRow = { toTop: true, cells: [] };
        const submittedEntries = [];
        const numericTitles = new Set([
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

        for (const title of PI_MASTER_LOG_WRITE_TITLES) {
            let value = data[title];
            if (numericTitles.has(title) && typeof value === 'string' && value.trim() !== '') {
                const parsed = Number(value);
                if (!Number.isNaN(parsed)) value = parsed;
            }
            if (columnMap[title] && value !== undefined && value !== null && value !== '') {
                const cell = { columnId: columnMap[title], value: value };
                if (title === 'Associate Name') cell.strict = false;
                newRow.cells.push(cell);
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

        const response = await getClientForDept('PI').post(`sheets/${getRequiredEnv('DEPT_PI_MASTER_LOG_SHEET_ID')}/rows`, [newRow]);
        finishMasterLogSubmission(submissionKey, true);
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
        if (rows.some(row => !validateItemNumberPayload(row, ['Item Number']))) {
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
                if (field.key === 'Associate Name') cell.strict = false;
                newRow.cells.push(cell);
            }
            return newRow;
        }).filter(r => r.cells.length > 0);

        const response = await getClientForDept('PI').post(`sheets/${getRequiredEnv('DEPT_PI_JOB_LOG_SHEET_ID')}/rows`, smartsheetRows);
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

// 4. Handle Hour by Hour PCD Submissions (separate sheet)
app.post('/api/submit-pcd', async (req, res) => {
    try {
        const rows = req.body; // Array of { sequence, workDate, associate, H1_Good, H1_Bad, H1_Mins, ... }

        // --- TEST ACCOUNT INTERCEPTION ---
        if (rows.length > 0 && TEST_ACCOUNTS.includes(rows[0]['Associate Name'])) {
            console.log(`[TEST MODE] Intercepted PCD submission for ${rows[0]['Associate Name']}. Bypassing Smartsheet.`);
            return res.json({ success: true, message: `[TEST MODE] Successfully simulated logging ${rows.length} PCD row(s).`, data: [] });
        }
        // ---------------------------------

        // Column mapping for the "Hour by Hour Tracker" sheet
        const PCD_COLUMN_MAP = {
            'Work Date': 8450494333407108,
            'Associate Name': 287720008798084,
            'Sequence': 4791319636168580,
            'Event Name': 757865020428164,
            'H1_Good': 2539519822483332, 'H1_Bad': 7043119449853828, 'H1_Mins': 1413619915640708,
            'H2_Good': 5917219543011204, 'H2_Bad': 3665419729325956, 'H2_Mins': 8169019356696452,
            'H3_Good': 850669962219396, 'H3_Bad': 5354269589589892, 'H3_Mins': 3102469775904644,
            'H4_Good': 7606069403275140, 'H4_Bad': 1976569869062020, 'H4_Mins': 6480169496432516,
            'H5_Good': 4228369682747268, 'H5_Bad': 8731969310117764, 'H5_Mins': 146982520442756,
            'H6_Good': 4650582147813252, 'H6_Bad': 2398782334128004, 'H6_Mins': 6902381961498500,
            'H7_Good': 1272882427285380, 'H7_Bad': 5776482054655876, 'H7_Mins': 3524682240970628,
            'H8_Good': 8028281868341124, 'H8_Bad': 709932473864068, 'H8_Mins': 5213532101234564,
            'H9_Good': 2961732287549316, 'H9_Bad': 7465331914919812, 'H9_Mins': 1835832380706692,
            'H10_Good': 6339432008077188, 'H10_Bad': 4087632194391940, 'H10_Mins': 8591231821762436,
            'H11_Good': 428457497153412, 'H11_Bad': 4932057124523908, 'H11_Mins': 2680257310838660,
            'H12_Good': 7183856938209156, 'H12_Bad': 1554357403996036, 'H12_Mins': 6057957031366532
        };

        const smartsheetRows = rows.map(row => {
            const newRow = { toTop: true, cells: [] };
            for (const [key, value] of Object.entries(row)) {
                if (PCD_COLUMN_MAP[key] && (value !== undefined && value !== null && value !== '')) {
                    newRow.cells.push({
                        columnId: PCD_COLUMN_MAP[key],
                        value: value
                    });
                }
            }
            return newRow;
        });

        const response = await smartsheetApi.post(`sheets/${HOUR_BY_HOUR_SHEET_ID}/rows`, smartsheetRows);

        res.json({ success: true, message: `Successfully logged ${smartsheetRows.length} PCD row(s).`, data: response.data });

    } catch (error) {
        console.error("Error submitting PCD to Smartsheet:", error.response?.data || error.message);
        if (error.code === 'ECONNABORTED') {
            return res.status(504).json({ success: false, error: 'Smartsheet timed out. Please try again.' });
        }
        if (error.response?.status === 429) {
            return res.status(429).json({ success: false, error: 'Smartsheet is rate limited. Please wait a moment and try again.' });
        }
        res.status(500).json({ success: false, error: 'Failed to submit PCD data.' });
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
