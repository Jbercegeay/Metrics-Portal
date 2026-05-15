# Changelog

All notable production changes to the Metrics Portal are tracked here.

This project uses semantic versioning:

- `MAJOR` changes for new department rollouts, major workflow changes, or breaking Smartsheet/config changes.
- `MINOR` changes for new features, new admin tools, new reports, or meaningful operator/supervisor workflow improvements.
- `PATCH` changes for bug fixes, wording fixes, validation fixes, and low-risk production corrections.

Changelog entries are not required for every commit. Add entries under `Unreleased` when a change affects production users, admin behavior, Smartsheet mappings, validation, reporting, deployment, or supportability. Move `Unreleased` entries into a dated version when the change is approved for release/deployment.

## Unreleased

### Added

- Started the multi-associate kiosk workspace rollout for Precision Liner with a prominent active-associate banner, open-work badges, per-associate submit labels, and detailed submit confirmations.
- Moved Precision Liner associate switching into a dedicated Associate Workspaces panel and added matching PTFE/Polyimide workspace entry panels for the shared-workstation rollout.
- Scoped the Precision Liner KPI board to only the selected associate workspace.

## v1.1.0 - 2026-05-15

### Added

- Added the top KPI board to PTFE and Polyimide so all three department portals show the same Availability, Performance, Quality, Overall OE/OEE, and Good Parts layout.

## v1.0.0 - 2026-05-15

### Added

- Formal production baseline for the multi-department Metrics Portal.
- Polyimide production portal with job entry, event entry, standards lookup, quality checks, and Job x Job tracker support.
- Polyimide admin portal for associates, schedules, sequences, events, pareto lists, items, and PPH standards.
- Department-aware admin routing for Precision Liner, PTFE, and Polyimide supervisors.
- Read-only PI Smartsheet environment validator via `npm run validate:pi`.
- Browser-accessible changelog page linked from the portal and admin pages.

### Changed

- Expanded shared Smartsheet config loading for PL, PTFE, and PI department-specific sheets.
- Updated login/admin routing so supervisors land in the correct department admin portal.
- Enabled PI Master Log and PI Job x Job mapping support, including live sheet aliases for `OE Pct` and `Time Min`.
- Updated visible portal release label to `v1.0.0`.

### Fixed

- Replaced garbled admin delete-button text with readable `Delete` labels.
- Replaced garbled admin cell placeholder text with `None`.
- Added six-digit item number validation across PL, PTFE, and PI submission paths.
- Added backend item number validation as a safety net for Master Log and Job x Job submissions.

### Validation

- Ran `node --check server.js`.
- Parsed `public/index.html` inline scripts successfully.
- Ran `npm run validate:pi`.
- Completed test-account submission flows for PI and PTFE in the browser.
- Verified PL test-account submission path through the local API.
