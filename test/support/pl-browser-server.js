const path = require('path');
const express = require('express');

const app = express();
app.use(express.json());

let workspace = null;
const submissions = new Map();

app.get('/api/v2/features', (req, res) => res.json({ success: true, features: {
    durableSubmissions: true, serverSessions: true, serverWorkspaces: true,
    plDatabaseSubmissions: true, sessionDepartments: { PL: true, PTFE: false, PI: false }
} }));
app.get('/api/v2/sessions/current', (req, res) => res.json({ success: true, session: {
    name: 'PL Browser Test', role: 'Associate', department: 'PL', kioskId: 'browser-test'
} }));
app.delete('/api/v2/sessions/current', (req, res) => res.json({ success: true }));
app.get('/api/config', (req, res) => res.json({ success: true, data: {
    associates: [{ name: 'Operator A' }, { name: 'Operator B' }],
    sequences: [{ name: 'Inspect' }, { name: 'Spool Check' }],
    events: [{ name: 'Meeting' }, { name: 'Training' }, { name: 'Shift End' }],
    defects: [{ name: 'Wrinkle' }, { name: 'Cut' }]
} }));
app.get('/api/v2/workspaces/current', (req, res) => res.json({ success: true, workspace }));
app.post('/__test__/advance-workspace', (req, res) => {
    if (!workspace) return res.status(409).json({ success: false });
    workspace = { ...workspace, version: workspace.version + 1 };
    res.json({ success: true, workspace });
});
app.put('/api/v2/workspaces/current', (req, res) => {
    if (workspace && req.body.version !== workspace.version) {
        return res.status(409).json({ success: false, error: 'Workspace was updated by another tab.', workspace });
    }
    workspace = { ...req.body, id: workspace?.id || 'preview-workspace', version: (workspace?.version || 0) + 1 };
    res.json({ success: true, workspace });
});
app.post('/api/v2/submissions', (req, res) => {
    const duplicate = submissions.has(req.body.id);
    const submission = submissions.get(req.body.id) || {
        id: req.body.id, entryType: req.body.entryType, workDate: req.body.workDate,
        lifecycleStatus: 'accepted', syncStatus: 'pending'
    };
    submissions.set(req.body.id, submission);
    if (workspace) workspace = { ...workspace, formData: {}, hasUnsavedWork: false, version: workspace.version + 1 };
    res.status(duplicate ? 200 : 201).json({ success: true, duplicate, submission });
});
app.get('/api/v2/submissions/:id', (req, res) => {
    const submission = submissions.get(req.params.id);
    if (!submission) return res.status(404).json({ success: false, error: 'Submission not found.' });
    submission.syncStatus = 'submitted';
    res.json({ success: true, submission });
});

app.use(express.static(path.join(__dirname, '..', '..', 'public')));

const port = Number(process.env.PORT || 3101);
app.listen(port, '127.0.0.1', () => console.log(`PL browser preview listening on http://127.0.0.1:${port}/pl/`));
