const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('PL browser treats the database submitted state as Smartsheet synced', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'pl', 'app.js'), 'utf8');

    assert.match(source, /submission\.syncStatus === 'submitted'/);
    assert.doesNotMatch(source, /submission\.syncStatus === 'delivered'/);
});

test('PL browser opens root-cause details at the 50 percent boundary', () => {
    const appSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'pl', 'app.js'), 'utf8');
    const htmlSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'pl', 'index.html'), 'utf8');

    assert.match(htmlSource, /id="rootCauseDetails"/);
    assert.match(appSource, /rootCauseDetails\.open = start > 0 && good \/ start <= 0\.5/);
});

test('PL root-cause operator fields use the configured associate roster', () => {
    const appSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'pl', 'app.js'), 'utf8');
    const htmlSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'pl', 'index.html'), 'utf8');

    ['ptfeOps', 'etchOps', 'tecoOps', 'pebaxOps'].forEach((field) => {
        assert.match(htmlSource, new RegExp(`<select data-rca="${field}" data-operator-select>`));
    });
    assert.match(appSource, /config\.associates/);
    assert.match(appSource, /populateSelect\(select, operatorNames, 'Select operator…'\)/);
});

test('PL blocking feedback uses a centered alert dialog', () => {
    const appSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'pl', 'app.js'), 'utf8');
    const htmlSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'pl', 'index.html'), 'utf8');

    assert.match(htmlSource, /id="alertOverlay" class="alert-overlay" role="alertdialog"/);
    assert.match(appSource, /showAlert\('Action required', Object\.values\(errors\)\)/);
    assert.match(appSource, /showAlert\('Submission not completed'/);
});

test('PL time worked field replaces the default zero for operator entry', () => {
    const appSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'pl', 'app.js'), 'utf8');
    const htmlSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'pl', 'index.html'), 'utf8');
    const cssSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'pl', 'styles.css'), 'utf8');

    assert.match(htmlSource, /id="timeWorked"[^>]*class="operator-number"[^>]*data-replace-zero/);
    assert.match(appSource, /function selectZeroValue\(input\)/);
    assert.match(appSource, /input\.addEventListener\('focus', \(\) => selectZeroValue\(input\)\)/);
    assert.match(appSource, /input\.addEventListener\('mouseup'/);
    assert.match(cssSource, /input\.operator-number::-webkit-inner-spin-button/);
    assert.match(cssSource, /input\.operator-number \{ appearance:textfield; -moz-appearance:textfield; \}/);
});

test('PL migration page preserves the existing portal theme selector', () => {
    const appSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'pl', 'app.js'), 'utf8');
    const htmlSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'pl', 'index.html'), 'utf8');
    const cssSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'pl', 'styles.css'), 'utf8');

    assert.match(htmlSource, /id="themeSelect"/);
    ['precision', 'light', 'dark', 'high-contrast'].forEach((theme) => {
        assert.match(htmlSource, new RegExp(`value="${theme}"`));
        assert.match(cssSource, new RegExp(`theme-${theme}`));
    });
    assert.match(appSource, /localStorage\.setItem\('portalTheme', safeTheme\)/);
    assert.match(appSource, /elements\.themeSelect\.addEventListener\('change'/);
});
