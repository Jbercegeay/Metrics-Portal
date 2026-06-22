(function startPrecisionLiner() {
    const api = window.PortalApi;
    const model = window.PlModel;
    const elements = {};
    let session = null;
    let workspace = null;
    let defectNames = [];
    let saveTimer = null;
    let savePromise = Promise.resolve();
    let conflicted = false;
    let submitting = false;

    const byId = (id) => document.getElementById(id);
    const clone = (value) => JSON.parse(JSON.stringify(value));

    function cacheElements() {
        ['identity', 'saveState', 'signOutButton', 'conflictPanel', 'reloadWorkspaceButton', 'submissionPanel',
            'submissionTitle', 'submissionDetail', 'refreshSubmissionButton', 'associateName', 'workDate',
            'jobForm', 'eventForm', 'sequence', 'lotNumber', 'itemNumber', 'timeWorked', 'spoolFields',
            'spoolCheckSequence', 'spoolCheckNumber', 'goodParts', 'startQuantity', 'endQuantity',
            'totalDefects', 'qualityYield', 'notes', 'rootCauseDetails', 'defectList', 'jobErrors', 'submitJobButton', 'event',
            'eventStart', 'eventEnd', 'eventDuration', 'eventErrors', 'submitEventButton', 'toast']
            .forEach((id) => { elements[id] = byId(id); });
    }

    function showToast(message) {
        elements.toast.textContent = message;
        elements.toast.hidden = false;
        clearTimeout(showToast.timer);
        showToast.timer = setTimeout(() => { elements.toast.hidden = true; }, 4200);
    }

    function setSaveState(text, type) {
        elements.saveState.textContent = text;
        elements.saveState.className = `status ${type}`;
    }

    function normalizedForm(source = {}) {
        const fresh = model.emptyForm(defectNames);
        return {
            ...fresh,
            ...source,
            defects: { ...fresh.defects, ...(source.defects || {}) },
            rca: { ...fresh.rca, ...(source.rca || {}) }
        };
    }

    function normalizeWorkspace(source) {
        const fresh = model.emptyWorkspace(defectNames);
        if (!source) return fresh;
        return {
            ...fresh,
            ...source,
            formData: normalizedForm(source.formData)
        };
    }

    function populateSelect(select, values, placeholder) {
        select.replaceChildren(new Option(placeholder, ''));
        values.filter(Boolean).sort((a, b) => a.localeCompare(b)).forEach((value) => select.add(new Option(value, value)));
    }

    function renderDefects() {
        elements.defectList.replaceChildren();
        defectNames.forEach((name) => {
            const row = document.createElement('div');
            row.className = 'defect-row';
            const label = document.createElement('label');
            label.textContent = name;
            label.htmlFor = `defect-${defectNames.indexOf(name)}`;
            const input = document.createElement('input');
            input.id = label.htmlFor;
            input.type = 'number';
            input.min = '0';
            input.step = '1';
            input.value = workspace.formData.defects[name] || 0;
            input.dataset.defect = name;
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'button danger';
            button.textContent = '+1';
            button.addEventListener('click', () => {
                input.value = String((Number(input.value) || 0) + 1);
                captureAndQueueSave();
            });
            input.addEventListener('input', captureAndQueueSave);
            row.append(label, input, button);
            elements.defectList.append(row);
        });
    }

    function renderWorkspace() {
        const form = workspace.formData;
        elements.workDate.value = workspace.workDate;
        elements.sequence.value = form.sequence;
        elements.lotNumber.value = form.lotNumber;
        elements.itemNumber.value = form.itemNumber;
        elements.timeWorked.value = form.timeWorked;
        elements.goodParts.value = form.goodParts;
        elements.notes.value = form.notes;
        elements.spoolCheckSequence.value = form.spoolCheckSequence;
        elements.spoolCheckNumber.value = form.spoolCheckNumber;
        elements.event.value = form.event;
        elements.eventStart.value = form.eventStart;
        elements.eventEnd.value = form.eventEnd;
        document.querySelectorAll('[data-rca]').forEach((input) => { input.value = form.rca[input.dataset.rca] || ''; });
        document.querySelectorAll('[data-mode]').forEach((button) => button.classList.toggle('active', button.dataset.mode === workspace.mode));
        elements.jobForm.hidden = workspace.mode !== 'job';
        elements.eventForm.hidden = workspace.mode !== 'event';
        elements.spoolFields.hidden = form.sequence !== 'Spool Check';
        renderDefects();
        renderMetrics();
        renderSubmission(form.lastSubmission);
    }

    function captureForm() {
        const form = workspace.formData;
        workspace.workDate = elements.workDate.value || model.today();
        form.sequence = elements.sequence.value;
        form.lotNumber = elements.lotNumber.value.trim();
        form.itemNumber = elements.itemNumber.value.replace(/\D/g, '').slice(0, 6);
        elements.itemNumber.value = form.itemNumber;
        form.timeWorked = Math.max(0, Number(elements.timeWorked.value) || 0);
        form.goodParts = Math.max(0, Number(elements.goodParts.value) || 0);
        form.notes = elements.notes.value;
        form.spoolCheckSequence = elements.spoolCheckSequence.value;
        form.spoolCheckNumber = elements.spoolCheckNumber.value;
        form.event = elements.event.value;
        form.eventStart = elements.eventStart.value;
        form.eventEnd = elements.eventEnd.value;
        document.querySelectorAll('[data-defect]').forEach((input) => { form.defects[input.dataset.defect] = Math.max(0, Number(input.value) || 0); });
        document.querySelectorAll('[data-rca]').forEach((input) => { form.rca[input.dataset.rca] = input.value; });
        workspace.hasUnsavedWork = model.hasUnsavedWork(form, workspace.mode);
        renderMetrics();
    }

    function renderMetrics() {
        const form = workspace.formData;
        const good = Math.max(0, Number(form.goodParts) || 0);
        const defects = model.defectTotal(form);
        const start = good + defects;
        elements.startQuantity.textContent = start;
        elements.endQuantity.textContent = good;
        elements.totalDefects.textContent = defects;
        elements.qualityYield.textContent = start ? `${((good / start) * 100).toFixed(1)}%` : '—';
        elements.rootCauseDetails.open = start > 0 && good / start <= 0.5;
        elements.eventDuration.textContent = `${model.eventMinutes(form.eventStart, form.eventEnd)} minutes`;
        elements.spoolFields.hidden = form.sequence !== 'Spool Check';
    }

    function queueSave() {
        if (conflicted || submitting) return;
        clearTimeout(saveTimer);
        setSaveState('Unsaved changes', 'dirty');
        saveTimer = setTimeout(() => saveWorkspace(), 550);
    }

    function captureAndQueueSave() {
        captureForm();
        queueSave();
    }

    function saveWorkspace() {
        clearTimeout(saveTimer);
        if (conflicted) return Promise.resolve(false);
        setSaveState('Saving…', 'neutral');
        savePromise = savePromise.then(async () => {
            const snapshot = clone(workspace);
            try {
                const result = await api.saveWorkspace(snapshot);
                workspace.version = result.workspace.version;
                workspace.id = result.workspace.id;
                setSaveState('Saved to server', 'saved');
                return true;
            } catch (error) {
                if (error.status === 409) {
                    conflicted = true;
                    elements.conflictPanel.hidden = false;
                    setSaveState('Tab conflict', 'error');
                } else {
                    setSaveState('Save failed', 'error');
                    showToast(error.message);
                }
                return false;
            }
        });
        return savePromise;
    }

    function renderErrors(container, errors) {
        const messages = Object.values(errors);
        container.hidden = messages.length === 0;
        container.innerHTML = messages.length ? `<ul>${messages.map((message) => `<li>${escapeHtml(message)}</li>`).join('')}</ul>` : '';
    }

    function escapeHtml(value) {
        const element = document.createElement('div');
        element.textContent = value;
        return element.innerHTML;
    }

    function submissionRequest(entryType, payload) {
        const existing = workspace.formData.pendingSubmission;
        const signature = JSON.stringify(payload);
        if (existing && existing.entryType === entryType && existing.signature === signature) return existing;
        return { id: crypto.randomUUID(), entryType, signature, payload };
    }

    async function submit(entryType) {
        captureForm();
        const form = workspace.formData;
        const errors = entryType === 'job' ? model.validateJob(form) : model.validateEvent(form);
        renderErrors(entryType === 'job' ? elements.jobErrors : elements.eventErrors, errors);
        if (Object.keys(errors).length) return;

        const payload = entryType === 'job' ? model.buildJobPayload(form) : model.buildEventPayload(form);
        const pending = submissionRequest(entryType, payload);
        form.pendingSubmission = pending;
        workspace.hasUnsavedWork = true;
        submitting = true;
        const button = entryType === 'job' ? elements.submitJobButton : elements.submitEventButton;
        button.disabled = true;
        button.textContent = 'Saving to database…';
        try {
            submitting = false;
            const persisted = await saveWorkspace();
            submitting = true;
            if (!persisted) throw new Error('The workspace must be saved before it can be submitted.');
            const result = await api.createSubmission({ id: pending.id, entryType, workDate: workspace.workDate, payload });
            const accepted = result.submission;
            const serverWorkspace = (await api.getWorkspace()).workspace;
            workspace = normalizeWorkspace(serverWorkspace);
            workspace.formData = model.emptyForm(defectNames);
            workspace.formData.lastSubmission = accepted;
            workspace.hasUnsavedWork = false;
            workspace.mode = entryType;
            submitting = false;
            await saveWorkspace();
            renderWorkspace();
            showToast(result.duplicate ? 'Original database record confirmed. No duplicate was created.' : 'Saved to database. Smartsheet sync will continue in the background.');
        } catch (error) {
            showToast(`${error.message} Retry will use the same submission ID.`);
            setSaveState('Submission needs retry', 'error');
        } finally {
            submitting = false;
            button.disabled = false;
            button.textContent = entryType === 'job' ? 'Save job to database' : 'Save event to database';
        }
    }

    function renderSubmission(submission) {
        elements.submissionPanel.hidden = !submission;
        if (!submission) return;
        const synced = submission.syncStatus === 'submitted';
        elements.submissionTitle.textContent = synced ? 'Database saved · Smartsheet synced' : 'Database saved · Smartsheet pending';
        elements.submissionDetail.textContent = synced
            ? 'The background worker confirmed the destination row.'
            : `Current sync status: ${submission.syncStatus || 'pending'}. The entry is safely stored.`;
    }

    async function refreshSubmission() {
        const id = workspace.formData.lastSubmission?.id;
        if (!id) return;
        try {
            const result = await api.getSubmission(id);
            workspace.formData.lastSubmission = result.submission;
            renderSubmission(result.submission);
            await saveWorkspace();
        } catch (error) { showToast(error.message); }
    }

    async function signOut() {
        captureForm();
        await saveWorkspace();
        let discard = false;
        let reason = '';
        if (workspace.hasUnsavedWork) {
            if (!window.confirm('This workspace contains unsent work. Stay signed in unless you intentionally want to discard it. Discard and sign out?')) return;
            reason = window.prompt('Enter the reason this work is being discarded:')?.trim() || '';
            if (!reason) return showToast('A discard reason is required.');
            discard = true;
        }
        try {
            await api.signOut(discard, reason);
            localStorage.removeItem('currentUser');
            window.location.href = '/login.html';
        } catch (error) { showToast(error.message); }
    }

    function bindEvents() {
        document.querySelectorAll('[data-mode]').forEach((button) => button.addEventListener('click', () => {
            captureForm();
            workspace.mode = button.dataset.mode;
            renderWorkspace();
            queueSave();
        }));
        [elements.workDate, elements.sequence, elements.lotNumber, elements.itemNumber, elements.timeWorked,
            elements.spoolCheckSequence, elements.spoolCheckNumber, elements.goodParts, elements.notes,
            elements.event, elements.eventStart, elements.eventEnd]
            .forEach((input) => input.addEventListener('input', captureAndQueueSave));
        document.querySelectorAll('[data-rca]').forEach((input) => input.addEventListener('input', captureAndQueueSave));
        byId('addOne').addEventListener('click', () => { elements.goodParts.value = String((Number(elements.goodParts.value) || 0) + 1); captureAndQueueSave(); });
        byId('addFive').addEventListener('click', () => { elements.goodParts.value = String((Number(elements.goodParts.value) || 0) + 5); captureAndQueueSave(); });
        elements.jobForm.addEventListener('submit', (event) => { event.preventDefault(); submit('job'); });
        elements.eventForm.addEventListener('submit', (event) => { event.preventDefault(); submit('event'); });
        elements.signOutButton.addEventListener('click', signOut);
        elements.refreshSubmissionButton.addEventListener('click', refreshSubmission);
        elements.reloadWorkspaceButton.addEventListener('click', async () => {
            workspace = normalizeWorkspace((await api.getWorkspace()).workspace);
            conflicted = false;
            elements.conflictPanel.hidden = true;
            renderWorkspace();
            setSaveState('Server copy loaded', 'saved');
        });
        window.addEventListener('beforeunload', (event) => {
            if (workspace?.hasUnsavedWork && elements.saveState.textContent !== 'Saved to server') event.preventDefault();
        });
    }

    async function initialize() {
        cacheElements();
        try {
            const [featureResult, sessionResult, configResult] = await Promise.all([api.getFeatures(), api.getSession(), api.getPlConfig()]);
            const features = featureResult.features;
            session = sessionResult.session;
            if (!features.plDatabaseSubmissions || !features.serverWorkspaces || session.department !== 'PL') {
                throw new Error('The Precision Liner database workflow is not enabled for this session.');
            }
            const config = configResult.data || {};
            defectNames = (config.defects || []).map((item) => item.name).filter(Boolean);
            populateSelect(elements.sequence, (config.sequences || []).map((item) => item.name), 'Select sequence…');
            populateSelect(elements.event, (config.events || []).map((item) => item.name).filter((name) => name.toLowerCase() !== 'shift end'), 'Select event…');
            workspace = normalizeWorkspace((await api.getWorkspace()).workspace);
            elements.identity.textContent = `${session.name} · ${session.role} · workstation ${session.kioskId}`;
            elements.associateName.textContent = session.name;
            bindEvents();
            renderWorkspace();
            document.querySelector('main').hidden = false;
            if (!workspace.id) await saveWorkspace();
            else setSaveState('Saved to server', 'saved');
        } catch (error) {
            setSaveState('Unavailable', 'error');
            showToast(error.message);
            setTimeout(() => { window.location.href = '/login.html'; }, 2400);
        }
    }

    initialize();
}());
