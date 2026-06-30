(function attachPlModel(root, factory) {
    const model = factory();
    if (typeof module === 'object' && module.exports) module.exports = model;
    else root.PlModel = model;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createPlModel() {
    function today() {
        const date = new Date();
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    function emptyForm(defects = []) {
        return {
            sequence: '', lotNumber: '', itemNumber: '', goodParts: 0, timeWorked: 0,
            defects: Object.fromEntries(defects.map((name) => [name, 0])), notes: '',
            spoolCheckSequence: '', spoolCheckNumber: '',
            rca: { ptfeHead: '', ptfeOps: '', etchOps: '', tecoHead: '', tecoOps: '', pebaxHead: '', pebaxOps: '', commentStatus: 'No' },
            event: '', eventDuration: 0, eventStart: '', eventEnd: '', pendingSubmission: null, lastSubmission: null
        };
    }

    function emptyWorkspace(defects = []) {
        return { id: null, version: 0, mode: 'job', workDate: today(), formData: emptyForm(defects), hasUnsavedWork: false };
    }

    function defectTotal(form) {
        return Object.values(form.defects || {}).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
    }

    function hasRootCauseDetails(rca = {}) {
        const textFields = ['ptfeHead', 'ptfeOps', 'etchOps', 'tecoHead', 'tecoOps', 'pebaxHead', 'pebaxOps'];
        return textFields.some((name) => String(rca[name] || '').trim()) || rca.commentStatus === 'Yes';
    }

    function hasUnsavedWork(form, mode = 'job') {
        if (form.pendingSubmission) return true;
        if (mode === 'event') return Boolean(form.event || Number(form.eventDuration) || form.eventStart || form.eventEnd);
        return Boolean(form.sequence || form.lotNumber || form.itemNumber || Number(form.goodParts) || Number(form.timeWorked) || defectTotal(form) || String(form.notes || '').trim() || hasRootCauseDetails(form.rca));
    }

    function validateJob(form) {
        const errors = {};
        if (!form.sequence) errors.sequence = 'Sequence is required.';
        if (!String(form.lotNumber || '').trim()) errors.lotNumber = 'Lot number is required.';
        if (!/^\d{6}$/.test(String(form.itemNumber || ''))) errors.itemNumber = 'Item number must be six digits.';
        if ((Number(form.timeWorked) || 0) <= 0) errors.timeWorked = 'Time worked must be greater than zero.';
        const start = (Number(form.goodParts) || 0) + defectTotal(form);
        const yieldValue = start > 0 ? (Number(form.goodParts) || 0) / start : 1;
        if (yieldValue < 0.75 && !String(form.notes || '').trim()) {
            errors.notes = form.sequence === 'Spool Check'
                ? 'Reason for Fail is required when yield is below 75%.'
                : 'Notes are required when yield is below 75%.';
        }
        if (start > 0 && yieldValue <= 0.5 && !hasRootCauseDetails(form.rca)) errors.rootCause = 'At least one root-cause detail is required when yield is 50% or lower.';
        if (form.sequence === 'Spool Check' && (!form.spoolCheckSequence || !form.spoolCheckNumber)) {
            errors.spoolCheck = 'Spool Check sequence and check number are required.';
        }
        return errors;
    }

    function buildJobPayload(form) {
        const good = Math.max(0, Number(form.goodParts) || 0);
        const bad = defectTotal(form);
        const payload = {
            'Entry Type': 'Job',
            'Sequence': form.sequence,
            'Lot Number': String(form.lotNumber || '').trim(),
            'Item': String(form.itemNumber || '').trim(),
            'End Quantity': good,
            'Start Quantity': good + bad,
            'Time worked (Min)': Math.max(0, Number(form.timeWorked) || 0),
            'PTFE Oven Head': form.rca?.ptfeHead || '',
            'PTFE  Operators': form.rca?.ptfeOps || '',
            'Etch Operators': form.rca?.etchOps || '',
            'Teco Oven Head': form.rca?.tecoHead || '',
            'Teco Operators': form.rca?.tecoOps || '',
            'Pebax Oven  Head': form.rca?.pebaxHead || '',
            'Pebax Operators': form.rca?.pebaxOps || '',
            'Did Operators leave a Comment?': form.rca?.commentStatus === 'Yes' ? 'true' : 'false'
        };
        if (good + bad > 0 && good / (good + bad) <= 0.5) payload['=< 50% Yield'] = 'true';
        if (form.sequence === 'Spool Check') {
            payload['Reason for Fail'] = String(form.notes || '').trim();
            payload['Spool Check Sequence'] = form.spoolCheckSequence;
            payload['Check #'] = form.spoolCheckNumber;
        } else {
            payload['Notes'] = String(form.notes || '').trim();
        }
        Object.entries(form.defects || {}).forEach(([name, value]) => {
            payload[`Defect-${name}`] = Math.max(0, Number(value) || 0);
        });
        return payload;
    }

    function eventMinutes(start, end) {
        if (!/^\d{2}:\d{2}$/.test(start || '') || !/^\d{2}:\d{2}$/.test(end || '')) return 0;
        const [startHour, startMinute] = start.split(':').map(Number);
        const [endHour, endMinute] = end.split(':').map(Number);
        return Math.max(0, (endHour * 60 + endMinute) - (startHour * 60 + startMinute));
    }

    function validateEvent(form) {
        const errors = {};
        if (!form.event) errors.event = 'Event is required.';
        if ((Number(form.eventDuration) || 0) <= 0) errors.eventDuration = 'Duration must be greater than zero.';
        return errors;
    }

    function buildEventPayload(form) {
        return {
            'Entry Type': 'Event',
            'Event': form.event,
            'Time worked (Min)': Math.max(0, Number(form.eventDuration) || 0),
            'Notes': String(form.notes || '').trim()
        };
    }

    return { buildEventPayload, buildJobPayload, defectTotal, emptyForm, emptyWorkspace, eventMinutes, hasRootCauseDetails, hasUnsavedWork, today, validateEvent, validateJob };
}));
