# PTFE Phase 1 & 1.5 Implementation Spec

Last updated: 2026-05-13
Status: **COMPLETE**

---

## Objective

Add PTFE as the first non-PrecisionLiner department in the portal while preserving the current PrecisionLiner production flow.

## Build Principle

Build the shared department-aware foundation first, then add only the PTFE user workflow needed for job/event submission. Do not build Polyimide in the same pass.

---

## Phase 1 — Job & Event Entry (COMPLETE)

### Backend Changes — All Implemented

#### Department Smartsheet Clients
`getClientForDept(dept)` from `lib/smartsheet.js` — implemented and in use.

Supported keys: `PL`, `PTFE`, `PI`

PTFE env vars in `.env`:
- `DEPT_PTFE_API_TOKEN`
- `DEPT_PTFE_CONFIG_SHEET_ID` = `1516154787942276`
- `DEPT_PTFE_MASTER_LOG_SHEET_ID` = `3341343016308612`
- `DEPT_PTFE_STANDARDS_SHEET_ID` = `8285393687367556`
- `DEPT_PTFE_ITEMS_SHEET_ID` = `6128768201478020`

#### Config Endpoint
`GET /api/config?dept=PTFE` — implemented. Returns associates, sequences, events, Pareto lists, items, and standards data. No `dept` param defaults to `PL`.

#### Login Endpoint
`POST /api/login` accepts `department` field. Returns `user.departmentKey` and `user.department`. `test-ptfe` works as a training-mode account.

#### Submit Endpoint
`POST /api/submit-ptfe` — implemented. Uses `PTFE_MASTER_LOG_WRITE_TITLES` and a lazily-loaded column map fetched from the live sheet. Gated by `ALLOW_PTFE_MASTER_LOG_WRITES` env flag.

PTFE Master Log writes include:
- Entry Type, Associate Name, Date, Time Worked
- Item, Lot #, Start Quantity, End Quantity, Sequence
- Footage, Processing Length, Scrap Parts, Scrap Rate %
- Re-Cuts, Inspection Pareto, Pulling Pareto, Pulling Wraps, Pulling Method
- Event, Comments

---

### Frontend Changes — All Implemented

#### Routing
After login: `PL` → PrecisionLiner portal, `PTFE` → PTFE portal, `PI` → placeholder.

#### PTFE Job Form (actual implementation)

> **Note:** Item is a typed text input (6-digit numeric), NOT a dropdown. Changed from original spec after UX discussion — typing the item number directly is faster on a kiosk than scrolling a dropdown of hundreds of items. Validation enforces exactly 6 digits.

Controls implemented:
- Associate / current user display
- Date
- **Item Number** — text input, 6-digit validation, inline error feedback
- Lot Number — text input
- Production Sequence — dropdown from PTFE Master Configuration
- Time Worked — numeric input (minutes)
- Footage — numeric input (for spool-based sequences)
- Processing Length — numeric input with unit selector (in/cm/mm)
- Start Quantity — numeric; auto-calculated for spool sequences
- End Quantity — numeric
- Scrap Parts, Scrap Rate % — auto-calculated
- Re-Cuts
- Comments
- Apply Multiplier / Reset to Auto — for adjusting standard PPH by associate rate

Conditional controls:
- Pulling Wraps, Pulling Method — shown when sequence is `Pull`
- Spool fields (Footage, Processing Length) — shown when sequence is spool-based
- Inspection Pareto — shown when low yield and sequence is inspection type
- Pulling Pareto — shown when low yield and sequence is `Pull`

Additional UX:
- "No Standard Found" note shown in Base Standard result box when item/sequence combo has no PPH standard
- Enter-key navigation through all form fields via `PTFE_NAV_SEQUENCE`
- OE gauge with color coding (green ≥ 85%, warn 70–84%, red < 70%)
- Apply Multiplier stays visible after applying; Reset to Auto button appears

#### Event Entry
- Events use PTFE Master Configuration `Events` list
- Required events always included: `Lunch`, `Break`, `Bathroom`
- Entry captures: Event type, Start Time, End Time — duration calculated automatically
- Supports midnight crossing

---

## Phase 1.5 — Job x Job Tracker (COMPLETE)

See `ptfe_jxj_tracker_roadmap.md` for full spec. Summary:

### What was built
- **Job x Job Tracker section** replaces the "coming soon" placeholder entirely
- **5 cell tabs**: Pull | CTL | Inspection | Roll Cut | Packaging
- **All 16 sequences** mapped to the correct tab (see sequence map below)
- Each submitted job auto-populates the correct tab with: slot #, item, lot, std PPH, actual PPH, OE%, time, loss reason
- **Shift Summary row** at bottom of each tab auto-calculates totals
- **End Shift button** → Countermeasures prompt → submits to Smartsheet → signs out
- Loss Reason is always-optional inline text field per job row
- Stale-state detection on login: prompts to discard data from a previous date

### Sequence → Tab mapping (all 16 sequences)

| Sequence | Tab | Slot Prefix |
|---|---|---|
| Pull | Pull | Job |
| CTL | Cut to Length | Job |
| Inspection, EV3 Inspection, 2nd Inspection, 10X, Ring Gauge, Pressure Test, Check Flush | Inspection | Job |
| First Cut, Roll Cut (Both Ends), Length Check, Overall Length | Roll Cut | HR |
| Packaging, Package (Ring Gauge Done), Shipping Mandrel | Packaging | Job |

### localStorage key: `ptfe_jxj_state`

### Smartsheet: "PTFE Finishing – Job x Job Log"
- Sheet ID: `2513150724231044`
- Env var: `DEPT_PTFE_JOB_LOG_SHEET_ID`
- Columns: Row ID, Work Date, Associate Name, Cell, Job Slot, Row Type, Item Number, Lot Number, Std PPH, Actual PPH, OE %, Time (Min), Start Qty, End Qty, Loss Reason, Countermeasures, Submitted At

### Server endpoint: `POST /api/submit-ptfe-jxj`
- Accepts array of job rows + summary rows
- Gated by `ALLOW_PTFE_MASTER_LOG_WRITES` flag (same as master log)
- Test account interception: no writes for `test-ptfe`

---

## Additional UX Implemented

- **Theme selector** — 4 themes: Precision (dark), Light, Dark, High Contrast
- **Ctrl+Shift+X supervisor reset** — PIN 2026, clears `ptfe_jxj_state`, works on all 3 departments
- **History section** — was added in early Phase 1.5, then superseded and removed when JxJ tracker was built

---

## Deferred

- Polyimide (PI) implementation
- Phase 1.5 quality alert (flag same item with high scrap from today's submissions)
- Rate Lookup Modal
- Job Timer (backend session endpoint)

## Production Readiness Notes

- PTFE admin is implemented in `public/admin-ptfe.html`.
- `public/admin.html` is now a generic admin doorway that routes PL supervisors to `admin-pl.html` and PTFE supervisors to `admin-ptfe.html`.
- Production hosting has been confirmed to run through PM2 restoring `server.js`, so the Express routes in `server.js` are the deployment path.
- `api/config.js` is kept as a compatibility handler, but it is not the current production host path.
