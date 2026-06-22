const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('PL browser treats the database submitted state as Smartsheet synced', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'pl', 'app.js'), 'utf8');

    assert.match(source, /submission\.syncStatus === 'submitted'/);
    assert.doesNotMatch(source, /submission\.syncStatus === 'delivered'/);
});