(function attachApiClient(root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.PortalApi = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createApiClient() {
    class ApiError extends Error {
        constructor(message, status, data) {
            super(message);
            this.name = 'ApiError';
            this.status = status;
            this.data = data;
        }
    }

    async function request(url, options = {}) {
        const response = await fetch(url, {
            credentials: 'same-origin',
            ...options,
            headers: {
                ...(options.body ? { 'Content-Type': 'application/json' } : {}),
                ...(options.headers || {})
            }
        });
        let data = {};
        try {
            data = await response.json();
        } catch (error) {
            data = {};
        }
        if (!response.ok || data.success === false) {
            throw new ApiError(data.error || `Request failed (${response.status}).`, response.status, data);
        }
        return data;
    }

    return {
        ApiError,
        getFeatures: () => request('/api/v2/features'),
        getSession: () => request('/api/v2/sessions/current'),
        signOut: (discard, reason) => request(`/api/v2/sessions/current${discard ? '?discard=true' : ''}`, {
            method: 'DELETE',
            body: JSON.stringify({ reason: reason || '' })
        }),
        getWorkspace: () => request('/api/v2/workspaces/current'),
        saveWorkspace: (workspace) => request('/api/v2/workspaces/current', {
            method: 'PUT',
            body: JSON.stringify(workspace)
        }),
        createSubmission: (submission) => request('/api/v2/submissions', {
            method: 'POST',
            body: JSON.stringify(submission)
        }),
        getSubmission: (id) => request(`/api/v2/submissions/${encodeURIComponent(id)}`),
        getPlConfig: () => request('/api/config?dept=PL')
    };
}));
