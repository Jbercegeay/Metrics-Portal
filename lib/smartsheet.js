try {
    require('dotenv').config({ quiet: true });
} catch (error) {
    // Dotenv is optional in hosted environments where variables are provided by the platform.
}

const axios = require('axios');
const https = require('https');

function getRequiredEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

function getDeptToken(dept = 'PL') {
    return getRequiredEnv(`DEPT_${dept}_API_TOKEN`);
}

function createSmartsheetClient(token = getDeptToken('PL')) {
    const config = {
        baseURL: 'https://api.smartsheet.com/2.0/',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        timeout: 30000 // 30-second hard timeout on all Smartsheet API calls
    };

    if (process.env.NODE_ENV !== 'production') {
        config.httpsAgent = new https.Agent({ rejectUnauthorized: false, keepAlive: true });
    }

    const client = axios.create(config);

    // Retry interceptor: auto-retry on rate limit (429), temporary unavailability (503),
    // and connection timeouts — up to 3 attempts with exponential backoff (2s, 4s, 8s).
    client.interceptors.response.use(
        response => response,
        async error => {
            const cfg = error.config;
            if (!cfg) throw error;

            cfg.__retryCount = cfg.__retryCount || 0;
            const method = String(cfg.method || 'get').toLowerCase();
            const isSafeRetryMethod = ['get', 'head', 'options'].includes(method);
            const shouldRetry =
                isSafeRetryMethod &&
                cfg.__retryCount < 3 &&
                (error.code === 'ECONNABORTED' ||
                 error.response?.status === 429 ||
                 error.response?.status === 503);

            if (!shouldRetry) throw error;

            cfg.__retryCount++;
            const wait = Math.pow(2, cfg.__retryCount) * 1000;
            console.warn(`[Smartsheet] Retry ${cfg.__retryCount}/3 after ${wait}ms (status: ${error.response?.status || error.code})`);
            await new Promise(r => setTimeout(r, wait));
            return client.request(cfg);
        }
    );

    return client;
}

const deptClients = {};

function getClientForDept(dept = 'PL') {
    const key = String(dept || 'PL').toUpperCase();
    if (!deptClients[key]) {
        deptClients[key] = createSmartsheetClient(getDeptToken(key));
    }
    return deptClients[key];
}

const smartsheetApi = createSmartsheetClient();

async function getSheet(sheetId, dept = 'PL') {
    const response = await getClientForDept(dept).get(`sheets/${sheetId}`);
    return response.data;
}

module.exports = {
    createSmartsheetClient,
    getClientForDept,
    getDeptToken,
    getRequiredEnv,
    getSheet,
    smartsheetApi
};
