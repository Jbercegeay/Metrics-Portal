# Multi-Associate Kiosk Workspaces

## Goal

Build a safer shared-terminal workflow where multiple associates can use one kiosk without accidentally submitting production metrics under the wrong person.

The model combines:

- Operator workspaces: each checked-in associate has independent job/event state.
- Active operator confirmation: the UI always names who is active before submission.

## Release Target

Planned as `v1.2.0` because this is a visible production workflow improvement. If the Smartsheet data model or attribution rules change significantly, reassess whether it should become `v2.0.0`.

## Current Problem

Precision Liner already has a multi-operator concept, but the active operator can be too subtle. The portal needs stronger separation so associates can see whose data they are entering and cannot easily submit another associate's work by mistake.

PTFE and Polyimide currently behave closer to single-associate sessions. The implementation should establish a reusable pattern that can be expanded across all departments.

## Core Rules

- Production entry fields belong to an associate workspace, not to the kiosk.
- The kiosk owns only shared station/session values.
- Switching associates must snapshot the current workspace before loading the next one.
- Submit buttons and submit confirmations must name the active associate.
- End shift/logout must review all checked-in associate workspaces before clearing the station.
- No associate workspace may overwrite another associate workspace.

## Shared Station State

These can remain station-level:

- Department.
- Work date.
- Shift start and end.
- Active associate roster.
- Selected active associate.
- Theme and display preferences.

## Per-Associate Workspace State

Each associate should have independent values for:

- Entry mode.
- Sequence.
- Lot number.
- Item number.
- Start quantity.
- End/good quantity.
- Defects and pareto selections.
- Notes and next-shift notes where applicable.
- Timers and sequence start time.
- Event entry fields and event duration.
- PCD/hour-by-hour buckets.
- Job x Job row drafts where applicable.
- Submission locks and unsent-work status.

## Desired User Workflow

1. First associate signs in and becomes the active workspace.
2. Additional associates check into the kiosk with password/PIN.
3. Header shows a roster of checked-in associates.
4. The active associate is visually dominant and repeated in the banner/form.
5. Switching associates saves the current workspace, then loads the selected workspace.
6. Submit button reads `Submit Job for [Associate]`.
7. Submit modal repeats associate, department, sequence, lot, item, good quantity, defects, and time.
8. Submitting clears only that associate's active job/event state.
9. End shift shows a checklist of all associate workspaces and blocks logout if any have unsent work unless explicitly discarded.

## UI Checklist

- Add an active associate banner above the entry controls.
- Rename submit buttons to include the active associate.
- Make associate roster/tabs obvious and touch-friendly.
- Add unsent-work indicators to associate tabs.
- Add an explicit `Add Associate` flow.
- Add an explicit `Switch to [Associate]` interaction.
- Add a clear `Remove/Logout Associate` flow with unsent-work protection.
- Add a station end-shift review modal.

## Data Safety Checklist

- Introduce a workspace schema version for localStorage.
- Migrate existing PL state into the first associate workspace.
- Keep workspace snapshots isolated by associate name or stable associate ID.
- Avoid shared mutable references between workspaces.
- Recalculate KPI/PCD from the active workspace or explicit aggregate, never from stale global fields.
- Add duplicate-submission protection per associate workspace.
- Confirm test accounts remain non-writing.

## Implementation Sequence

1. Document current PL state shape and active-user flow.
2. Extract workspace snapshot/load helpers.
3. Create a single source of truth for station state vs workspace state.
4. Update the active associate roster UI.
5. Update submit button labels and confirmation details.
6. Harden submit/logout/end-shift behavior around all workspaces.
7. Extend or adapt the model for PTFE and PI.
8. Add manual test scripts/checklists.
9. Update changelog under `Unreleased`.

## Manual Test Scenarios

- Single associate signs in and submits normally.
- Two associates check in, enter different lots, switch back and forth, and keep independent form values.
- Associate A submits while Associate B has unsent work; only Associate A clears.
- Associate B logs an event; Associate A job metrics are unchanged.
- Attempt to logout with unsent work; portal blocks or requires explicit discard.
- Test accounts simulate submissions without Smartsheet writes.
- Supervisor/admin access still routes correctly.

## Open Decisions

- Should associate identity use display name or a stable Smartsheet row ID internally?
- Should shared station events exist, or should all events be per-associate only?
- Should KPI header show active associate metrics only, per-associate rows, or station aggregate?
- Should PTFE/PI adopt the full multi-workspace model immediately or after PL proves it?
- Should final submit require password/PIN confirmation, or is named confirmation enough for `v1.2.0`?
