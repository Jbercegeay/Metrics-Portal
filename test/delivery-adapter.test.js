const test = require('node:test');
const assert = require('node:assert/strict');
const { createSmartsheetDeliveryAdapter, DeliveryConfigurationError } = require('../services/smartsheet/delivery-adapter');

function claim() {
    return {
        destination: 'smartsheet:PL:master_log',
        submission_id: '8b5b5168-b808-4d55-bc24-7f6f26ae128f',
        payload: { 'Entry Type': 'Job', Item: '123456' }
    };
}

test('adapter writes mapped cells and permanent submission ID', async () => {
    let posted;
    const client = {
        async get(path) {
            if (path.includes('/columns')) return { data: { data: [{ id: 1, title: 'Submission ID', type: 'TEXT_NUMBER' }, { id: 2, title: 'Entry Type', type: 'TEXT_NUMBER' }, { id: 3, title: 'Item', type: 'TEXT_NUMBER' }] } };
            if (path.startsWith('search/')) return { data: { results: [] } };
            throw new Error(`Unexpected GET ${path}`);
        },
        async post(path, rows) { posted = { path, rows }; return { status: 200, data: { result: [{ id: 9001 }] } }; }
    };
    const adapter = createSmartsheetDeliveryAdapter({ getClientForDept: () => client, getRequiredEnv: () => 'sheet-1' });
    const result = await adapter.deliver(claim());
    assert.equal(result.remoteRowId, '9001');
    assert.equal(posted.rows[0].cells.find((cell) => cell.columnId === 1).value, claim().submission_id);
});

test('uncertain delivery is found by exact submission ID before another insert', async () => {
    let posts = 0;
    let searchCount = 0;
    const client = {
        async get(path) {
            if (path.includes('/columns')) return { data: { data: [{ id: 1, title: 'Submission ID', type: 'TEXT_NUMBER' }, { id: 2, title: 'Item', type: 'TEXT_NUMBER' }] } };
            if (path.startsWith('search/')) {
                searchCount += 1;
                return { data: { results: searchCount === 1 ? [] : [{ objectType: 'row', objectId: 4321 }] } };
            }
            if (path.endsWith('/rows/4321')) return { data: { cells: [{ columnId: 1, value: claim().submission_id }] } };
            throw new Error(`Unexpected GET ${path}`);
        },
        async post() { posts += 1; const error = new Error('timeout'); error.code = 'ECONNABORTED'; throw error; }
    };
    const adapter = createSmartsheetDeliveryAdapter({ getClientForDept: () => client, getRequiredEnv: () => 'sheet-1' });
    await assert.rejects(() => adapter.deliver(claim()), /timeout/);
    const result = await adapter.deliver(claim());
    assert.equal(result.alreadyExists, true);
    assert.equal(result.remoteRowId, '4321');
    assert.equal(posts, 1);
});

test('missing Submission ID column is a permanent configuration error', async () => {
    const client = { get: async () => ({ data: { data: [{ id: 2, title: 'Item' }] } }) };
    const adapter = createSmartsheetDeliveryAdapter({ getClientForDept: () => client, getRequiredEnv: () => 'sheet-1' });
    await assert.rejects(() => adapter.deliver(claim()), DeliveryConfigurationError);
});
