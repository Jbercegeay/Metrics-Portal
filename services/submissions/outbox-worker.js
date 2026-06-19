function calculateBackoffMs(attempt, options = {}) {
    const baseMs = options.baseMs || 5000;
    const maximumMs = options.maximumMs || 15 * 60 * 1000;
    const random = options.random || Math.random;
    const exponential = Math.min(maximumMs, baseMs * (2 ** Math.max(attempt - 1, 0)));
    const jitter = 0.75 + (random() * 0.5);
    return Math.round(exponential * jitter);
}

function safeError(error) {
    const status = error.response?.status;
    const code = String(error.code || status || 'DELIVERY_ERROR');
    const permanent = error.permanent === true || (status >= 400 && status < 500 && status !== 408 && status !== 429);
    const retryable = !permanent;
    let message = 'Smartsheet delivery failed.';
    if (status === 401 || status === 403) message = 'Smartsheet authentication or authorization failed.';
    else if (status === 429) message = 'Smartsheet rate limit reached.';
    else if (status === 400) message = 'Smartsheet rejected the row mapping or values.';
    else if (error.code === 'ECONNABORTED') message = 'Smartsheet request timed out; remote acceptance is uncertain.';
    else if (error.permanent) message = String(error.message || message).slice(0, 500);
    return { code, message, retryable };
}

function createOutboxWorker(options) {
    const repository = options.repository;
    const deliveryAdapter = options.deliveryAdapter;
    const logger = options.logger;
    const workerId = options.workerId;
    const leaseMs = options.leaseMs || 60000;
    const maxAttempts = options.maxAttempts || 10;
    const now = options.now || (() => new Date());
    const backoffOptions = {
        baseMs: options.baseBackoffMs,
        maximumMs: options.maximumBackoffMs,
        random: options.random
    };

    return {
        async processOnce() {
            const claim = await repository.claimNext(workerId, leaseMs);
            if (!claim) return { processed: false };
            try {
                const result = await deliveryAdapter.deliver(claim);
                await repository.completeSuccess(claim, result);
                logger.info({ submissionId: claim.submission_id, attempt: claim.attempt_count }, 'submission delivered');
                return { processed: true, success: true, submissionId: claim.submission_id, result };
            } catch (error) {
                const classified = safeError(error);
                const terminal = !classified.retryable || Number(claim.attempt_count) >= maxAttempts;
                const delayMs = terminal ? 0 : calculateBackoffMs(Number(claim.attempt_count), backoffOptions);
                const nextAttemptAt = new Date(now().getTime() + delayMs);
                await repository.completeFailure(claim, {
                    terminal,
                    nextAttemptAt,
                    code: classified.code,
                    message: classified.message
                });
                logger[terminal ? 'error' : 'warn']({
                    submissionId: claim.submission_id,
                    attempt: claim.attempt_count,
                    code: classified.code,
                    nextAttemptAt
                }, terminal ? 'submission requires review' : 'submission delivery scheduled for retry');
                return { processed: true, success: false, terminal, submissionId: claim.submission_id };
            }
        }
    };
}

module.exports = {
    calculateBackoffMs,
    createOutboxWorker,
    safeError
};
