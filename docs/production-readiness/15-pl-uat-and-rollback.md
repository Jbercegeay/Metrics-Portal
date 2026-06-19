# Precision Liner UAT And Rollback Rehearsal

## Purpose

This rehearsal proves the PL browser workflow and feature-flag rollback without changing either live portal. It uses an isolated PostgreSQL database, the dedicated empty PL integration sheet, a separate web process and worker, and the built-in `test-pl` training account.

The rehearsal portal listens only on `127.0.0.1:3102`. The live three-department Metrics Portal must remain on port 3002 under PM2 name `metrics-portal`. The legacy `PL-Portal` on port 3000 is out of scope. The management script records both live process IDs before every action and fails if either listener changes.

## Participants And Evidence

Record:

- Date and release commit.
- Device and browser.
- PL associate representative.
- PL lead or supervisor.
- Technical observer.
- Each scenario result and any screenshot or defect reference.
- Final approval, rejection, or conditional approval.

The technical rehearsal may use one person in multiple observer roles. Final production approval still requires a PL associate representative and department lead or supervisor.

## Prepare The Pinned Checkout

Create a detached worktree from the exact reviewed commit and install the locked dependencies. Do not use or modify either live checkout.

```powershell
$commit = '<REVIEWED_COMMIT>'
$uatRepo = 'C:\serverdata\staging\metrics-portal-uat'
git -C C:\serverdata\repos\metrics-portal fetch origin codex/windows-operations-tooling
git -C C:\serverdata\repos\metrics-portal worktree add --detach $uatRepo $commit
npm.cmd --prefix $uatRepo ci
```

## Start The Isolated Environment

Run in elevated PowerShell. Replace the placeholder with the dedicated integration-sheet ID. Password prompts are local and masked.

```powershell
& C:\serverdata\staging\metrics-portal-uat\scripts\windows\Manage-PlUatEnvironment.ps1 `
    -Action Start `
    -IntegrationSheetId '<PL_TEST_SHEET_ID>' `
    -Confirmation 'MANAGE ISOLATED PL UAT'
```

The command refuses a non-empty test sheet, a production sheet ID, an existing UAT database, an occupied port 3102, or missing live listeners. It creates `metrics_portal_uat`, applies migrations, grants the application role only runtime access, and starts the isolated web and worker processes. It does not edit the production `.env`.

Open `http://127.0.0.1:3102/login.html`, select Precision Liner, and sign in with the built-in `test-pl` training account. The training password is the value documented in the application source for test accounts.

## Browser Scenarios

Use visibly synthetic values and never enter employee or production data.

| ID | Action | Expected result |
| --- | --- | --- |
| PL-UAT-01 | Sign in as `test-pl` | Browser opens `/pl/`; the page shows the authenticated test identity and a connected workspace. |
| PL-UAT-02 | Leave required job fields empty and submit | Specific validation errors appear; no database or Smartsheet row is created. |
| PL-UAT-03 | Enter a synthetic six-digit item, synthetic lot, normal sequence, time, quantity, and `[UAT]` note; refresh before submitting | The server-owned draft reloads with the same values. |
| PL-UAT-04 | Open a second tab, change the same draft in both tabs, then save the older tab | The stale tab reports a conflict and offers to load the server copy. |
| PL-UAT-05 | Attempt sign-out with an unsent draft | Sign-out is blocked until the work is submitted or intentionally discarded with a reason. |
| PL-UAT-06 | Submit one valid synthetic job and click Submit repeatedly | One logical database submission is accepted; the page distinguishes database saved from Smartsheet pending/synced. |
| PL-UAT-07 | Refresh and use Refresh status | The accepted submission remains queryable and reaches synced status without a duplicate. |
| PL-UAT-08 | Submit one synthetic event with valid start/end times | One event is accepted and reaches synced status. |
| PL-UAT-09 | Sign out after all work is clear | Sign-out succeeds and returns to login. |
| PL-UAT-10 | At 768 by 1024 browser viewport, repeat basic navigation | No horizontal overflow blocks entry or submission. |

Stop and record a blocking defect for data loss, duplicate rows, cross-associate data, incorrect calculations, failed recovery, or an unusable common workflow. Do not proceed to production expansion with a Critical or High defect open.

## Rehearse Rollback

After the full-feature scenarios, run:

```powershell
& C:\serverdata\staging\metrics-portal-uat\scripts\windows\Manage-PlUatEnvironment.ps1 `
    -Action Rollback `
    -Confirmation 'MANAGE ISOLATED PL UAT'
```

The script stops only the isolated web and worker, disables the migration feature chain, restarts the isolated web process, and verifies the PL migration flags are off. It leaves the isolated database intact for evidence and cleanup.

Open a private browser window at `http://127.0.0.1:3102/login.html` and sign in as `test-pl` again. Acceptance requires the combined compatibility page rather than `/pl/`. Do not submit compatibility-page data during this check.

## Clean Up

After recording results, remove all isolated artifacts:

```powershell
& C:\serverdata\staging\metrics-portal-uat\scripts\windows\Manage-PlUatEnvironment.ps1 `
    -Action Stop `
    -IntegrationSheetId '<PL_TEST_SHEET_ID>' `
    -Confirmation 'MANAGE ISOLATED PL UAT'
```

Cleanup stops the isolated process, clears every row from the dedicated UAT sheet, drops only `metrics_portal_uat`, and verifies the listeners on ports 3000 and 3002 retain their original process IDs. Logs remain in `C:\serverdata\staging\metrics-portal-uat-runtime` for the acceptance record; they must be reviewed for errors and then handled under the approved retention policy.

## Acceptance Record

| Field | Result |
| --- | --- |
| Release commit | |
| Date and time | |
| Device and browser | |
| Associate representative | |
| Department lead or supervisor | |
| Technical observer | |
| PL-UAT-01 through PL-UAT-10 | |
| Rollback returned new login to compatibility page | |
| Test sheet empty after cleanup | |
| Isolated database removed | |
| Live port 3002 process unchanged | |
| Legacy port 3000 process unchanged | |
| Defects and severity | |
| Approval decision and approver | |
