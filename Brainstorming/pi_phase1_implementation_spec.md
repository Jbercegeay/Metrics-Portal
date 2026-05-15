# PI (Polyimide) Phase 1 Implementation Spec

Last updated: 2026-05-13  
Status: **NOT STARTED**

---

## Objective

Add PI (Polyimide) as the third department in the portal, following the PTFE pattern exactly. This spec covers everything needed to go from nothing to a fully working PI production portal including Job x Job tracker. PTFE Phase 1 & 1.5 are the direct reference — every section below mirrors the PTFE implementation spec with PI-specific values substituted in.

## Build Principle

Mirror PTFE. Do not design PI from scratch. The architecture, server patterns, frontend structure, and UX are all identical to PTFE — the only real differences are PI-specific field values (sequences, pareto options), the spool footage auto-calc for Start Qty, and the two unique sequences (Spark Test, Crush Test). Any time you're unsure what to do, look at how PTFE does it.

---

## Phase 1 — Job & Event Entry

### Backend Changes

#### Department Smartsheet Client
`getClientForDept('PI')` from `lib/smartsheet.js` — already supported. Just needs `DEPT_PI_API_TOKEN` in `.env`.

PI env vars to add to `.env`:
```
DEPT_PI_API_TOKEN=<token>
DEPT_PI_CONFIG_SHEET_ID=<id after Master Config sheet is created>
DEPT_PI_MASTER_LOG_SHEET_ID=8097032053936004
DEPT_PI_STANDARDS_SHEET_ID=7039666403364740
DEPT_PI_ITEMS_SHEET_ID=4226933660274564
DEPT_PI_JOB_LOG_SHEET_ID=<id after JxJ sheet is created>
ALLOW_PI_MASTER_LOG_WRITES=true
```

#### Config Endpoint
`GET /api/config?dept=PI` — add PI branch to the existing dept-keyed config endpoint. Returns: associates, sequences, events, Pareto lists, items (with FG Length for auto-calc), and standards data.

The PI branch mirrors the PTFE branch in `server.js` with these differences:
- Use `DEPT_PI_*` env vars
- Include `Unit Of Measure` from Items sheet in items response
- PI standards table is ~200+ items — same loading pattern, larger payload

#### Login Endpoint
`POST /api/login` already accepts `department` field and returns `user.departmentKey`. No changes needed — just add `test-pi` and `test-pi-super` to `TEST_ACCOUNT_DETAILS` in `server.js`.

```js
// Add to TEST_ACCOUNT_DETAILS in server.js
'test-pi': {
    name: 'Test PI',
    departmentKey: 'PI',
    role: 'Associate',
    scheduledMinutes: 420,
    rate: 0.80,
},
'test-pi-super': {
    name: 'Test PI Super',
    departmentKey: 'PI',
    role: 'Supervisor',
    scheduledMinutes: 420,
    rate: 0.80,
},
```

#### Submit Endpoint — Master Log
`POST /api/submit-pi` — new endpoint, mirrors `POST /api/submit-ptfe` exactly.

Uses `PI_COLUMN_MAP` (see `pi_portal_integration_roadmap.md`). Gated by `ALLOW_PI_MASTER_LOG_WRITES` env flag.

PI Master Log writes include the same fields as PTFE:
- Entry Type, Associate Name, Date, Time Worked
- Item, Lot #, Start Quantity, End Quantity, Sequence
- Footage, Processing Length, Scrap Parts, Re-Cuts
- Inspection Pareto, Pulling Pareto, Pulling Wraps, Pulling Method
- Event, Comments

> Run `get_columns` on `8097032053936004` before finalizing the column map. Exclude any column where `formula` is non-null.

#### Submit Endpoint — Job x Job Log
`POST /api/submit-pi-jxj` — new endpoint, mirrors `POST /api/submit-ptfe-jxj`. See `pi_jxj_tracker_roadmap.md` for the full column map (available after the JxJ sheet is created).

---

### Frontend Changes

#### Routing
After login: existing routing already handles `PI` → placeholder. Replace the placeholder section with the full PI portal. The routing logic in `index.html` is:

```js
if (dept === 'PL') showPlPortal();
else if (dept === 'PTFE') showPtfePortal();
else if (dept === 'PI') showPiPortal();   // Currently shows placeholder
```

#### PI Portal Section
Add `#piPortal` section to `index.html`. Mirror the `#ptfePortal` section structure exactly — same card layout, same mode toggle bar (Job Entry / Event Entry), same JxJ tracker card below. Use `pi` prefix for all element IDs and JS variable names.

---

### PI Job Form — Complete Field List

#### Always-visible fields
| Field | Element | Notes |
|-------|---------|-------|
| Associate / current user | Display only | From `PI_SESSION_USER.name` |
| Date | Date input | Defaults to today |
| Item Number | Text input, 6-digit validation | Same as PTFE — typed, not dropdown |
| Lot Number | Text input | |
| Production Sequence | Select dropdown | Populated from `PI_CONFIG.sequences` |
| Time Worked | Number input (minutes) | |
| **Spool Footage** | Decimal input (feet) | **PI only** — not in PTFE |
| Processing Length | Number input + unit selector (in/cm/mm) | Same as PTFE |
| Start Quantity | Number input | Auto-calculated when Spool Footage + Processing Length entered; manually overridable |
| End Quantity | Number input | |
| Scrap Parts | Number input | |
| Scrap Rate % | Display only | Auto-calculated: `(scrapParts / startQty) * 100` |
| Re-Cuts | Text input | |
| Comments | Textarea | |

#### Conditional fields (shown based on sequence selection)
| Field | When shown | Notes |
|-------|-----------|-------|
| Spool Footage | Spool-based sequences (Pull, Flush, Wrapping, etc.) | Already always present but highlight/focus when relevant |
| Pulling Wraps | Sequence is a Pull type | Same as PTFE |
| Pulling Method | Sequence is a Pull type | Multi-select checkboxes |
| Inspection Pareto | Low yield on inspection-type sequences | Multi-select checkboxes |
| Pulling Pareto | Low yield on pull sequences | Multi-select checkboxes |

> Conditional visibility logic mirrors PTFE. Define a `PI_SPOOL_SEQUENCES` list and `PI_PULL_SEQUENCES` list in the same pattern as PTFE's sequence type arrays.

#### OE Gauge
Same component as PTFE — visual gauge with color coding:
- OE ≥ 85% → green (`var(--accent)`)
- OE 70–84% → yellow (`var(--warn)`)
- OE < 70% → red (`var(--danger)`)

Calculation:
```js
// PI: all associates have flat 0.80 rate
const adjustedStd = baseStd / 0.80;
const oe = (actualPph / adjustedStd) * 100;
```

> The "Apply Multiplier" UI should still be present (same UX as PTFE) but will show 0.80 for all PI associates. "Reset to Auto" works the same way.

#### Spool Footage → Start Qty Auto-Calc

```js
function calcPiStartQty() {
    const spoolFeet = parseFloat(document.getElementById('piSpoolFootage').value);
    const partLength = parseFloat(document.getElementById('piProcessingLength').value);
    const unit = document.getElementById('piProcessingLengthUnit').value;
    if (!spoolFeet || !partLength) return;

    let partLengthInches;
    if (unit === 'cm') partLengthInches = partLength / 2.54;
    else if (unit === 'mm') partLengthInches = partLength / 25.4;
    else partLengthInches = partLength; // already inches

    const spoolInches = spoolFeet * 12;
    const calculated = Math.floor(spoolInches / partLengthInches);
    document.getElementById('piStartQty').value = calculated;
}

// Attach to both fields
document.getElementById('piSpoolFootage').addEventListener('input', calcPiStartQty);
document.getElementById('piProcessingLength').addEventListener('input', calcPiStartQty);
document.getElementById('piProcessingLengthUnit').addEventListener('change', calcPiStartQty);
```

#### PPH Standards Loading

```js
// On config load — build lookup index
function buildPiStandardsIndex(standardsData) {
    // Same as buildPtfeStandardsIndex — key by item+sequence
    // standardsData shape from server: [{ item, sequence, goodPph, totalPph }, ...]
    const index = {};
    for (const row of standardsData) {
        if (!index[row.item]) index[row.item] = {};
        index[row.item][row.sequence] = row.goodPph;
    }
    return index;
}
```

> PI's standards table is ~200+ items. The lookup pattern is identical to PTFE — item number + sequence → PPH value. If no standard found, show "No Standard Found" note (same as PTFE).

#### Pareto Sections

**Inspection Pareto** (18 options — loaded from `PI_CONFIG.inspectionParetos`):
Black Spots, Blisters, Braid Breaks, Bumps, Chatter Marks, Delamination, Discoloration, Fibers, Glue, Green Folder, Oxidation, Other, Poly didn't clean off, Red Folder, Stretched, Torn ID, Unflushed, Wrinkles

**Pulling Pareto** (4 options — loaded from `PI_CONFIG.pullingParetos`):
Material Breaking, Other (Enter Comments), Release Issues, Wrong Footage

**Pulling Methods** (7 options — loaded from `PI_CONFIG.pullingMethods`):
Stretch Then Score, Score Then Stretch, Scrape, Straighten Only, Single, Double, Triple

All three are multi-select checkbox groups. Submitted as comma-separated strings.

#### Enter-Key Navigation
Define `PI_NAV_SEQUENCE` — same pattern as `PTFE_NAV_SEQUENCE`. Array of element IDs in tab order. Include `piSpoolFootage` in the sequence (between `piLotNumber` and `piProcessingLength`).

---

### Event Entry

Same pattern as PTFE. PI events sourced from `PI_CONFIG.events`:
- Config events: Baking, Clean-Up, Meeting, Misc, No Pay No Penalty, PTO, Toolbox, Training
- Always-injected: Lunch, Break, Bathroom

Entry captures: Event type, Start Time, End Time — duration calculated automatically. Supports midnight crossing.

---

## Phase 1.5 — Job x Job Tracker

See `pi_jxj_tracker_roadmap.md` for the full spec.

Summary: Same architecture as `ptfe_jxj_tracker_roadmap.md` — 5 cell tabs, job-by-job rows, shift summary, End Shift flow with Countermeasures. localStorage key: `pi_jxj_state`. Dedicated Smartsheet sheet needed (create in PI workspace).

---

## Additional UX (Inherited from PTFE — No Changes Needed)

- **Theme selector** — same 4 themes apply to PI portal section
- **Ctrl+Shift+X supervisor reset** — already global listener, clears `pi_jxj_state` too (add to clear list)
- **Stale-state detection** — on PI portal init, if `pi_jxj_state.date !== today`, prompt to discard

---

## Implementation Checklist

### Smartsheet setup
- [ ] Create PI Master Configuration sheet (see `pi_portal_integration_roadmap.md`)
- [ ] Populate all PI associates, 18 sequences, and events as rows
- [ ] Create "PI Finishing – Job x Job Log" sheet (see `pi_jxj_tracker_roadmap.md`)
- [ ] Run `get_columns` on PI Master Log (`8097032053936004`) — identify and exclude formula columns
- [ ] Add all env vars to `.env`

### Server
- [ ] Add `PI_COLUMN_MAP` to `server.js` (finalized after `get_columns` audit)
- [ ] Add `PI_JOB_LOG_COLUMN_MAP` to `server.js` (after JxJ sheet is created)
- [ ] Add `test-pi` and `test-pi-super` to `TEST_ACCOUNT_DETAILS`
- [ ] Add `POST /api/submit-pi` endpoint
- [ ] Add `POST /api/submit-pi-jxj` endpoint
- [ ] Add PI branch to `/api/config` endpoint (items + standards + pareto options)
- [ ] Add `ALLOW_PI_MASTER_LOG_WRITES` flag check to both submit endpoints

### Frontend
- [ ] Add `#piPortal` section to `index.html` (mirrors `#ptfePortal`)
- [ ] All PI field IDs: `piItem`, `piLotNumber`, `piSequence`, `piTimeWorked`, `piSpoolFootage`, `piProcessingLength`, `piProcessingLengthUnit`, `piStartQty`, `piEndQty`, `piScrapParts`, `piReCuts`, `piComments`
- [ ] `PI_CONFIG` loading from `/api/config?dept=PI`
- [ ] `buildPiStandardsIndex()` function
- [ ] `calcPiStartQty()` auto-calc function wired to spool footage + processing length fields
- [ ] Sequence → spool-based / pull-type conditional visibility
- [ ] Inspection Pareto checkbox group (PI-specific 18 options)
- [ ] Pulling Pareto checkbox group (PI-specific 4 options)
- [ ] Pulling Methods checkbox group (same 7 as PTFE)
- [ ] OE gauge component wired to PI fields
- [ ] Apply Multiplier / Reset to Auto (flat 0.80 for all PI associates)
- [ ] `PI_NAV_SEQUENCE` for Enter-key navigation
- [ ] Event entry section (PI events)
- [ ] Job x Job tracker section (see `pi_jxj_tracker_roadmap.md`)
- [ ] `pi_jxj_state` localStorage management functions
- [ ] Add `pi_jxj_state` to Ctrl+Shift+X supervisor reset clear list
- [ ] Stale-state detection on PI portal init
- [ ] Update `public/admin.html` to route PI supervisors to `admin-pi.html`
- [ ] Create `public/admin-pi.html` (mirror `admin-ptfe.html`)

---

## Deferred

- PI supervisor/admin panel full implementation (build stub first, full panel after portal is proven)
- Unit Of Measure display (confirm what UOM values mean for qty display before implementing)
- Phase 1.5 quality alert (flag same item with high scrap from today's submissions)
- Rate Lookup Modal (all PI associates are 0.80 — lower priority)
- Job Timer (backend session endpoint)
