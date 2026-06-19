const express = require('express');
const { ConflictError, ValidationError } = require('../services/submissions/validation');

function publicSubmission(submission) {
    if (!submission) return null;
    return {
        id: submission.id,
        department: submission.department,
        associateName: submission.associateName,
        entryType: submission.entryType,
        workDate: submission.workDate,
        lifecycleStatus: submission.lifecycleStatus,
        syncStatus: submission.syncStatus,
        remoteRowId: submission.remoteRowId,
        createdAt: submission.createdAt,
        updatedAt: submission.updatedAt,
        submittedAt: submission.submittedAt,
        retryCount: submission.retryCount,
        nextAttemptAt: submission.nextAttemptAt,
        lastErrorCode: submission.lastErrorCode,
        lastErrorMessage: submission.lastErrorMessage,
        resolvedAt: submission.resolvedAt,
        resolutionReason: submission.resolutionReason
    };
}

function createSubmissionRouter(options) {
    const router = express.Router();

    router.use((req, res, next) => {
        if (!options.databaseEnabled) {
            return res.status(503).json({ success: false, error: 'Durable submissions are not enabled in this environment.' });
        }
        next();
    });

    function requireSupervisor(req, res, next) {
        const actor = options.getSupervisorActor(req);
        if (!actor) return res.status(401).json({ success: false, error: 'Supervisor authorization required.' });
        req.actor = actor;
        next();
    }

    router.post('/', async (req, res, next) => {
        try {
            const result = await options.service.create(req.body, {
                name: req.body.associateName,
                role: 'Associate',
                workstation: req.body.kioskId
            });
            res.status(result.created ? 201 : 200).json({
                success: true,
                duplicate: result.duplicate,
                submission: publicSubmission(result.submission)
            });
        } catch (error) {
            next(error);
        }
    });

    router.get('/', requireSupervisor, async (req, res, next) => {
        try {
            const requestedDepartment = req.query.dept ? String(req.query.dept).toUpperCase() : req.actor.department;
            if (requestedDepartment !== req.actor.department) {
                return res.status(403).json({ success: false, error: 'Supervisor access is limited to the authenticated department.' });
            }
            const submissions = await options.service.list({
                status: req.query.status,
                department: requestedDepartment,
                associateName: req.query.associate,
                entryType: req.query.type,
                workDate: req.query.date,
                limit: req.query.limit
            });
            res.json({ success: true, submissions: submissions.map(publicSubmission) });
        } catch (error) {
            next(error);
        }
    });

    router.get('/:id', async (req, res, next) => {
        try {
            const submission = await options.service.getById(req.params.id);
            if (!submission) return res.status(404).json({ success: false, error: 'Submission not found.' });
            res.json({ success: true, submission: publicSubmission(submission) });
        } catch (error) {
            next(error);
        }
    });

    router.post('/:id/retry', requireSupervisor, async (req, res, next) => {
        try {
            const submission = await options.service.getById(req.params.id);
            if (!submission) return res.status(404).json({ success: false, error: 'Submission not found.' });
            if (submission.department !== req.actor.department) {
                return res.status(403).json({ success: false, error: 'Supervisor access is limited to the authenticated department.' });
            }
            const retried = await options.service.retry(req.params.id, req.actor, req.body.reason);
            if (!retried) return res.status(409).json({ success: false, error: 'Only failed or needs-review submissions can be retried.' });
            res.json({ success: true });
        } catch (error) {
            next(error);
        }
    });

    router.post('/:id/resolve', requireSupervisor, async (req, res, next) => {
        try {
            const submission = await options.service.getById(req.params.id);
            if (!submission) return res.status(404).json({ success: false, error: 'Submission not found.' });
            if (submission.department !== req.actor.department) {
                return res.status(403).json({ success: false, error: 'Supervisor access is limited to the authenticated department.' });
            }
            const resolved = await options.service.resolve(req.params.id, req.actor, req.body.reason);
            if (!resolved) return res.status(409).json({ success: false, error: 'Only failed or needs-review submissions can be resolved.' });
            res.json({ success: true });
        } catch (error) {
            next(error);
        }
    });

    router.use((error, req, res, next) => {
        if (error instanceof ValidationError || error instanceof ConflictError) {
            return res.status(error.statusCode).json({
                success: false,
                error: error.message,
                fields: error.fields
            });
        }
        req.log?.error({ err: error }, 'submission API request failed');
        res.status(500).json({ success: false, error: 'Submission request failed.' });
    });

    return router;
}

module.exports = {
    createSubmissionRouter,
    publicSubmission
};
