# Multi-Department Portal PRD

Last updated: 2026-05-12

## Purpose

Expand the current PrecisionLiner portal into a multi-department production portal that supports PrecisionLiner, PTFE, and Polyimide without breaking the live PrecisionLiner workflow.

## Goals

- Keep PrecisionLiner behavior stable while adding department-aware infrastructure.
- Add PTFE first, prove the shared architecture, then add Polyimide using the same pattern.
- Route every login, config load, and submission to the correct department Smartsheet resources.
- Replace standalone PTFE/Polyimide HTML portals with server-backed portal views.
- Preserve training-mode accounts that do not write to Smartsheet.

## Non-Goals For Initial Rollout

- Do not rebuild the admin panel for PTFE/Polyimide yet.
- Do not implement PTFE/Polyimide hour-by-hour tracking until the format is decided.
- Do not migrate away from Smartsheet.
- Do not rewrite the PrecisionLiner UI unless required to support department routing.

## Rollout Strategy

Use phased delivery, not a one-shot build.

1. **Foundation:** department-aware config, login, Smartsheet clients, and routing. PrecisionLiner must continue working.
2. **PTFE:** first new department view and submit flow.
3. **Polyimide:** mirror the PTFE pattern with PI-specific calculation differences.
4. **Later:** department-aware admin panel, hour-by-hour design, training/docs updates.

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

The final login flow should support choosing a department first, then loading that department's associate list. The server authenticates against the selected department's Master Configuration sheet and returns the user role plus department.

Until the frontend selector is built, existing PrecisionLiner login behavior must continue to work as the default path.

## Acceptance Criteria

- PrecisionLiner users can log in and submit exactly as before.
- PTFE and PI config sheets can be loaded with their own tokens.
- Test accounts exist and bypass Smartsheet writes:
  - `test1`
  - `test2`
  - `test-ptfe`
  - `test-pi`
- Department routing cannot accidentally submit a PTFE or PI row to PrecisionLiner sheets.
- Hour-by-hour for PTFE/PI displays as deferred until its format is approved.

## Open Decisions

- Final PTFE/PI hour-by-hour data model.
- Whether the first PTFE view is built inside `public/index.html` or split into department-specific frontend modules.
- Timing for a department-aware admin panel.
