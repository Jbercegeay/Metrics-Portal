const crypto = require('crypto');

const DEPARTMENTS = new Set(['PL', 'PTFE', 'PI']);
const ENTRY_TYPES = new Set(['job', 'event', 'jxj']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

class ValidationError extends Error {
    constructor(fields) {
        super('Submission validation failed.');
        this.name = 'ValidationError';
        this.statusCode = 400;
        this.fields = fields;
    }
}

class ConflictError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ConflictError';
        this.statusCode = 409;
    }
}

function stableValue(value) {
    if (Array.isArray(value)) return value.map(stableValue);
    if (value && typeof value === 'object') {
        return Object.keys(value).sort().reduce((result, key) => {
            result[key] = stableValue(value[key]);
            return result;
        }, {});
    }
    return value;
}

function hashPayload(value) {
    return crypto.createHash('sha256').update(JSON.stringify(stableValue(value))).digest('hex');
}

function normalizeSubmission(input = {}) {
    const fields = {};
    const id = String(input.id || '').trim().toLowerCase();
    const department = String(input.department || '').trim().toUpperCase();
    const entryType = String(input.entryType || '').trim().toLowerCase();
    const associateName = String(input.associateName || '').trim();
    const workDate = String(input.workDate || '').trim();
    const kioskId = String(input.kioskId || '').trim();
    const payload = input.payload;

    if (!UUID_PATTERN.test(id)) fields.id = 'A permanent UUID submission ID is required.';
    if (!DEPARTMENTS.has(department)) fields.department = 'Department must be PL, PTFE, or PI.';
    if (!ENTRY_TYPES.has(entryType)) fields.entryType = 'Entry type must be job, event, or jxj.';
    if (!associateName || associateName.length > 80) fields.associateName = 'Associate name is required and must not exceed 80 characters.';
    if (!DATE_PATTERN.test(workDate) || Number.isNaN(Date.parse(`${workDate}T00:00:00Z`))) fields.workDate = 'Work date must be a valid YYYY-MM-DD date.';
    if (!kioskId || kioskId.length > 120) fields.kioskId = 'Kiosk ID is required and must not exceed 120 characters.';
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) || Object.getPrototypeOf(payload) !== Object.prototype) {
        fields.payload = 'Payload must be a JSON object. Each Job x Job row is a separate logical submission.';
    }

    if (Object.keys(fields).length > 0) throw new ValidationError(fields);

    const canonicalPayload = {
        ...payload,
        'Entry Type': entryType === 'jxj' ? 'JxJ' : `${entryType.charAt(0).toUpperCase()}${entryType.slice(1)}`,
        'Work Date': workDate,
        'Associate Name': associateName
    };

    return {
        id,
        department,
        entryType,
        associateName,
        workDate,
        kioskId,
        payload: stableValue(canonicalPayload),
        payloadHash: hashPayload(canonicalPayload),
        validationVersion: 1
    };
}

function destinationFor(submission) {
    const log = submission.entryType === 'jxj' ? 'job_log' : 'master_log';
    if (submission.department === 'PL' && log === 'job_log') {
        throw new ValidationError({ entryType: 'PL Job x Job submission is not supported by the durable platform.' });
    }
    return `smartsheet:${submission.department}:${log}`;
}

module.exports = {
    ConflictError,
    ValidationError,
    destinationFor,
    hashPayload,
    normalizeSubmission,
    stableValue
};
