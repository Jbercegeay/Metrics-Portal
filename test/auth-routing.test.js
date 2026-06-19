const assert = require('node:assert/strict');
const test = require('node:test');
const { loginDestination } = require('../public/shared/auth-routing');

test('PL associates enter isolated page only when login created a server session', () => {
    const user = { name: 'Associate', role: 'Associate', departmentKey: 'PL' };
    assert.equal(loginDestination({ user, serverSession: true }), '/pl/');
    assert.equal(loginDestination({ user, serverSession: false }), '/');
});

test('other departments retain compatibility routing during their deferred phases', () => {
    assert.equal(loginDestination({ user: { role: 'Associate', departmentKey: 'PTFE' }, serverSession: true }), '/');
    assert.equal(loginDestination({ user: { role: 'Associate', departmentKey: 'PI' }, serverSession: true }), '/');
});

test('supervisors retain department admin routing', () => {
    assert.equal(loginDestination({ user: { role: 'Supervisor', departmentKey: 'PL' }, adminToken: 'token', serverSession: true }), '/admin-pl.html');
    assert.equal(loginDestination({ user: { role: 'Supervisor', departmentKey: 'PTFE' }, adminToken: 'token' }), '/admin-ptfe.html');
});
