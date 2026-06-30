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

test('PL root-cause operator fields use the configured operator roster', () => {
    const appSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'pl', 'app.js'), 'utf8');
    const htmlSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'pl', 'index.html'), 'utf8');

    ['ptfeOps', 'etchOps', 'tecoOps', 'pebaxOps'].forEach((field) => {
        assert.match(htmlSource, new RegExp(`<select data-rca="${field}" data-operator-select>`));
    });
    assert.match(appSource, /config\.operators/);
    assert.doesNotMatch(appSource, /config\.associates/);
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

test('PL Spool Check uses compatibility toggle buttons and reason-for-fail notes', () => {
    const appSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'pl', 'app.js'), 'utf8');
    const htmlSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'pl', 'index.html'), 'utf8');
    const cssSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'pl', 'styles.css'), 'utf8');

    assert.match(htmlSource, /data-spool-sequence="10"/);
    assert.match(htmlSource, /data-spool-sequence="20"/);
    assert.match(htmlSource, /data-spool-sequence="30"/);
    assert.match(htmlSource, /data-spool-check="1st"/);
    assert.match(htmlSource, /data-spool-check="5th"/);
    assert.match(htmlSource, /id="spoolCheckSequence" type="hidden"/);
    assert.match(htmlSource, /id="notesLabel">Notes/);
    assert.match(appSource, /notesLabel\.textContent = isSpoolCheck \? 'Reason for Fail' : 'Notes'/);
    assert.match(appSource, /Failed for Channel/);
    assert.match(appSource, /dataset\.spoolSequence/);
    assert.match(appSource, /dataset\.spoolCheck/);
    assert.match(cssSource, /\.spool-toggle-button\.active/);
});

test('PL themes use readable variables for banners, buttons, and controls', () => {
    const cssSource = fs.readFileSync(path.join(__dirname, '..', 'public', 'pl', 'styles.css'), 'utf8');

    ['info', 'warning', 'status-neutral', 'status-saved', 'status-dirty', 'status-error',
        'primary', 'secondary', 'danger', 'active', 'error', 'toast'].forEach((token) => {
        assert.match(cssSource, new RegExp(`--${token}-bg`));
        assert.match(cssSource, new RegExp(`--${token}-text`));
    });
    assert.match(cssSource, /\.info \{ background:var\(--info-bg\);[^}]*color:var\(--info-text\)/);
    assert.match(cssSource, /\.warning \{ background:var\(--warning-bg\);[^}]*color:var\(--warning-text\)/);
    assert.match(cssSource, /\.primary \{ background:var\(--primary-bg\); color:var\(--primary-text\); \}/);
    assert.match(cssSource, /\.secondary \{ background:var\(--secondary-bg\);[^}]*color:var\(--secondary-text\); \}/);
    assert.match(cssSource, /\.danger \{ background:var\(--danger-bg\);[^}]*color:var\(--danger-text\); \}/);
    assert.match(cssSource, /\.mode-tab\.active \{ background:var\(--active-bg\); color:var\(--active-text\);/);
    assert.match(cssSource, /\.spool-toggle-button\.active \{ background:var\(--blue\);[^}]*color:var\(--active-control-text\); \}/);
    assert.match(cssSource, /\.status\.saved \{ background:var\(--status-saved-bg\); color:var\(--status-saved-text\); \}/);
    assert.match(cssSource, /\.errors \{[^}]*background:var\(--error-bg\); color:var\(--error-text\);/);
    assert.match(cssSource, /\.alert-dialog \{[^}]*background:var\(--dialog-bg\); color:var\(--text\);/);
    assert.match(cssSource, /\.toast \{[^}]*background:var\(--toast-bg\); color:var\(--toast-text\);/);
    assert.match(cssSource, /\.notice span \{ display:block; color:inherit; \}/);
});
