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

    router.get('/health/integrations', async (req, res) => {
        if (!options.integrationHealth) {
            return res.json({
                status: 'disabled',
                version: options.version,
                requestId: req.requestId
            });
        }
        try {
            const queue = await options.integrationHealth();
            const oldestPendingAt = queue.oldest_pending_at;
            const oldestPendingAgeSeconds = oldestPendingAt
                ? Math.max(0, Math.floor((Date.now() - new Date(oldestPendingAt).getTime()) / 1000))
                : 0;
            const degraded = Number(queue.needs_review_count) > 0 || oldestPendingAgeSeconds >= 300;
            res.json({
                status: degraded ? 'degraded' : 'ok',
                version: options.version,
                queue: {
                    pendingCount: Number(queue.pending_count || 0),
                    needsReviewCount: Number(queue.needs_review_count || 0),
                    oldestPendingAt,
                    oldestPendingAgeSeconds,
                    lastDeliveryAt: queue.last_delivery_at
                },
                requestId: req.requestId
            });
        } catch (error) {
            req.log?.error({ err: error }, 'integration health check failed');
            res.status(503).json({ status: 'unavailable', version: options.version, requestId: req.requestId });
        }
    });

    return router;
}

module.exports = {
    createHealthRouter
};
