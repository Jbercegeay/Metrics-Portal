const express = require('express');

function createHealthRouter(options) {
    const router = express.Router();
    const startedAt = options.startedAt || Date.now();

    router.get('/health', (req, res) => {
        res.json({
            status: 'alive',
            version: options.version,
            uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
            requestId: req.requestId
        });
    });

    router.get('/health/ready', async (req, res) => {
        const database = await options.database.checkReadiness();
        const ready = database.ok;
        res.status(ready ? 200 : 503).json({
            status: ready ? 'ready' : 'not_ready',
            version: options.version,
            checks: { database },
            requestId: req.requestId
        });
    });

    return router;
}

module.exports = {
    createHealthRouter
};
