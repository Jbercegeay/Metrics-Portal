const crypto = require('crypto');
const pino = require('pino');

const REDACT_PATHS = [
    'password',
    'newPassword',
    'token',
    'apiToken',
    'authorization',
    'req.headers.authorization',
    'req.headers.cookie',
    'request.headers.authorization',
    'request.headers.cookie'
];

function createLogger(options = {}) {
    return pino({
        level: options.level || 'info',
        base: {
            service: 'metrics-portal',
            version: options.version || 'unknown',
            environment: options.environment || 'development'
        },
        redact: {
            paths: REDACT_PATHS,
            censor: '[REDACTED]'
        },
        timestamp: pino.stdTimeFunctions.isoTime
    }, options.destination);
}

function requestContext(logger) {
    return (req, res, next) => {
        const requestId = String(req.get('x-request-id') || '').trim() || crypto.randomUUID();
        const startedAt = process.hrtime.bigint();
        req.requestId = requestId;
        req.log = logger.child({ requestId });
        res.setHeader('x-request-id', requestId);

        res.on('finish', () => {
            const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
            req.log.info({
                method: req.method,
                path: req.originalUrl,
                statusCode: res.statusCode,
                durationMs: Math.round(durationMs * 100) / 100
            }, 'request completed');
        });

        next();
    };
}

module.exports = {
    createLogger,
    requestContext,
    REDACT_PATHS
};
