# PTFE & PI Department Integration Roadmap

Last updated: 2026-05-13  
Context: Brainstorming doc for agents and developers building PTFE and Polyamide (PI) departments into the PL Portal. Research complete — Smartsheet column IDs captured, Reference Sheets audited, architecture decisions confirmed.

**PTFE Phase 1 & 1.5: COMPLETE.** See `ptfe_phase1_implementation_spec.md` for full status.  
**PI: Not yet started.**

> **Config sheet pattern decision (2026-05-12):** Every workspace will have one **Master Configuration sheet** per department, modeled exactly on PL's `EMPLOYEE_SCHEDULE_SHEET_ID`. Associate rows, Sequence rows, and Event rows coexist in the same sheet (columns that don't apply to a row type are left empty). This is the single source of truth the server reads to build the `/api/config` response. The existing Associates reference sheet remains in the workspace for Smartsheet-native reporting (schedule attainment, etc.) but is NOT the portal's auth/config source. The Standards sheet remains strictly a PPH lookup table — sequences are NOT sourced from there.

> **Login UX decision (2026-05-12):** The login screen uses a **department selector first, then a filtered name dropdown**. The combined associate count across all three departments is ~90+ people — a single unsorted list is unworkable on a touchscreen kiosk. Selecting department first trims the list to that dept's ~30 associates. After login, the server returns `department` in the user object and the frontend routes to the correct UI. The `Department` column in the Master Config sheet is kept as a convenience field — since the server queries the correct dept sheet based on the login request, it doesn't need the column to determine routing, but reading it from the row and returning it in the session response is cleaner than passing it back from the request payload.

---

## Overview

**Current state:** PTFE is integrated into the server-backed portal. PI still exists as planning/standalone reference material and has not been built into the portal yet.

**Target state:** PTFE and PI integrated into the PL Portal as first-class department routes — with proper bcrypt login, server-backed direct Smartsheet API writes, and the same resilience features already built for Precision Liner.

**Build order:** PTFE first. PI second. PTFE is complete; PI should mirror the proven PTFE pattern.

---

## Key Architecture Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Department selection at login | Department selector first, then filtered name dropdown | ~90+ total associates across 3 depts — one combined list is unworkable on a kiosk. Dept selector trims list to ~30 names. Server queries only that dept's Master Config sheet. |
| Config sheet pattern | One Master Configuration sheet per dept | Mirrors PL exactly — associate rows, sequence rows, and event rows coexist in one sheet. Server reads one sheet to build the full config response. |
| Sequence source | Master Configuration sheet (`Sequences` column rows) | Standards sheet is a PPH lookup table — sequences repeat per item number and must not be managed there |
| Event source | Master Configuration sheet (`Events` column rows) | Same sheet, same pattern as PL |
| Defect section | Not included for PTFE/PI | These depts use Pareto multi-selects instead |
| Job x Job tracker format | **DECIDED & BUILT** — see `ptfe_jxj_tracker_roadmap.md` | Job-by-job (not hour-by-hour) for 4 of 5 cells; Roll Cut uses HR slots. One Smartsheet row per job, submitted at End Shift. |
| Pareto fields (Inspection, Pulling, Pulling Method) | Multi-select checkboxes | Selected values join as comma-separated string → MULTI_PICKLIST column in Smartsheet |
| PPH Standards source | Load from Smartsheet Standards sheet | Already exists and populated in Reference Sheets; replaces the large hardcoded lookup table in the standalone portals |
| Production portal entry point | One `public/index.html` for PL/PTFE/PI until PI is built and proven | Shared shell/session/submission behavior stays in one place during integration; split JavaScript into department modules after all three workflows are stable |
| Admin page naming | Generic admin router + department-specific admin pages | Use `admin.html` as the stable admin doorway. It routes to `admin-pl.html`, `admin-ptfe.html`, and eventually `admin-pi.html`. |

---

## Future Frontend Modularization

For now, `public/index.html` remains the single production portal entry point. That keeps department routing, login session handling, shared overlays, theme controls, and common submit/logout behavior together while PTFE is being proven and PI is still pending.

After the third department (PI) is implemented and validated end-to-end, split the large inline JavaScript out of `index.html` into smaller department and shared modules. Recommended target structure:

| File | Purpose |
|------|---------|
| `public/index.html` | Thin HTML shell and shared markup containers |
| `public/js/shared-session.js` | Login/session helpers, department routing, admin URL routing, logout |
| `public/js/shared-ui.js` | Toasts, submit overlay, theme handling, common modals |
| `public/js/pl-portal.js` | PrecisionLiner production workflow |
| `public/js/ptfe-portal.js` | PTFE production workflow and Job x Job tracker |
| `public/js/pi-portal.js` | Polyimide production workflow |

Do this after PI is working, not before. The split should be a mechanical extraction with behavior parity first, then cleanup after verification. Avoid changing Smartsheet write behavior during the same refactor.

---

## How PTFE/PI Differ from PL

### What's shared
- Login flow (bcrypt auth, session stored in `localStorage`)
- Server architecture (same Express server, same `lib/smartsheet.js` client factory)
- Fetch timeout / retry resilience (`fetchWithTimeout`, retry interceptor)
- Job x Job tracker (built — see `ptfe_jxj_tracker_roadmap.md`)
- Event tracking (non-productive time entries)

### What's different

| Feature | Precision Liner (PL) | PTFE / PI |
|---------|----------------------|-----------|
| Defect section | Yes (defect types → Smartsheet columns) | **No** — replaced by Pareto multi-selects |
| OE calculation | Availability × Performance × Quality | Actual PPH ÷ Standard PPH (from Standards sheet) |
| Submission fields | Parts, defects, sequences | Footage, Processing Length, Scrap, Pareto, Re-Cuts, Pulling Wraps |
| Sequence list | Hardcoded in config | Loaded from Master Configuration sheet (`Sequences` column rows) — same pattern as PL |
| Item dropdown | Not applicable | Item numbers loaded from Items reference sheet |
| Start Qty auto-calc | N/A | PI: calculated from spool footage ÷ part length (FG Length from Items sheet) |
| PPH standards | N/A | Large lookup table by Item × Sequence → load from Standards sheet |

---

## Smartsheet Resources

### PTFE

- **Workspace ID:** `2462922992576388` (PTFE Metrics)
- **Master Log Sheet ID:** `3341343016308612`

**PTFE Reference Sheets** (folder ID: `1315257642706820`):

| Sheet | Sheet ID | Columns | Portal Use |
|-------|----------|---------|------------|
| Associates | `1516154787942276` | Name, Cell, Scheduled Minutes, Rate, Mon–Sun | Smartsheet-native reporting only — **not** the portal config source |
| Standards | `8285393687367556` | Item, Sequence (PICKLIST), Good PPH Std, Total PPH Std | PPH lookup — load server-side, cache on startup. **Not** used for sequence list. |
| Items | `6128768201478020` | Item, FG Length (in), Product Family | Item dropdown population |
| Historical Yields | `6420024307699588` | — | Not needed for portal |
| Holidays Date | `3036142673809284` | — | Optional: schedule logic |

**PTFE Master Configuration sheet** — to be created in the PTFE workspace (top level or in Reference Sheets folder):

Modeled on PL's `EMPLOYEE_SCHEDULE_SHEET_ID`. Columns:

| Column | Type | Used By Row Type |
|--------|------|-----------------|
| Associate Name (primary) | TEXT_NUMBER | Associate rows |
| Cell | PICKLIST | Associate rows |
| Scheduled Minutes | PICKLIST | Associate rows |
| Rate | PICKLIST | Associate rows |
| Mon / Tue / Wed / Thurs / Fri / Sat / Sun | TEXT_NUMBER | Associate rows |
| Role | PICKLIST (`Associate`, `Supervisor`) | Associate rows |
| Password Hash | TEXT_NUMBER | Associate rows |
| Department | TEXT_NUMBER (`PTFE`) | Associate rows |
| Sequences | TEXT_NUMBER | Sequence rows |
| Sequence Goals | TEXT_NUMBER | Sequence rows |
| Events | TEXT_NUMBER | Event rows |

> Env var: `DEPT_PTFE_CONFIG_SHEET_ID`

### PI

- **Workspace ID:** `2188483709167492` (PI Metrics)
- **Master Log Sheet ID:** `8097032053936004`

**PI Reference Sheets** (folder ID: `4015392298428292`):

| Sheet | Sheet ID | Columns | Portal Use |
|-------|----------|---------|------------|
| Associates | `3607206386683780` | Name, Cell, Scheduled Minutes, Rate, Mon–Sun | Smartsheet-native reporting only — **not** the portal config source |
| Standards | `7039666403364740` | Item, Sequence (TEXT_NUMBER), Good PPH Std, Total PPH Std | PPH lookup — load server-side. **Not** used for sequence list. |
| Items | `4226933660274564` | Item, FG Length (in), Product Family, Unit Of Measure | Item dropdown (PI has extra UOM column) |
| Historical Yields | `5599530046148484` | — | Not needed for portal |
| Holidays Date | `6235767174025092` | — | Optional: schedule logic |

**PI Master Configuration sheet** — to be created in the PI workspace (same structure as PTFE's, with `Department = "PI"`):

> Env var: `DEPT_PI_CONFIG_SHEET_ID`

---

## PTFE Master Log — Column ID Map

```js
const PTFE_COLUMN_MAP = {
    entryType:         7728414592814980,
    associateName:     3995776950423428,
    date:              336602253184900,
    timeWorked:        8217901601083268,
    item:              2588402066870148,
    lotNumber:         4840201880555396,
    startQty:          5966101787398020,
    endQty:            3714301973712772,
    sequence:          7092001694240644,
    footage:           1462502160027524,
    processingLength:  2051615557898116,
    scrapParts:        4603890075651972,
    // scrapRatePct: 2352090261966724  ← likely formula column — confirm via get_columns before including
    reCuts:            4728109480497028,
    inspectionPareto:  2791922191781764,  // MULTI_PICKLIST
    pullingPareto:     3877940751978372,  // MULTI_PICKLIST
    pullingWraps:      8767836642824068,
    pullingMethod:     182849853149060,   // MULTI_PICKLIST
    event:             5084933760176004,
    comments:          5403151833976708,
};
```

## PI Master Log — Column ID Map

```js
const PI_COLUMN_MAP = {
    entryType:         4040845880414084,
    associateName:     8051864298540932,
    date:              5237114531434372,
    timeWorked:        6081539461566340,
    item:              1859414810906500,
    lotNumber:         7488914345119620,
    startQty:          452039927353220,
    endQty:            4955639554723716,
    sequence:          4111214624591748,
    footage:           8614814251962244,
    processingLength:  1014989880774532,
    scrapParts:        2703839741038468,
    // scrapRatePct: 7207439368408964  ← likely formula column — confirm via get_columns before including
    reCuts:            1577939834195844,
    inspectionPareto:  2914945973571460,  // MULTI_PICKLIST
    pullingPareto:     7418545600941956,  // MULTI_PICKLIST
    pullingWraps:      1789046066728836,
    pullingMethod:     6292645694099332,  // MULTI_PICKLIST
    event:             6363014438276996,
    comments:          663146159886212,
};
```

---

## Sequences & Events

Both sequences and events are stored as rows in the **Master Configuration sheet** — the same pattern as PL. When populating the Master Config sheet for each dept, use these known values as the starting point:

### PTFE Sequences (from standalone portal — verify at build time)
10X, 2nd Inspection, Check Flush, CTL, EV3 Inspection, First Cut, Inspection, Length Check, Overall Length, Package (Ring Gauge Done), Packaging, Pressure Test, Pull, Ring Gauge, Roll Cut (Both Ends), Shipping Mandrel

### PI Sequences (from standalone portal — verify at build time)
Long Pull, Table Pull, CTL, Inspection, Packaging, Flush, Wrapping, Check Flush, Pressure Test, 10X, Length Check, First Cut, Overall Length, Roll Cut (Both Ends), Spark Test, Crush Test

### PI Events (confirmed)
Baking, Clean-Up, Meeting, Misc, No Pay No Penalty, PTO, Toolbox, Training

### PTFE Events
Verify from the standalone PTFE portal at build time. Add as `Events` column rows in the PTFE Master Config sheet.

> The Standards sheet is **not** used as a sequence source. Sequences repeat per item number in the Standards table and must not be managed there. The Master Config sheet is the single editable list.

---

## OE Calculation

Both PTFE and PI compute sequence OE as:

```
OE = (endQty / timeWorked) / PPH_STANDARD[item][sequence]
```

The PPH_STANDARD table is loaded from the **Standards** sheet in each dept's Reference Sheets. The server should fetch and cache this on startup (same TTL as the config cache — 5 minutes, or longer since PPH standards change infrequently).

---

## MULTI_PICKLIST Field Handling (Pareto fields)

Smartsheet MULTI_PICKLIST columns accept multiple values. In the portal:

1. Render each option as a checkbox group
2. Collect all checked values on submit
3. Send as a comma-separated string in the cell value

```js
// Example: Inspection Pareto
const inspectionPareto = Array.from(
    document.querySelectorAll('[name="inspectionPareto"]:checked')
).map(cb => cb.value).join(',');

// In the row cell:
{ columnId: PTFE_COLUMN_MAP.inspectionPareto, value: inspectionPareto }
```

The available options for each Pareto field should be read from the Master Log column definitions (`GET /sheets/{id}/columns`) and cached at login. This avoids hardcoding the option list in code.

---

## What Needs to Be Created in Smartsheet Before Building

### Master Configuration sheet — create for BOTH PTFE and PI

Create a new sheet in each dept's workspace (top level or inside the Reference Sheets folder) named **"Master Configuration"**. Model it on PL's `EMPLOYEE_SCHEDULE_SHEET_ID` exactly.

**Columns to create:**

| Column | Type | Notes |
|--------|------|-------|
| Associate Name | TEXT_NUMBER (primary) | Associate rows: populate with all dept associates |
| Cell | PICKLIST | Associate rows: cell assignment |
| Scheduled Minutes | PICKLIST | Associate rows: 420 or 525 |
| Rate | PICKLIST | Associate rows: dept-specific rate options |
| Mon / Tue / Wed / Thurs / Fri / Sat / Sun | TEXT_NUMBER | Associate rows: schedule |
| Role | PICKLIST (`Associate`, `Supervisor`) | Associate rows |
| Password Hash | TEXT_NUMBER | Associate rows: written by server on first password setup |
| Department | TEXT_NUMBER | Associate rows: value = `"PTFE"` or `"PI"` |
| Sequences | TEXT_NUMBER | Sequence rows: one sequence name per row |
| Sequence Goals | TEXT_NUMBER | Sequence rows: optional PPH goal (can leave 0 for now) |
| Events | TEXT_NUMBER | Event rows: one event name per row |

**After creating:** Add env var `DEPT_PTFE_CONFIG_SHEET_ID` / `DEPT_PI_CONFIG_SHEET_ID` pointing to the new sheet. The server's `lib/config.js` pattern already knows how to parse this structure.

### What's already in Smartsheet — no new sheets needed

- Standards sheet — PPH lookup table exists and is populated. Load server-side to replace the hardcoded table in the standalone HTML files.
- Items sheet — Item number list exists. Feeds the Item dropdown.
- Associates reference sheet — Remains as-is for Smartsheet-native reporting (schedule attainment, etc.). Not touched by the portal.

---

## Phase 1: PTFE Integration — COMPLETE

### Smartsheet setup
- [x] PTFE Master Configuration sheet exists (`DEPT_PTFE_CONFIG_SHEET_ID` = `1516154787942276`)
- [x] All PTFE associates, sequences, and events populated
- [x] All env vars in `.env`: `DEPT_PTFE_API_TOKEN`, `DEPT_PTFE_CONFIG_SHEET_ID`, `DEPT_PTFE_MASTER_LOG_SHEET_ID`, `DEPT_PTFE_STANDARDS_SHEET_ID`, `DEPT_PTFE_ITEMS_SHEET_ID`
- [x] Job x Job Log sheet created (`DEPT_PTFE_JOB_LOG_SHEET_ID` = `2513150724231044`)

### Server changes
- [x] `getClientForDept(dept)` factory in `lib/smartsheet.js`
- [x] `_configCache` is dept-keyed
- [x] `/api/login` returns `department` in response
- [x] `/api/config?dept=PTFE` fetches config + items + standards
- [x] `POST /api/submit-ptfe` — PTFE Master Log writes
- [x] `POST /api/submit-ptfe-jxj` — Job x Job Log writes (End Shift)

### Frontend changes
- [x] Dept routing: PL → PL portal, PTFE → PTFE portal, PI → placeholder
- [x] Item Number: text input with 6-digit validation (NOT a dropdown — changed from original spec)
- [x] Lot #, Sequence, Footage, Processing Length, Start/End Qty, Scrap, Re-Cuts, Paretos, Pulling fields
- [x] OE display with gauge and color coding
- [x] Event entry with Start Time + End Time (duration auto-calculated)
- [x] Job x Job Tracker — 5 tabs, all 16 sequences mapped, End Shift flow
- [x] Ctrl+Shift+X supervisor reset (PIN 2026)

---

## Phase 2: PI Integration — Step-by-Step

Follow the same pattern as PTFE. After PTFE is proven, PI should be significantly faster since the architecture is already in place.

### Key differences from PTFE to verify for PI:
- PI has `Spark Test` and `Crush Test` sequences not in PTFE
- PI sequences come from Standards sheet **row data** (TEXT_NUMBER), not PICKLIST options — read distinctly from rows
- PI has `Unit Of Measure` column in Items sheet — may affect how quantities are displayed
- PI auto-calculates Start Qty: `spoolFeet ÷ FG Length (in)` — `FG Length` comes from the Items sheet row for the selected item
- PI PPH standards are a separate table from PTFE's — use `DEPT_PI_STANDARDS_SHEET_ID`
- PI events confirmed: Baking, Clean-Up, Meeting, Misc, No Pay No Penalty, PTO, Toolbox, Training

### PI Smartsheet setup (mirrors PTFE)
- [ ] Create PI Master Configuration sheet (same structure as PTFE's, `Department = "PI"`)
- [ ] Populate all PI associates, sequences, and events as rows in the new sheet
- [ ] Add `DEPT_PI_CONFIG_SHEET_ID`, `DEPT_PI_MASTER_LOG_SHEET_ID`, `DEPT_PI_STANDARDS_SHEET_ID`, `DEPT_PI_ITEMS_SHEET_ID`, `DEPT_PI_API_TOKEN` to `.env`

---

## Multi-Department Login Flow

Department is selected first, which filters the name dropdown to that dept only:

1. **Login page loads** — shows a Department selector (PL / PTFE / PI). No names loaded yet.
2. **Associate picks department** → frontend calls `/api/config?dept=PTFE` → server queries only the PTFE Master Config sheet → returns PTFE associates list. Name dropdown populates with ~30 names.
3. **Associate picks name, enters password** → frontend POSTs `{ username, password, department: 'PTFE' }` to `/api/login`
4. Server authenticates against the PTFE Master Config sheet, returns `{ user: { name, role, department: 'PTFE' } }`
5. Frontend stores `currentUser` (including `department`) in `localStorage`
6. On app load, `localStorage.currentUser.department` determines which UI view to render

**Benefits of this flow:**
- Name list stays short (~30 per dept) — manageable on a touchscreen
- Server only fetches one dept's config sheet per login — faster, fewer API calls
- No cross-dept name collisions possible
- If a kiosk station is permanently assigned to one department, the dept selector can be pre-set and hidden — reducing login to just name + password

**`login.html` changes needed:**
- Add department PICKLIST (PL / PTFE / PI) above the name dropdown
- On dept change: clear name dropdown, fetch `/api/config?dept=X`, repopulate names
- Pass `department` field in the login POST body

---

## Files to Change When Adding PTFE/PI

| File | Change |
|------|--------|
| `.env` | Add `DEPT_PTFE_*` and `DEPT_PI_*` blocks |
| `lib/smartsheet.js` | Add `getClientForDept()` factory |
| `server.js` | Refactor config cache to dept-keyed; add dept routing at login; add `/api/submit-ptfe` and `/api/submit-pi` endpoints; add PPH standards cache |
| `public/index.html` | Add PTFE and PI view branches; include `department` in all submission payloads; store from login response. After PI is proven, extract inline JavaScript into shared + department files. |
| `public/login.html` | Store `department` from login response in `localStorage` |
| `public/admin.html` | Generic admin entry point. Reads the supervisor session and routes to the correct department admin page. |
| `public/admin-pl.html` | PL admin panel. |
| `public/admin-ptfe.html` | PTFE admin panel. Mirrors the PL admin pattern with PTFE-specific lists, items, and PPH standards. |
| `public/admin-pi.html` | Future PI admin panel once PI integration starts. |

Reference: `portal_scaling_and_future_proofing.md` → Improvement 7 for the full multi-department server architecture pattern.

---

## Current Build Notes

These notes were originally written before PTFE was built. They are now retained as guidance for future PTFE changes and the later PI build.

### 1. Master Log columns are only partially documented here — and formula columns must be excluded

The PTFE Master Log has 56 columns total; the PI Master Log has 51. The column maps above cover the ~20 submission fields identified from the standalone portals. There are additional columns (Hour-by-Hour slots, OE, calculated rates, and others) that were not fully audited.

**Before writing any submit endpoint:**
1. Run `get_columns` on both Master Log sheets to get the complete column list
2. For every column, check the `formula` field in the response
3. **Any column where `formula` is non-null is a Smartsheet formula column — exclude it from the column map entirely.** The portal never writes to formula columns. Writing to them either throws an API error or permanently overwrites the formula with a static value on that row.
4. Only include columns where `formula` is null in the column map

**Likely formula columns to exclude** (verify via `get_columns` — do not assume):
- `Scrap Rate %` — almost certainly calculated as `scrapParts / startQty`
- `Sequence OE` — likely calculated from submitted footage/time against the PPH standard
- Any column with "%" or a calculated metric in its name — treat as suspect until confirmed

The column maps in this doc already omit `scrapRatePct` and `sequenceOE` as a precaution. Confirm via `get_columns` before finalizing the maps.

- PTFE Master Log Sheet ID: `3341343016308612`
- PI Master Log Sheet ID: `8097032053936004`

### 2. `/api/config` is department-aware

Current status: implemented. `GET /api/config` in `server.js` accepts `dept=PL|PTFE|PI` and defaults to PL when no department is supplied. Login uses `scope=login` to avoid loading heavy supplemental PTFE standards data unnecessarily.

The existing `GET /api/config` in `server.js` reads PL's config sheet with no dept parameter. The new login flow calls `/api/config?dept=PTFE`. This endpoint must be updated to accept a `dept` query param and route to the correct config sheet. **This is a change to live PL code** — ensure `dept=PL` (or no dept param defaulting to PL) continues to work exactly as before. All existing `login.html` and kiosk login calls that currently hit `/api/config` without a dept param must still return PL data.

### 3. `lib/config.js` `fetchConfigData()` is department-aware

Current status: implemented. `fetchConfigData(sheetId, dept, options)` accepts the department and optional supplemental loading flag.

`fetchConfigData()` in `lib/config.js` reads from `EMPLOYEE_SCHEDULE_SHEET_ID` directly. It cannot serve PTFE or PI without modification. Refactor it to accept a sheet ID parameter:

```js
// Change from:
async function fetchConfigData() {
    const sheet = await getSheet(MASTER_CONFIG_SHEET_ID);
    return buildConfigPayload(sheet);
}

// To:
async function fetchConfigData(sheetId = MASTER_CONFIG_SHEET_ID) {
    const sheet = await getSheet(sheetId);
    return buildConfigPayload(sheet);
}
```

`buildConfigPayload()` itself is already dept-agnostic and can be reused as-is.

### 4. `_configCache` refactor touches live PL login

Current status: implemented. Config cache is department-keyed and PL remains the default path.

`server.js` currently has `let _configCache = null` — a single object serving PL only. This must become a dept-keyed map: `const _configCache = {}`. The refactor must not break the existing PL login flow. Make PL the default key (`_configCache['PL']`) and verify PL login still works after the change.

### 5. Hour-by-Hour tracker — do NOT build yet

PTFE uses Job x Job, not Hour-by-Hour. PI should follow the PTFE Job x Job pattern unless floor requirements change.

### 6. Training accounts for PTFE/PI

Current status: implemented as `test-pl`, `test-ptfe`, `test-pi`, plus supervisor variants `test-pl-super`, `test-ptfe-super`, and `test-pi-super`. Password: `trenton1`.

Current test accounts are `test-pl`, `test-ptfe`, `test-pi`, plus supervisor variants `test-pl-super`, `test-ptfe-super`, and `test-pi-super`. Password: `trenton1`.

### 7. Admin pages are department-specific

The admin page naming pattern is now department-specific:

- `public/admin-pl.html` — PrecisionLiner admin
- `public/admin-ptfe.html` — PTFE admin
- `public/admin-pi.html` — future PI admin

`public/admin.html` is the stable generic admin doorway. It reads `localStorage.currentUser.departmentKey` and routes supervisors to the correct department-specific admin page. Department-specific links can still point directly to `admin-pl.html` or `admin-ptfe.html` when the destination is already known.

### 8. Sequence Goals column for PTFE/PI

PL uses `Sequence Goals` to show a parts target per sequence. PTFE/PI do not use this concept — OE is derived from PPH standards instead. When populating the PTFE/PI Master Config sheets, leave `Sequence Goals` values as `0`. The frontend PTFE/PI view should not render a "goal" counter.

---

## Resolved Questions

| Question | Resolution |
|----------|------------|
| Tracker format for PTFE | **Job x Job** (not hour-by-hour). 4 cells track job-by-job; Roll Cut uses HR slots. Built and live. See `ptfe_jxj_tracker_roadmap.md`. |
| Events for PTFE | **Confirmed:** Baking, Clean-Up, Meeting, Misc, No Pay No Penalty, PTO, Toolbox, Training + Lunch, Break, Bathroom (always injected). |
| Pareto options source | **Implemented:** Loaded from PTFE config sheet alongside sequences/events. Rendered as checkbox groups in the portal. |
| Item input format | **Changed to text input** — 6-digit numeric, typed by associate. Faster than a dropdown on a kiosk. |

## Open Questions (PI — not yet started)

| Question | Impact |
|----------|--------|
| Tracker format for PI | PI follows the same job-by-job pattern as PTFE — confirm cell names and sequence list before building. |
| PI sequences | Confirmed list: Long Pull, Table Pull, CTL, Inspection, Packaging, Flush, Wrapping, Check Flush, Pressure Test, 10X, Length Check, First Cut, Overall Length, Roll Cut (Both Ends), Spark Test, Crush Test — verify against live config sheet at build time. |
| PI events | Confirmed: Baking, Clean-Up, Meeting, Misc, No Pay No Penalty, PTO, Toolbox, Training. |
