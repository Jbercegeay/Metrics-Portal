const { getClientForDept, getRequiredEnv } = require('../../lib/smartsheet');

const SUBMISSION_ID_COLUMN = 'Submission ID';
const DESTINATIONS = {
    'smartsheet:PL:master_log': { department: 'PL', sheetEnv: 'DEPT_PL_MASTER_LOG_SHEET_ID' },
    'smartsheet:PTFE:master_log': { department: 'PTFE', sheetEnv: 'DEPT_PTFE_MASTER_LOG_SHEET_ID' },
    'smartsheet:PTFE:job_log': { department: 'PTFE', sheetEnv: 'DEPT_PTFE_JOB_LOG_SHEET_ID' },
    'smartsheet:PI:master_log': { department: 'PI', sheetEnv: 'DEPT_PI_MASTER_LOG_SHEET_ID' },
    'smartsheet:PI:job_log': { department: 'PI', sheetEnv: 'DEPT_PI_JOB_LOG_SHEET_ID' }
};

class DeliveryConfigurationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'DeliveryConfigurationError';
        this.permanent = true;
        this.code = 'DELIVERY_CONFIGURATION';
    }
}

function createSmartsheetDeliveryAdapter(options = {}) {
    const clients = options.getClientForDept || getClientForDept;
    const requiredEnv = options.getRequiredEnv || getRequiredEnv;
    const columnCache = new Map();

    function resolveDestination(destination) {
        const definition = DESTINATIONS[destination];
        if (!definition) throw new DeliveryConfigurationError(`Unsupported outbox destination: ${destination}`);
        return {
            ...definition,
            sheetId: requiredEnv(definition.sheetEnv),
            client: clients(definition.department)
        };
    }

    async function getColumns(definition) {
        const cacheKey = `${definition.department}:${definition.sheetId}`;
        if (columnCache.has(cacheKey)) return columnCache.get(cacheKey);
        const response = await definition.client.get(`sheets/${definition.sheetId}/columns?includeAll=true`);
        const columns = (response.data.data || response.data || []).reduce((map, column) => {
            map[column.title] = column;
            return map;
        }, {});
        if (!columns[SUBMISSION_ID_COLUMN]) {
            throw new DeliveryConfigurationError(`${definition.department} destination is missing the required ${SUBMISSION_ID_COLUMN} column.`);
        }
        columnCache.set(cacheKey, columns);
        return columns;
    }

    async function findExisting(definition, columns, submissionId) {
        const response = await definition.client.get(`search/sheets/${definition.sheetId}`, {
            params: { query: `"${submissionId}"`, scopes: 'cellData' }
        });
        const matches = (response.data.results || []).filter((result) => result.objectType === 'row');
        for (const match of matches) {
            const rowResponse = await definition.client.get(`sheets/${definition.sheetId}/rows/${match.objectId}`);
            const cell = (rowResponse.data.cells || []).find((candidate) => candidate.columnId === columns[SUBMISSION_ID_COLUMN].id);
            if (String(cell?.value || '').trim().toLowerCase() === submissionId.toLowerCase()) {
                return String(match.objectId);
            }
        }
        return null;
    }

    function buildCell(column, value) {
        if (value === undefined || value === null || value === '') return null;
        if (column.type === 'MULTI_PICKLIST' || Array.isArray(value)) {
            const values = Array.isArray(value)
                ? value.map((item) => String(item).trim()).filter(Boolean)
                : String(value).split(',').map((item) => item.trim()).filter(Boolean);
            if (values.length === 0) return null;
            return {
                columnId: column.id,
                objectValue: { objectType: 'MULTI_PICKLIST', values },
                strict: false
            };
        }
        return { columnId: column.id, value, strict: false };
    }

    return {
        async deliver(claim) {
            const definition = resolveDestination(claim.destination);
            const columns = await getColumns(definition);
            const existingRowId = await findExisting(definition, columns, claim.submission_id);
            if (existingRowId) {
                return {
                    alreadyExists: true,
                    remoteRowId: existingRowId,
                    responseCode: 'FOUND'
                };
            }

            const cells = [];
            for (const [title, value] of Object.entries(claim.payload || {})) {
                if (!columns[title]) continue;
                const cell = buildCell(columns[title], value);
                if (cell) cells.push(cell);
            }
            cells.push({ columnId: columns[SUBMISSION_ID_COLUMN].id, value: claim.submission_id });
            if (cells.length === 1) {
                throw new DeliveryConfigurationError('Submission payload does not match any destination columns.');
            }

            const response = await definition.client.post(`sheets/${definition.sheetId}/rows`, [{ toTop: true, cells }]);
            const created = response.data.result?.[0] || response.data.data?.result?.[0] || response.data.result;
            return {
                alreadyExists: false,
                remoteRowId: created?.id ? String(created.id) : null,
                responseCode: String(response.status || 200)
            };
        },

        clearColumnCache() {
            columnCache.clear();
        }
    };
}

module.exports = {
    createSmartsheetDeliveryAdapter,
    DeliveryConfigurationError,
    DESTINATIONS,
    SUBMISSION_ID_COLUMN
};
