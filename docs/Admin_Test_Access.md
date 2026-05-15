# Admin Panel — Test Access Reference

**Audience:** Supervisors and developers testing admin panel functionality  
**Last updated:** 2026-05-13

---

## Purpose

These URLs provide direct access to each department's admin panel using a built-in test supervisor account. They are intended for testing configuration changes, verifying admin panel behavior, and onboarding new supervisors before they have a real account.

No credentials are required — visiting the URL logs you in automatically.  
**Submissions from test accounts are never written to Smartsheet.**

---

## Test Access URLs

| Department | Admin Panel | URL |
|---|---|---|
| PrecisionLiner | PL Admin (`admin-pl.html`) | `http://localhost:3000/admin-test.html?dept=PL` |
| PTFE | PTFE Admin (`admin-ptfe.html`) | `http://localhost:3000/admin-test.html?dept=PTFE` |
| Polyimide | PI Admin (`admin-pi.html`) | `http://localhost:3000/admin-test.html?dept=PI` |

---

## How It Works

- Each URL auto-authenticates as a hidden test supervisor account (`test-pl-super`, `test-ptfe-super`, `test-pi-super`)
- Associate training accounts: `test-pl` (PrecisionLiner), `test-ptfe` (PTFE), `test-pi` (Polyimide)
- The session expires after 8 hours, same as a normal supervisor login
- These accounts do **not** appear on the public login screen
- Password for all test accounts (if ever needed directly): `trenton1`

---

## Notes

- The PI admin panel is available at `admin-pi.html`.
- If the page shows "Login Failed", the server may be down or the session store was restarted. Refresh the URL to re-authenticate.
- To sign out of a test session, clear `localStorage` or close the browser tab.
