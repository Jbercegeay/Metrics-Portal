require('dotenv').config({ quiet: true });
const crypto = require('crypto');
const os = require('os');
const { getRuntimeConfig, validateApplicationEnvironment } = require('../lib/runtime-config');
const { createLogger } = require('../lib/logger');
const { createDatabase } = require('../db');
const { createSubmissionRepository } = require('../repositories/submission-repository');
const { createSmartsheetDeliveryAdapter } = require('../services/smartsheet/delivery-adapter');
const { createOutboxWorker } = require('../services/submissions/outbox-worker');

validateApplicationEnvironment();
const config = getRuntimeConfig();
if (!config.database.enabled) throw new Error('DATABASE_ENABLED must be true for the Smartsheet worker.');
if (!config.features.durableSubmissions) throw new Error('DURABLE_SUBMISSIONS_ENABLED must be true for the Smartsheet worker.');

const logger = createLogger({ level: config.logLevel, version: config.serviceVersion, environment: config.nodeEnv });
const database = createDatabase(config.database, logger);
const repository = createSubmissionRepository(database);
const workerId = `${os.hostname()}:${process.pid}:${crypto.randomUUID().slice(0, 8)}`;
const worker = createOutboxWorker({
    repository,
    deliveryAdapter: createSmartsheetDeliveryAdapter(),
    logger,
    workerId,
    leaseMs: config.worker.leaseMs,
    maxAttempts: config.worker.maxAttempts,
    baseBackoffMs: config.worker.baseBackoffMs,
    maximumBackoffMs: config.worker.maximumBackoffMs
});

let stopping = false;
async function run() {
    logger.info({ workerId }, 'Smartsheet worker started');
    while (!stopping) {
        const result = await worker.processOnce();
        if (!result.processed) {
            await new Promise((resolve) => setTimeout(resolve, config.worker.pollIntervalMs));
        }
    }
}

async function stop(signal) {
    if (stopping) return;
    stopping = true;
    logger.info({ signal, workerId }, 'Smartsheet worker stopping');
    await database.close();
}

process.once('SIGINT', () => stop('SIGINT'));
process.once('SIGTERM', () => stop('SIGTERM'));

run().catch(async (error) => {
    logger.fatal({ err: error, workerId }, 'Smartsheet worker stopped unexpectedly');
    process.exitCode = 1;
    await database.close();
});
