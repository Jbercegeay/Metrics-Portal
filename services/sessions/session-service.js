const crypto = require('crypto');

function tokenHash(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

function readCookie(req, name) {
    const header = String(req.headers.cookie || '');
    for (const part of header.split(';')) {
        const index = part.indexOf('=');
        if (index < 0) continue;
        if (part.slice(0, index).trim() === name) return decodeURIComponent(part.slice(index + 1).trim());
    }
    return null;
}

function createSessionService(options) {
    const repository = options.repository;
    const ttlMs = options.ttlMs;
    const cookieName = options.cookieName;
    const cookieOptions = {
        httpOnly: true,
        sameSite: 'lax',
        secure: options.secure,
        path: '/',
        maxAge: ttlMs
    };

    return {
        async create(user, kioskId) {
            if (!String(kioskId || '').trim()) throw new Error('Kiosk ID is required for a server session.');
            const token = crypto.randomBytes(32).toString('base64url');
            const expiresAt = new Date(Date.now() + ttlMs);
            const result = await repository.createSession({
                ...user,
                kioskId,
                tokenHash: tokenHash(token),
                expiresAt
            });
            return { ...result, token: result.conflict ? null : token };
        },

        setCookie(res, token) {
            res.cookie(cookieName, token, cookieOptions);
        },

        clearCookie(res) {
            res.clearCookie(cookieName, { httpOnly: true, sameSite: 'lax', secure: options.secure, path: '/' });
        },

        async resolve(req) {
            const token = readCookie(req, cookieName);
            if (!token) return null;
            return repository.findSession(tokenHash(token), new Date(Date.now() + ttlMs));
        },

        revoke(session, reason, revokeOptions) {
            return repository.revokeSession(session, reason, revokeOptions);
        },

        listLocks(department) {
            return repository.listLocks(department);
        },

        releaseLock(userId, actor, reason) {
            return repository.releaseLock(userId, actor, reason);
        }
    };
}

function createSessionMiddleware(options) {
    return async (req, res, next) => {
        if (!options.enabled) return next();
        try {
            req.portalSession = await options.service.resolve(req);
            next();
        } catch (error) {
            next(error);
        }
    };
}

module.exports = {
    createSessionMiddleware,
    createSessionService,
    readCookie,
    tokenHash
};
