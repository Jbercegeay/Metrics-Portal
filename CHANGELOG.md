# Changelog

All notable production changes to the Metrics Portal are tracked here.

This project uses semantic versioning:

- `MAJOR` changes for new department rollouts, major workflow changes, or breaking Smartsheet/config changes.
- `MINOR` changes for new features, new admin tools, new reports, or meaningful operator/supervisor workflow improvements.
- `PATCH` changes for bug fixes, wording fixes, validation fixes, and low-risk production corrections.

Changelog entries are not required for every commit. Add entries under `Testing` when a change affects production users, admin behavior, Smartsheet mappings, validation, reporting, deployment, or supportability and is available for validation. Move `Testing` entries into a dated version when the change is approved for production release.

## v1.2.0 Testing

### Added

- Prepared the v1.2.0 multi-associate shared-workstation release across Precision Liner, PTFE, and Polyimide with independent associate workspaces, active-associate submit attribution, open-work badges, and per-associate Job x Job tracking.
- Moved Precision Liner associate switching into a dedicated Associate Workspaces panel and added matching PTFE/Polyimide workspace panels for the shared-workstation rollout.
- Added active kiosk locks so an associate cannot be signed into two different workstations at the same time.

### Changed

- Removed the live KPI/OEE banner from the department entry portals so production reporting can be handled through Smartsheet and Power BI instead of duplicated in the portal UI.
- Improved PL, PTFE, and Polyimide admin panels so table rows and dropdown choices render alphabetically regardless of Smartsheet row order.
- Added top Save buttons and top-insert behavior to admin panel Add actions so new blank rows are immediately editable without scrolling to the bottom of a table.
- Updated PTFE and Polyimide PPH Standards admin workflows so supervisors can add a full item standard group from an item number and delete an entire item group at once.

### Fixed

- Updated supervisor reset to clear the current multi-associate Job x Job tracker storage for PL, PTFE, and Polyimide.
- Allowed shared-workstation associate names to submit to PTFE/PI Smartsheet logs even when the destination sheet's Associate Name column has strict picklist validation.
- Improved PTFE/Polyimide Job x Job trackers so submissions jump to the matching sequence tab, tabs show job counts, and each associate remembers their active tracker tab.
- Fixed PTFE/Polyimide Job x Job end-shift submission by no longer writing to Smartsheet's system-managed Submitted At column.
- Updated PTFE/Polyimide End Shift so it signs out only the active associate and transfers the workstation to any remaining associate instead of returning the whole kiosk to login.
- Removed Job x Job shift summary rows from the PTFE/Polyimide tracker UI and Smartsheet end-shift submissions.
- Clarified PTFE/Polyimide station Logout behavior so full portal logout clears workstation state, while End Shift remains an active-associate-only action.
- Renamed the PTFE/Polyimide top exit action to Exit Without Submitting and made it discard only the active associate's local workspace/tracker before transferring the kiosk when others remain.
- Added a PTFE/Polyimide End Shift guard that blocks shift closeout when the active associate still has unsent data in the current entry form.
- Updated Precision Liner's top associate action to Exit Without Submitting so it discards only the selected local workspace instead of submitting data under the older Logout flow.
- Updated Polyimide admin Cell dropdown handling so the Associate Schedule Cell list is populated from Smartsheet-backed values with a local fallback list for resilience.

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
