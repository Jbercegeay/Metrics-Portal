const assert = require('node:assert/strict');
const test = require('node:test');
const model = require('../public/pl/pl-model');

test('PL job model preserves quantity, defect, yield, and Smartsheet column behavior', () => {
    const form = model.emptyForm(['Wrinkle', 'Cut']);
    Object.assign(form, {
        sequence: 'Inspect', lotNumber: 'LOT-1', itemNumber: '123456', goodParts: 75,
        timeWorked: 42, notes: 'Reviewed low yield', defects: { Wrinkle: 20, Cut: 5 }
    });
    const payload = model.buildJobPayload(form);

    assert.equal(model.defectTotal(form), 25);
    assert.equal(payload['Start Quantity'], 100);
    assert.equal(payload['End Quantity'], 75);
    assert.equal(payload['Defect-Wrinkle'], 20);
    assert.equal(payload['Time worked (Min)'], 42);
    assert.equal(payload['=< 50% Yield'], undefined);
    assert.deepEqual(model.validateJob(form), {});
});

test('PL job validation requires notes below 75 percent and complete Spool Check details', () => {
    const form = model.emptyForm(['Defect']);
    Object.assign(form, {
        sequence: 'Spool Check', lotNumber: 'LOT-2', itemNumber: '123456', goodParts: 49,
        timeWorked: 1, defects: { Defect: 51 }
    });
    const errors = model.validateJob(form);
    assert.match(errors.notes, /below 75%/);
    assert.match(errors.spoolCheck, /required/);
    assert.equal(model.buildJobPayload(form)['=< 50% Yield'], 'true');
});

test('PL event model rejects non-positive durations and maps a valid event', () => {
    const form = model.emptyForm();
    Object.assign(form, { event: 'Meeting', eventStart: '09:10', eventEnd: '09:40', notes: 'Daily review' });
    assert.equal(model.eventMinutes(form.eventStart, form.eventEnd), 30);
    assert.deepEqual(model.validateEvent(form), {});
    assert.deepEqual(model.buildEventPayload(form), {
        'Entry Type': 'Event', 'Event': 'Meeting', 'Time worked (Min)': 30, 'Notes': 'Daily review'
    });
});

test('PL workspace dirty-state excludes synchronization status but includes pending requests', () => {
    const form = model.emptyForm();
    form.lastSubmission = { id: 'saved', syncStatus: 'pending' };
    assert.equal(model.hasUnsavedWork(form), false);
    form.pendingSubmission = { id: 'retry-me' };
    assert.equal(model.hasUnsavedWork(form), true);
});

test('PL requires at least one root-cause detail at exactly 50 percent yield or lower', () => {
    const form = model.emptyForm(['Defect']);
    Object.assign(form, {
        sequence: 'Inspect', lotNumber: 'LOT-RCA', itemNumber: '123456', goodParts: 50,
        timeWorked: 5, notes: 'Required low-yield note', defects: { Defect: 50 }
    });

    assert.match(model.validateJob(form).rootCause, /at least one root-cause detail/i);
    form.rca.etchOps = 'Operator A';
    assert.equal(model.validateJob(form).rootCause, undefined);
    form.rca.etchOps = '';
    form.goodParts = 51;
    form.defects.Defect = 49;
    assert.equal(model.validateJob(form).rootCause, undefined);
});

test('PL root-cause data participates in workspace dirty state', () => {
    const form = model.emptyForm();
    assert.equal(model.hasUnsavedWork(form), false);
    form.rca.commentStatus = 'Yes';
    assert.equal(model.hasRootCauseDetails(form.rca), true);
    assert.equal(model.hasUnsavedWork(form), true);
});
