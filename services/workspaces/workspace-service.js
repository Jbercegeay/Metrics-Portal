const { ValidationError } = require('../submissions/validation');

const MODES = new Set(['job', 'event', 'jxj']);

function normalizeWorkspace(input = {}) {
    const fields = {};
    const version = Number(input.version);
    const mode = String(input.mode || 'job').trim().toLowerCase();
    const workDate = String(input.workDate || '').trim();
    const formData = input.formData;
    if (!Number.isInteger(version) || version < 0) fields.version = 'Workspace version must be a non-negative integer.';
    if (!MODES.has(mode)) fields.mode = 'Workspace mode must be job, event, or jxj.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate) || Number.isNaN(Date.parse(`${workDate}T00:00:00Z`))) fields.workDate = 'Work date must use YYYY-MM-DD.';
    if (!formData || typeof formData !== 'object' || Array.isArray(formData)) fields.formData = 'Form data must be a JSON object.';
    if (typeof input.hasUnsavedWork !== 'boolean') fields.hasUnsavedWork = 'Unsaved-work state must be true or false.';
    if (version > 0 && !String(input.id || '').trim()) fields.id = 'Workspace ID is required for an update.';
    if (Object.keys(fields).length > 0) throw new ValidationError(fields);
    return {
        id: String(input.id || '').trim() || null,
        version,
        mode,
        workDate,
        formData,
        hasUnsavedWork: input.hasUnsavedWork
    };
}

function createWorkspaceService(repository) {
    return {
        getCurrent(session) {
            return repository.getCurrent(session);
        },
        save(session, input) {
            return repository.save(session, normalizeWorkspace(input));
        },
        markSubmitted(session, submissionId) {
            return repository.markSubmitted(session, submissionId);
        }
    };
}

module.exports = {
    createWorkspaceService,
    normalizeWorkspace
};
