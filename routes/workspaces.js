const express = require('express');
const { ValidationError } = require('../services/submissions/validation');

function createWorkspaceRouter(options) {
    const router = express.Router();
    router.use((req, res, next) => {
        if (!options.enabled) return res.status(503).json({ success: false, error: 'Server workspaces are not enabled in this environment.' });
        if (!req.portalSession) return res.status(401).json({ success: false, error: 'Authentication required.' });
        next();
    });

    router.get('/current', async (req, res, next) => {
        try {
            res.json({ success: true, workspace: await options.service.getCurrent(req.portalSession) });
        } catch (error) { next(error); }
    });

    router.put('/current', async (req, res, next) => {
        try {
            const result = await options.service.save(req.portalSession, req.body);
            if (result.conflict) {
                return res.status(409).json({ success: false, error: 'Workspace was updated by another tab.', workspace: result.workspace });
            }
            res.json({ success: true, workspace: result.workspace });
        } catch (error) { next(error); }
    });

    router.use((error, req, res, next) => {
        if (error instanceof ValidationError) {
            return res.status(400).json({ success: false, error: error.message, fields: error.fields });
        }
        req.log?.error({ err: error }, 'workspace request failed');
        res.status(500).json({ success: false, error: 'Workspace request failed.' });
    });
    return router;
}

module.exports = { createWorkspaceRouter };
