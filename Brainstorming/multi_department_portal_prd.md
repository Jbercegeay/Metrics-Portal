# Multi-Department Portal PRD

Last updated: 2026-05-13

## Purpose

Expand the current PrecisionLiner portal into a multi-department production portal that supports PrecisionLiner, PTFE, and Polyimide without breaking the live PrecisionLiner workflow.

## Goals

- Keep PrecisionLiner behavior stable while adding department-aware infrastructure.
- Add PTFE first, prove the shared architecture, then add Polyimide using the same pattern.
- Route every login, config load, and submission to the correct department Smartsheet resources.
- Replace standalone PTFE/Polyimide HTML portals with server-backed portal views.
- Preserve training-mode accounts that do not write to Smartsheet.

## Non-Goals For Initial Rollout

- Do not rebuild the admin panel for Polyimide yet.
- Do not migrate away from Smartsheet.
- Do not rewrite the PrecisionLiner UI unless required to support department routing.

> **Note (2026-05-13):** PTFE Job x Job tracker is built and live. The tracker is job-by-job (not hour-by-hour) for 4 of 5 cells; Roll Cut uses HR slots. PI tracker format will follow the same pattern when PI is built.

## Rollout Strategy

Use phased delivery, not a one-shot build.

1. **Foundation:** department-aware config, login, Smartsheet clients, and routing. PrecisionLiner must continue working. ✅ **COMPLETE**
2. **PTFE:** first new department view and submit flow. ✅ **COMPLETE** (Phase 1 + 1.5)
3. **Polyimide:** mirror the PTFE pattern with PI-specific calculation differences. ⏳ **NOT STARTED**
4. **Later:** PI admin panel, training/docs updates, and frontend modularization.

## Department Model

Internal routing keys stay short and stable:

- `PL`
- `PTFE`
- `PI`

Smartsheet `Department` display values are:

- `PrecisionLiner`
- `PTFE`
- `Polyimide`

Code should use routing keys for env lookup and endpoint decisions. Display values should be treated as labels returned from config rows, not as env keys.

## Configuration Source

Each department has a Master Configuration sheet with associate rows, sequence rows, event rows, Pareto rows where applicable, and department labels.

The `.env` file contains department-scoped tokens and sheet IDs:

- `DEPT_PL_*`
- `DEPT_PTFE_*`
- `DEPT_PI_*`

The legacy `SMARTSHEET_ACCESS_TOKEN` pattern should not be reintroduced.

## Login Experience

The login flow supports choosing a department first, then loading that department's associate list. The server authenticates against the selected department's Master Configuration sheet and returns the user role plus department.

## Acceptance Criteria

- PrecisionLiner users can log in and submit exactly as before.
- PTFE and PI config sheets can be loaded with their own tokens.
- Test accounts exist and bypass Smartsheet writes:
- `test-pl`
- `test-pl-super`
- `test-ptfe`
- `test-ptfe-super`
- `test-pi`
- `test-pi-super`
- Department routing cannot accidentally submit a PTFE or PI row to PrecisionLiner sheets.
- PTFE Job x Job tracker works end-to-end. PI tracker will mirror the PTFE pattern after PI is built.

## Open Decisions

- Whether the first PI view is built inside `public/index.html` first, then extracted after validation, or split into a separate frontend module during the PI build.
- Timing for PI admin.
- PI Job x Job tracker cell names and sequence-to-tab mapping (confirm before building).
