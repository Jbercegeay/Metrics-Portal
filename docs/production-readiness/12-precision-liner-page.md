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

## Completed Validation Gates

- The controlled PL test destination and production master log have the exact `Submission ID` column contract required for idempotent delivery.
- The PL configuration sheet has an `Operators` column seeded from the legacy RCA roster, and the isolated PL page reads that column for root-cause operator dropdowns instead of department associates.
- Worker delivery was validated against a controlled PL test sheet, including full-column mapped values, exact-ID replay, and synthetic row cleanup.
- Target database/outbox delivery was validated against the controlled test destination with no unexpected pending work.
- Supervised PL floor UAT, associate/supervisor sign-off, rollback rehearsal, guarded cleanup, fresh backup, and production destination expansion are complete.

## Remaining Cutover Gates

- Merge the approved stacked pull requests into `main` and create the release commit or tag.
- Deploy the release to the Metrics Portal process on port 3002 with PL database/session flags still disabled.
- Run post-deployment health checks and compatibility smoke tests.
- Enable PL only during the approved PL window after TLS/DNS, alert routing, backup freshness, monitoring, and worker process prerequisites are verified.

Run the read-only destination audit from an environment configured for the intended PL sheet:

```powershell
npm run validate:pl-destination
```

The audit reads the PL configuration and master-log columns only. It does not read or print row contents and does not change the destination. A nonzero exit identifies missing exact titles, duplicate writable titles, formulas in writable columns, or an invalid `Submission ID` type.

When no approved non-production destination exists, generate an empty contract-only sheet. The dry run reads only the configured PL defect names and creates nothing:

```powershell
npm run create:pl-integration-sheet
```

Create the sheet only after reviewing the name and column count:

```powershell
npm run create:pl-integration-sheet -- --apply --confirmation="CREATE EMPTY PL INTEGRATION SHEET"
```

The generated sheet contains the exact PL destination columns as text-compatible fields, with `Submission ID` as its primary column. It contains no rows and copies no production values, formulas, automation, attachments, sharing, or employee data. Record the returned sheet ID in the approved integration environment only, never in Git or program memory.

With `PL_INTEGRATION_SHEET_ID` set only in the current process, validate a synthetic delivery, exact-ID replay, mapped values, and cleanup:

```powershell
npm run validate:pl-integration-delivery -- --confirmation="WRITE AND DELETE PL INTEGRATION ROW"
```

The command refuses the configured production master-log ID. It writes one visibly synthetic row covering every destination column, waits up to ten minutes for Smartsheet search indexing, proves a replay finds the same row without another insert, verifies every mapped cell value, and deletes every row it created. Smartsheet documents that new data may not be immediately searchable and that an API search index that has not been provisioned recently can take substantially longer; a timeout is therefore a pending external-index gate, not permission to retry an insert in production.

After the target database is migrated, run a one-shot database-to-outbox-to-test-sheet proof with the application-role `DATABASE_URL` and `PL_INTEGRATION_SHEET_ID` set only in the current process:

```powershell
npm run validate:pl-outbox-integration -- --confirmation="VALIDATE PL DATABASE OUTBOX"
```

The command refuses the production destination and any pre-existing pending/processing queue. It captures one synthetic submission transactionally, processes exactly one worker lease, verifies the submission/outbox/delivery records converge to `submitted`, verifies no unexpected work remains, then removes its test-sheet row and related synthetic database records.

## Production Destination Expansion

Do not execute this step until PL floor-user approval is recorded. The default command is read-only and reports whether the configured production destination needs exactly one additive `Submission ID` column:

```powershell
npm run migrate:pl-submission-id
```

The utility blocks if any other required column is missing, if writable titles are duplicated, if writable columns contain formulas, or if an existing `Submission ID` has an incompatible type. After approval and a fresh verified backup, apply the one-column expansion with:

```powershell
npm run migrate:pl-submission-id -- --apply --confirmation="ADD PL PRODUCTION SUBMISSION ID"
```

The apply mode adds one empty `TEXT_NUMBER` column at the end of the configured PL master log, changes no existing row values, and immediately rereads the column contract. Rerun `npm run validate:pl-destination` after completion and retain the output with the release evidence.

Completion evidence (2026-06-22): the approved apply expanded the production PL destination from 58 to 59 columns, changed zero existing row values, verified Submission ID as TEXT_NUMBER, and the complete read-only destination contract returned READY.
