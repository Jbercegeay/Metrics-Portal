(function attachAuthRouting(root, factory) {
    const routing = factory();
    if (typeof module === 'object' && module.exports) module.exports = routing;
    else root.AuthRouting = routing;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createAuthRouting() {
    function adminDestination(department) {
        if (department === 'PTFE') return '/admin-ptfe.html';
        if (department === 'PI') return '/admin-pi.html';
        if (department === 'PL') return '/admin-pl.html';
        return '/';
    }

    function loginDestination(response) {
        const user = response.user || {};
        const department = user.departmentKey || 'PL';
        if (user.role === 'Supervisor' && response.adminToken) return adminDestination(department);
        if (department === 'PL' && response.serverSession) return '/pl/';
        return '/';
    }

    return { adminDestination, loginDestination };
}));
