# Precision Liner Page Migration

## Scope

The Precision Liner migration page is served from `/pl/` and is isolated from the combined compatibility page. It owns PL job and event entry only. PTFE and Polyimide continue using the compatibility page until their rollout phases.

The isolated module intentionally does not contain the legacy hour-by-hour tracker, End Shift workflow, browser-local associate switching, supervisor PIN reset, or `localStorage` production workspace. Shared-kiosk transfer occurs through authenticated sign-out and the next associate's sign-in.

## Entry And Rollback

PL associates are redirected to `/pl/` only when login created a PL server session. All rollout features remain disabled by default. The compatibility route remains available when the feature chain is disabled.

Required enablement order:

```text
DATABASE_ENABLED=true
SERVER_SESSIONS_ENABLED=true
PL_SERVER_SESSIONS_ENABLED=true
SERVER_WORKSPACES_ENABLED=true
DURABLE_SUBMISSIONS_ENABLED=true
PL_DATABASE_SUBMISSIONS_ENABLED=true
```

Rollback disables `PL_DATABASE_SUBMISSIONS_ENABLED` and `PL_SERVER_SESSIONS_ENABLED`, restarts the web process, and returns new PL logins to the compatibility page. Database rows remain for audit and reconciliation.

## Workspace Behavior

- The server owns the current form, entry mode, work date, dirty state, and optimistic version.
- Edits autosave after a short debounce.
- A stale browser tab receives HTTP 409 and stops saving until the associate explicitly loads the authoritative server copy.
- Sign-out is blocked for unsent work. Intentional discard requires confirmation and a reason recorded by the session service.
- Successful database capture clears the active form while retaining the latest submission status in the workspace.

## Submission Behavior

Each PL job or event is one logical durable submission and receives one permanent browser-generated UUID. The pending UUID and exact payload are saved to the server workspace before capture. A network or response failure leaves that identity in the workspace so Retry confirms or replays the same logical request without creating another database row.

The operator sees two separate states:

1. Database saved: the portal has durably accepted the entry and the form may clear.
2. Smartsheet pending or synced: the background worker owns delivery and exact-ID confirmation.

Job payloads preserve the existing master-log titles for entry type, sequence, lot, item, quantities, minutes, notes, defects, Spool Check details, yield indicator, and root-cause fields. Associate, department, kiosk, and work date ownership are enforced by the authenticated API envelope.

## Validation Evidence

- PL model tests cover field validation, six-digit items, low-yield notes, Spool Check requirements, defect totals, quantity/yield calculations, exact Smartsheet titles, event duration, dirty state, and pending retry identity.
- API coverage verifies the safe rollout-state endpoint.
- Real-browser validation covers server autosave, job capture, event capture, form reset, pending/synced messaging, and a 768 by 1024 responsive kiosk viewport without horizontal overflow.
- Clean PostgreSQL migration and API validation is required in CI before this branch can be considered ready for controlled test-sheet validation.

## Remaining Cutover Gates

- Add and verify the exact `Submission ID` destination column on the controlled PL test and production master logs.
- Run worker delivery against the controlled PL test sheet and compare every mapped column with the compatibility output.
- Complete supervised PL floor UAT, owner sign-off, and rollback rehearsal.
- Enable only during the approved PL window after HTTPS, database backup, monitoring, and worker process prerequisites are verified.

Run the read-only destination audit from an environment configured for the intended PL sheet:

```powershell
npm run validate:pl-destination
```

The audit reads the PL configuration and master-log columns only. It does not read or print row contents and does not change the destination. A nonzero exit identifies missing exact titles, duplicate writable titles, formulas in writable columns, or an invalid `Submission ID` type.
