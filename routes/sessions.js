const express = require('express');

function createSessionRouter(options) {
    const router = express.Router();

    router.use((req, res, next) => {
        if (!options.enabled) return res.status(503).json({ success: false, error: 'Server sessions are not enabled in this environment.' });
        next();
    });

    function requireSession(req, res, next) {
        if (!req.portalSession) return res.status(401).json({ success: false, error: 'Authentication required.' });
        next();
    }

    function requireSupervisor(req, res, next) {
        if (!req.portalSession || !['Supervisor', 'Administrator'].includes(req.portalSession.role)) {
            return res.status(403).json({ success: false, error: 'Supervisor authorization required.' });
        }
        next();
    }

    router.get('/current', requireSession, (req, res) => {
        res.json({ success: true, session: req.portalSession });
    });

    router.delete('/current', requireSession, async (req, res, next) => {
        try {
            const discard = req.query.discard === 'true';
            const discardReason = String(req.body?.reason || '').trim();
            if (discard && !discardReason) return res.status(400).json({ success: false, error: 'A discard reason is required.' });
            const result = await options.service.revoke(req.portalSession, 'user_logout', { discard, discardReason });
            if (result.unsavedWorkspace) {
                return res.status(409).json({ success: false, error: 'Open work must be submitted or intentionally discarded before sign-out.', unsavedWorkspace: true });
            }
            options.service.clearCookie(res);
            await options.onRevoked?.(req.portalSession);
            res.json({ success: true });
        } catch (error) {
            next(error);
        }
    });

    router.get('/kiosk-locks', requireSupervisor, async (req, res, next) => {
        try {
            const locks = await options.service.listLocks(req.portalSession.department);
            res.json({ success: true, locks });
        } catch (error) {
            next(error);
        }
    });

    router.post('/kiosk-locks/:userId/release', requireSupervisor, async (req, res, next) => {
        try {
            const reason = String(req.body?.reason || '').trim();
            if (!reason) return res.status(400).json({ success: false, error: 'A release reason is required.' });
            const released = await options.service.releaseLock(req.params.userId, req.portalSession, reason);
            if (!released?.released) return res.status(404).json({ success: false, error: 'Active kiosk lock not found.' });
            await options.onLockReleased?.(released);
            res.json({ success: true });
        } catch (error) {
            next(error);
        }
    });

    return router;
}

module.exports = { createSessionRouter };
