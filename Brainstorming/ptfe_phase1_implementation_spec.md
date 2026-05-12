# PTFE Phase 1 Implementation Spec

Last updated: 2026-05-12

## Objective

Add PTFE as the first non-PrecisionLiner department in the portal while preserving the current PrecisionLiner production flow.

## Build Principle

Build the shared department-aware foundation first, then add only the PTFE user workflow needed for job/event submission. Do not build Polyimide in the same pass.

## Required Backend Changes

### Department Smartsheet Clients

Use `getClientForDept(dept)` from `lib/smartsheet.js`.

Supported keys:

- `PL`
- `PTFE`
- `PI`

For PTFE, use:

- `DEPT_PTFE_API_TOKEN`
- `DEPT_PTFE_CONFIG_SHEET_ID`
- `DEPT_PTFE_MASTER_LOG_SHEET_ID`
- `DEPT_PTFE_STANDARDS_SHEET_ID`
- `DEPT_PTFE_ITEMS_SHEET_ID`

### Config Endpoint

Update `/api/config` to accept `?dept=PTFE`.

Expected behavior:

- No `dept` param defaults to `PL`.
- `dept=PL` returns current PrecisionLiner config.
- `dept=PTFE` returns PTFE associates, sequences, events, Pareto lists, items, and standards data.

### Login Endpoint

Update `/api/login` to accept `department`.

Expected behavior:

- Missing department defaults to `PL`.
- Authenticate against the selected department config sheet.
- Return `user.departmentKey` and `user.department`.
- PTFE test account `test-ptfe` must work with training-mode behavior.

### Submit Endpoint

Add a PTFE submit path, either:

- `/api/submit-ptfe`, or
- department-aware `/api/submit` using `department: 'PTFE'`.

Do not reuse PL column maps for PTFE.

PTFE Master Log writes should include:

- `Entry Type`
- `Associate Name`
- `Date`
- `Time Worked`
- `Item`
- `Lot #`
- `Start Quantity`
- `End Quantity`
- `Sequence`
- `Footage`
- `Processing Length`
- `Scrap Parts`
- `Scrap Rate %`
- `Re-Cuts`
- `Inspection Pareto`
- `Pulling Pareto`
- `Pulling Wraps`
- `Pulling Method`
- `Event`
- `Comments`

Exclude formula columns from write maps.

## Required Frontend Changes

### Routing

After login:

- `PL` renders the existing PrecisionLiner portal.
- `PTFE` renders the new PTFE workflow.
- `PI` can show a placeholder until Phase 2.

### PTFE Job Form

Required controls:

- Associate/current user display
- Date
- Item dropdown from PTFE Items sheet
- Lot number
- Sequence dropdown from PTFE Master Configuration
- Time worked
- Footage
- Processing length
- Start quantity
- End quantity
- Scrap parts
- Scrap rate percentage
- Re-cuts
- Comments

Conditional controls:

- Pulling Wraps and Pulling Method for `Pull`.
- Inspection Pareto when low yield and sequence is `Inspection` or `EV3 Inspection`.
- Pulling Pareto when low yield and sequence is `Pull`.

### Events

PTFE event entries use the PTFE Master Configuration `Events` list, including the manually added:

- `Lunch`
- `Break`
- `Bathroom`

### Hour-By-Hour

Show a clear placeholder only:

`Hour-by-hour tracker coming soon.`

Do not create PTFE hour-by-hour sheets or submission code in Phase 1.

## PTFE Calculation Rules

Sequence OE:

```text
OE = actual PPH / standard PPH
actual PPH = End Quantity / Time Worked Hours
```

Standards come from `DEPT_PTFE_STANDARDS_SHEET_ID`.

Scrap fields:

- Portal writes `Scrap Parts`.
- Portal writes `Scrap Rate %`.

## Validation

Required before submit:

- Associate
- Date
- Time worked
- Item
- Lot number
- Sequence
- Start quantity
- End quantity

Required conditionally:

- At least one Inspection Pareto when Inspection Pareto is shown.
- At least one Pulling Pareto when Pulling Pareto is shown.
- Pulling Wraps and at least one Pulling Method when Pull fields are shown.

## Test Plan

1. Confirm PL login and submit still work.
2. Confirm `/api/config?dept=PTFE` loads PTFE data.
3. Log in as `test-ptfe`.
4. Submit PTFE event and confirm simulated success with no Smartsheet write.
5. Submit PTFE job and confirm simulated success with no Smartsheet write.
6. Submit one controlled real PTFE row and verify every mapped Master Log column.
7. Confirm low-yield PTFE job requires Pareto selection.
8. Confirm hour-by-hour is visible only as a placeholder.

## Deferred

- Polyimide implementation.
- PTFE/PI hour-by-hour tracker.
- Multi-department admin panel.
- Supervisor training docs for PTFE.
