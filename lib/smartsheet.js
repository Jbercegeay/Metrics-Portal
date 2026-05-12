try {
    require('dotenv').config();
} catch (error) {
    // Dotenv is optional on Vercel; environment variables come from the platform.
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

function createSmartsheetClient() {
    const config = {
        baseURL: 'https://api.smartsheet.com/2.0/',
        headers: {
            Authorization: `Bearer ${getRequiredEnv('SMARTSHEET_ACCESS_TOKEN')}`,
            'Content-Type': 'application/json'
        },
        timeout: 30000 // 30-second hard timeout on all Smartsheet API calls
    };

    if (process.env.NODE_ENV !== 'production') {
        config.httpsAgent = new https.Agent({ rejectUnauthorized: false });
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
            const shouldRetry =
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

const smartsheetApi = createSmartsheetClient();

async function getSheet(sheetId) {
    const response = await smartsheetApi.get(`sheets/${sheetId}`);
    return response.data;
}

module.exports = {
    getRequiredEnv,
    getSheet,
    smartsheetApi
};
