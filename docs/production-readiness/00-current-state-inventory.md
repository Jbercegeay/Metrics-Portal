# Current-State Inventory

## Inventory Scope

This inventory records the verified local development baseline for Phase 0. It intentionally lists configuration names and business fields without recording secret values, employee records, production payloads, or Smartsheet identifiers.

Inventory date: 2026-06-19.

## Host And Runtime

| Item | Verified local state |
| --- | --- |
| Operating system | Windows 11 Enterprise, 64-bit, version 10.0.26100 |
| Memory | 31.5 GB |
| Local disk | 475.8 GB total, 276.9 GB free at inventory time |
| Node.js | v24.14.0 |
| npm | 11.9.0 |
| PostgreSQL | Not installed or available on `PATH` |
| PM2 | Not installed or available on `PATH` |

This is the development workstation baseline, not proof of the production server specification. Production installation, service ownership, backup storage, and recovery responsibilities still require confirmation.

## Application Shape

- One CommonJS Node/Express process starts from `server.js`.
- Static browser pages are served from `public/`.
- `public/login.html` handles department selection and login.
- `public/index.html` contains the PL, PTFE, and PI production workflows in one file.
- Department admin pages are already separated as `admin-pl.html`, `admin-ptfe.html`, and `admin-pi.html`.
- Shared backend Smartsheet access and configuration parsing live in `lib/smartsheet.js` and `lib/config.js`.
- There is no application database, migration framework, durable queue, or automated test suite in the baseline.
- The current `npm test` command is a failing placeholder.

## Existing HTTP Endpoints

| Method | Path | Current responsibility |
| --- | --- | --- |
| GET | `/api/config` | Load department configuration from Smartsheet |
| POST | `/api/admin/config/save` | Save department configuration |
| POST | `/api/admin/config/delete` | Delete department configuration entries |
| POST | `/api/login` | Authenticate from department configuration data |
| POST | `/api/setup-password` | Set an initial password |
| POST | `/api/kiosk-lock/release` | Release a kiosk lock |
| POST | `/api/admin/reset-password` | Reset an associate password |
| GET | `/api/admin/kiosk-locks` | List in-memory kiosk locks |
| POST | `/api/admin/kiosk-locks/release` | Administratively release a kiosk lock |
| POST | `/api/submit` | Submit PL data synchronously to Smartsheet |
| POST | `/api/submit-ptfe` | Submit PTFE data synchronously to Smartsheet |
| POST | `/api/submit-ptfe-jxj` | Submit PTFE Job x Job rows synchronously |
| POST | `/api/submit-pi` | Submit PI data synchronously to Smartsheet |
| POST | `/api/submit-pi-jxj` | Submit PI Job x Job rows synchronously |
| GET | `/api/status` | Return a process-level online response |

There are no versioned session, workspace, durable submission, supervisor status, liveness, or readiness APIs yet.

## Authentication, Sessions, And Kiosks

- Users and password hashes are sourced from department Smartsheet configuration.
- Login state and the admin token are stored in browser `localStorage`.
- Kiosk locks are process-memory records and do not survive an application restart.
- Authorization is not yet backed by a durable server session.
- The PL page includes client-side guards for unsaved work and a supervisor reset shortcut.
- PTFE and PI Job x Job state is stored in browser `localStorage`.
- Substantial PL workspace and pending-submission state is also stored in `localStorage`.

## Current Submission Behavior

- Browser requests wait for Smartsheet completion.
- PL uses a short-lived in-process duplicate reservation and browser pending-submission state.
- PTFE and PI use short-lived in-process duplicate reservations.
- These duplicate controls do not survive restart and are not a durable idempotency contract.
- PTFE and PI production writes have environment-controlled safe-mode switches.
- Training accounts are intercepted and do not write production rows.
- Smartsheet client calls have a 30-second timeout and limited transient retry behavior.
- A partial PL multi-sequence submission can acknowledge some rows before a later row fails.

## Smartsheet Integration Inventory

### Precision Liner

Configured destinations and sources include the department configuration sheet, master log, defect seeds, historical yields, items, and an obsolete hour-by-hour sheet reference.

The PL master-log mapping includes:

- Entry type, work date, associate, sequence, lot, item, minutes, notes, and event.
- Start and end quantity.
- PTFE, Etch, Teco, and Pebax operator fields.
- Yield/comment indicators.
- Fixed and dynamically persisted defect columns.

### PTFE

Configured sources and destinations include configuration, master log, standards, items, historical yields, holidays, and Job x Job log sheets.

Master-log fields currently written are entry type, associate, date, time worked, item, lot, quantities, sequence, footage, processing length, scrap values, re-cuts, inspection and pulling paretos, pulling wraps and method, event, and comments.

### Polyimide

Configured sources and destinations mirror PTFE: configuration, master log, standards, items, historical yields, holidays, and Job x Job log sheets.

The current PI master-log field contract matches the PTFE field list. PI additionally rejects startup-time mapping use when required master-log columns are missing.

## Configuration Name Inventory

The local environment currently defines names for:

- Department API tokens for PL, PTFE, and PI.
- Department configuration and master-log sheet IDs.
- PL defect seed, historical yield, item, and hour-by-hour sheet IDs.
- PTFE and PI standards, items, historical yields, holidays, and Job x Job sheet IDs.
- PTFE and PI master-log write enablement flags.
- CORS origin, server host, port, and portal usage log sheet ID.

Code also supports `KIOSK_LOCK_TTL_MS`, `MASTER_LOG_DUPLICATE_WINDOW_MS`, and `SHOW_LAN_HINT`, even when those names are not present in the local `.env` file.

## Current Operational Utilities

- Smartsheet defect-column migration.
- Configuration-column condensation.
- Master-log duplicate dry-run and scheduled cleanup scripts.
- PI Smartsheet validation.
- PowerShell development serving helper.

Operational database backup, restore, migration, queue inspection, and recovery utilities do not exist yet.

## Baseline Risks Confirmed By Inspection

- The only authoritative copy of active work can reside in the browser.
- Authentication and kiosk ownership can be lost on process restart or manipulated client-side.
- Smartsheet latency and availability determine the current save result.
- Duplicate protection is process-local and time-window based.
- One combined production page creates cross-department regression risk.
- No automated suite currently proves calculations, API behavior, failure recovery, or browser workflows.
- No database backup or restore evidence exists because the database foundation has not been introduced.

## Phase 0 Items Requiring External Confirmation

- Product, technical, operations, and UAT owners.
- Production server specifications and company IT restrictions.
- PostgreSQL installation, patching, backup, and recovery owner.
- Off-machine backup destination, encryption requirement, and retention.
- HTTPS certificate and internal DNS approach.
- Production hours, maintenance windows, and department cutover windows.
- Current incident, uncertain-save, and confirmed-duplicate baseline counts.
- Approved non-production Smartsheet destinations for integration and UAT.

