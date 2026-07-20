const {
    ConflictError,
    ValidationError,
    destinationFor,
    normalizeSubmission
} = require('./validation');

function normalizeActor(actor, submission) {
    return {
        name: String(actor?.name || submission.associateName).trim(),
        role: String(actor?.role || 'Associate').trim(),
        workstation: String(actor?.workstation || submission.kioskId).trim()
    };
}

function createSubmissionService(repository) {
    return {
        async create(input, actor) {
            const submission = normalizeSubmission(input);
            const result = await repository.create(submission, destinationFor(submission), normalizeActor(actor, submission));
            if (!result.created && result.submission.payloadHash !== submission.payloadHash) {
                throw new ConflictError('Submission ID already exists with a different payload. Reuse the original payload or create a new logical submission ID.');
            }
            return { ...result, duplicate: !result.created };
        },

        getById(id) {
            return repository.getById(String(id || '').trim().toLowerCase());
        },

        list(filters) {
            const limit = Math.min(Math.max(Number(filters.limit) || 100, 1), 500);
            return repository.list({ ...filters, limit });
        },

        async retry(id, actor, reason) {
            const cleanReason = String(reason || '').trim();
            if (!cleanReason) throw new ValidationError({ reason: 'A retry reason is required.' });
            return repository.retry(id, actor, cleanReason);
        },

        async resolve(id, actor, reason) {
            const cleanReason = String(reason || '').trim();
            if (!cleanReason) throw new ValidationError({ reason: 'A resolution reason is required.' });
            return repository.resolve(id, actor, cleanReason);
        }
    };
}

module.exports = {
    createSubmissionService
};
