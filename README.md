# Multi-Department Metrics Portal

A manufacturing metrics portal for PrecisionLiner, PTFE, and future Polyimide production workflows. The application serves static browser pages from an Express backend and writes production/admin data to department-specific Smartsheet resources.

## Features

- Department-aware login for PL, PTFE, and future PI.
- PrecisionLiner production tracking with PCD/hour-by-hour workflow.
- PTFE production entry with standards lookup, pareto capture, and Job x Job tracker.
- Department-specific admin pages for PL and PTFE.
- Smartsheet-backed configuration, authentication, and production logs.
- Test accounts for local validation without Smartsheet writes.

## Technology Stack

- Frontend: plain HTML, CSS, and JavaScript.
- Backend: Node.js with Express.
- API integration: Axios for Smartsheet.
- Environment management: Dotenv for local `.env` files.

## Prerequisites

- Node.js v18 or higher.
- npm.
- Valid department-scoped Smartsheet API tokens and sheet IDs.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Configure `.env` in the repo root:

   ```env
   DEPT_PL_API_TOKEN=your_pl_access_token_here
   DEPT_PL_CONFIG_SHEET_ID=your_pl_config_sheet_id_here
   DEPT_PL_MASTER_LOG_SHEET_ID=your_pl_master_log_sheet_id_here
   DEPT_PL_HOUR_BY_HOUR_SHEET_ID=your_pl_hour_by_hour_sheet_id_here
   DEPT_PL_DEFECT_SEEDS_SHEET_ID=your_pl_defect_seed_sheet_id_here

   DEPT_PTFE_API_TOKEN=your_ptfe_access_token_here
   DEPT_PTFE_CONFIG_SHEET_ID=your_ptfe_config_sheet_id_here
   DEPT_PTFE_ITEMS_SHEET_ID=your_ptfe_items_sheet_id_here
   DEPT_PTFE_STANDARDS_SHEET_ID=your_ptfe_standards_sheet_id_here
   DEPT_PTFE_MASTER_LOG_SHEET_ID=your_ptfe_master_log_sheet_id_here
   DEPT_PTFE_JOB_LOG_SHEET_ID=your_ptfe_job_log_sheet_id_here

   DEPT_PI_API_TOKEN=your_pi_access_token_here
   DEPT_PI_CONFIG_SHEET_ID=your_pi_config_sheet_id_here
   DEPT_PI_ITEMS_SHEET_ID=your_pi_items_sheet_id_here
   DEPT_PI_STANDARDS_SHEET_ID=your_pi_standards_sheet_id_here
   DEPT_PI_MASTER_LOG_SHEET_ID=your_pi_master_log_sheet_id_here
   DEPT_PI_JOB_LOG_SHEET_ID=your_pi_job_log_sheet_id_here

   # Safety: PTFE and PI submissions are simulated unless enabled.
   ALLOW_PTFE_MASTER_LOG_WRITES=false
   ALLOW_PI_MASTER_LOG_WRITES=false
   ```

3. Start the app:

   ```bash
   node server.js
   ```

   or:

   ```bash
   npm start
   ```

4. Open `http://localhost:3000`.

## Production Hosting

The current server PC uses Task Scheduler to run `pm2.cmd resurrect`. PM2 restores the saved `PL-Portal` process, which points to:

- `C:\ServerData\Repos\Precision-Liner-Portal\server.js`
- `C:\ServerData\Repos\Precision-Liner-Portal`

So the current deployment path is the Express app in `server.js`.

## Project Structure

- `server.js`: Main Express backend, API routes, auth, admin endpoints, and Smartsheet write logic.
- `lib/config.js`: Department config parsing and supplemental PTFE/PI item/standards loading.
- `lib/smartsheet.js`: Smartsheet client factory and retry behavior.
- `public/index.html`: Main production portal entry point for PL, PTFE, and PI.
- `public/login.html`: Department-aware login and password setup.
- `public/admin.html`: Generic admin entry point that routes supervisors to department admin pages.
- `public/admin-pl.html`: PrecisionLiner admin panel.
- `public/admin-ptfe.html`: PTFE admin panel.
- `public/admin-pi.html`: Polyimide admin panel.
- `public/admin-test.html`: Local test-supervisor shortcut for PL/PTFE admin validation and PI portal validation.
- `public/changelog.html`: Browser-facing release notes linked from the portal.
- `CHANGELOG.md`: Canonical release notes and versioning policy.
- `api/config.js`: Serverless-style compatibility handler. The current production deployment uses `server.js`.
- `Brainstorming/`: Planning, implementation specs, and future roadmap notes.
- `docs/`: SOP/training documents.
- `scripts/`: One-off utilities.

## Release Versioning

The first formal multi-department production baseline is `v1.0.0`.

Use semantic versioning:

- Major versions for new department rollouts, major workflow changes, or breaking Smartsheet/config changes.
- Minor versions for new features, new admin tools, new reports, or meaningful operator/supervisor workflow improvements.
- Patch versions for bug fixes, wording fixes, validation fixes, and low-risk production corrections.

Do not update the changelog for every commit. Add entries to `CHANGELOG.md` under `Unreleased` when a change affects production users, admin behavior, Smartsheet mappings, validation, reporting, deployment, or supportability. Move those entries into a dated version when the change is approved for release/deployment.

## Validation

- `npm run validate:pi` runs a read-only PI environment and Smartsheet column mapping check.

## Test Accounts

Password for all test accounts: `trenton1`.

- `test-pl`
- `test-pl-super`
- `test-ptfe`
- `test-ptfe-super`
- `test-pi`
- `test-pi-super`

## Notes

- `npm test` is still a placeholder and should not be treated as validation.
- PTFE writes are controlled by `ALLOW_PTFE_MASTER_LOG_WRITES`.
- PI Master Log and PI Job x Job writes are controlled by `ALLOW_PI_MASTER_LOG_WRITES`; keep false until PI validation is approved and `DEPT_PI_JOB_LOG_SHEET_ID` exists.
- Keep `.env` local and out of commits.
