# PI (Polyimide) Job x Job Tracker — Phase 1.5 Roadmap

Last updated: 2026-05-13

---

## Background

PI currently uses the same paper/Excel tracking approach as PTFE did before Phase 1.5. This roadmap replaces that with a live portal section that auto-populates from job entry submissions and submits to Smartsheet at End of Shift — identical to the PTFE JxJ tracker (`ptfe_jxj_tracker_roadmap.md`).

The entire design is copied from the PTFE implementation. Only the PI-specific values differ: cell names, sequence mapping, and the Smartsheet sheet used for submission. Read `ptfe_jxj_tracker_roadmap.md` first — this doc only calls out where PI differs.

---

## Design Decisions

All decisions are inherited from PTFE:

| Decision | Choice | Reason |
|---|---|---|
| Storage during shift | localStorage (`pi_jxj_state`) | No network dependency mid-shift |
| Submission target | Dedicated Smartsheet sheet ("PI Finishing – Job x Job Log") | Mirrors PTFE's separate JxJ sheet; keeps master log clean |
| Data format | Narrow/tall (one row per job + one summary row per cell per shift) | Same as PTFE — easy Smartsheet filtering |
| Roll Cut labeling | HR 1, HR 2... instead of Job 1, Job 2... | Matches Excel convention; same as PTFE |
| Loss Reason field | Optional free-text on every job | Same as PTFE — always optional, never blocking |
| End Shift trigger | Same button/flow pattern as PTFE | Consistency across departments |

---

## Smartsheet Sheet: "PI Finishing – Job x Job Log"

**Location:** PI Metrics workspace (ID `2188483709167492`)  
**Sheet ID:** TBD — create sheet before building  
**Env var:** `DEPT_PI_JOB_LOG_SHEET_ID`

### Column definitions (identical to PTFE JxJ Log)

| # | Column Title | Type | Notes |
|---|---|---|---|
| 1 | Row ID | TEXT_NUMBER | Primary column. Auto-label: `{Associate}-{Cell}-{Date}-{Slot}` |
| 2 | Work Date | DATE | |
| 3 | Associate Name | TEXT_NUMBER | |
| 4 | Cell | PICKLIST | PI cell names (see Tab Definitions below) |
| 5 | Job Slot | TEXT_NUMBER | "Job 1", "Job 2"... or "HR 1"... for Roll Cut |
| 6 | Row Type | PICKLIST | Job, Summary |
| 7 | Item Number | TEXT_NUMBER | |
| 8 | Lot Number | TEXT_NUMBER | |
| 9 | Std PPH | TEXT_NUMBER | From PI_STANDARDS lookup |
| 10 | Actual PPH | TEXT_NUMBER | (End Qty / Time Min) × 60 |
| 11 | OE % | TEXT_NUMBER | (Actual PPH / Std PPH) × 100 |
| 12 | Time (Min) | TEXT_NUMBER | |
| 13 | Start Qty | TEXT_NUMBER | |
| 14 | End Qty | TEXT_NUMBER | |
| 15 | Loss Reason | TEXT_NUMBER | Optional per-job note |
| 16 | Countermeasures | TEXT_NUMBER | Filled on Summary rows at shift close |
| 17 | Submitted At | TEXT_NUMBER | HH:MM timestamp of portal submission |

> **After creating the sheet:** Run `get_columns` to record all column IDs. Add them to `PI_JOB_LOG_COLUMN_MAP` in `server.js`.

---

## PI Cell Tabs — Working Assumptions

> **IMPORTANT:** Confirm PI cell names with floor supervisors before building. The assumptions below are based on PI's sequence list and the PTFE cell pattern. Do not hardcode these until verified.

PI's production workflow maps to these 5 cells (mirroring PTFE's structure):

| Tab label | Cell value (Smartsheet) | Slot prefix |
|---|---|---|
| Pull | Pull | Job |
| CTL | Cut to Length | Job |
| Inspection | Inspection | Job |
| Roll Cut | Roll Cut | HR |
| Packaging | Packaging | Job |

> If PI uses different cell names on the floor (e.g. "Long Pull" instead of "Pull", or different groupings), update this table and the Sequence → Cell mapping below before building. The PICKLIST values in the Smartsheet sheet must match the `Cell` values used in this table exactly.

---

## Sequence → Cell Mapping (Working Assumptions)

Based on PI's 18 sequences. Verify against actual PI production cells before finalizing.

| Sequence | Cell | Slot Prefix | Notes |
|---|---|---|---|
| Long Pull | Pull | Job | |
| Table Pull | Pull | Job | |
| Pull | Pull | Job | If this sequence name is used |
| CTL | Cut to Length | Job | |
| First Cut | Cut to Length | Job | |
| Length Check | Roll Cut | HR | Or Cut to Length — confirm |
| Overall Length | Roll Cut | HR | Or Cut to Length — confirm |
| Roll Cut (Both Ends) | Roll Cut | HR | |
| Inspection | Inspection | Job | |
| 10X | Inspection | Job | |
| Check Flush | Inspection | Job | |
| Pressure Test | Inspection | Job | |
| Spark Test | Inspection | Job | PI-only sequence |
| Crush Test | Inspection | Job | PI-only sequence |
| Flush | Packaging | Job | Or its own cell — confirm |
| Wrapping | Packaging | Job | Or its own cell — confirm |
| Packaging | Packaging | Job | |

> Sequences not mapped to any cell (e.g. events, or any sequence the floor doesn't track job-by-job) are excluded from JxJ tracking — same as PTFE.

---

## Portal UI — Job x Job Tracker

### Location in the page
Same structure as PTFE: inside `#piPortal`, below the entry form sections. Replace the PI placeholder or "coming soon" stub with the JxJ tracker section.

Section element: `<section id="piJxjSection">`

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Job x Job Tracker          [End Shift]                     │
│  ┌──────┬──────────┬────────────┬──────────┬───────────┐   │
│  │ Pull │   CTL    │ Inspection │ Roll Cut │ Packaging │   │
│  └──────┴──────────┴────────────┴──────────┴───────────┘   │
│  ┌──────┬────────┬────────┬─────────┬────────┬──────────┐  │
│  │ Slot │  Item  │Std PPH │ Act PPH │  OE %  │  Time    │  │
│  ├──────┼────────┼────────┼─────────┼────────┼──────────┤  │
│  │Job 1 │ 311318 │  120   │   104   │  87% ✓ │   28m    │  │
│  │      Loss Reason: [______________________________]    │  │
│  ├──────┴────────┴────────┴─────────┴────────┴──────────┤  │
│  │ SHIFT│        │  120   │    96   │  80% ⚠ │   62m    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### OE color coding (same as PTFE)
- OE ≥ 85% → green accent (`var(--accent)`)
- OE 70–84% → yellow/warn (`var(--warn)`)
- OE < 70% → red/danger (`var(--danger)`)

### Shift Summary row
Same calculations as PTFE:
- Shift Std PPH = weighted average of Std PPH by time
- Shift Actual PPH = (sum End Qty) / total minutes × 60
- Shift OE = (Shift Actual / Shift Std) × 100
- Total Time = sum of all job minutes

---

## localStorage State: `pi_jxj_state`

```js
{
  date: "2026-05-13",
  associate: "Jane",
  tabs: {
    "Pull": [],
    "Cut to Length": [],
    "Inspection": [],
    "Roll Cut": [],
    "Packaging": []
  }
}
```

Each job entry:
```js
{
    slot: "Job 1",         // assigned sequentially per cell
    item: "410205",
    lot: "10155100-01",
    sequence: "Long Pull",
    stdPph: 180,
    actualPph: 162,
    oe: 90.0,
    timeMins: 20,
    startQty: 0,
    endQty: 54,
    lossReason: "",
    submittedAt: "09:15"
}
```

**State management rules** (same as PTFE):
- Initialized fresh when date changes or associate changes
- Each Job Entry submit appends a record to the correct cell tab
- Slot label: `${prefix} ${tabs[cell].length + 1}` at time of submit
- Loss Reason edits update in-place
- State persists across page refresh

**Stale-state detection:** On PI portal init, if `pi_jxj_state.date !== today`, prompt "Stale shift data from {date}. Discard and start fresh?" and clear on confirm.

---

## Integration with Existing Job Entry

When a PI job is successfully submitted, call `appendPiJxJEntry(entryData)`:

```js
function appendPiJxJEntry(entry) {
    const state = loadPiJxJState();
    const cell = getPiCellForSequence(entry.sequence);
    if (!cell) return; // sequence not tracked in JxJ

    const actualPph = (entry.endQty / entry.timeMins) * 60;
    const oe = (actualPph / entry.stdPph) * 100;
    const slotPrefix = PI_JXJ_TABS.find(t => t.cell === cell)?.slotPrefix ?? 'Job';

    state.tabs[cell].push({
        slot: `${slotPrefix} ${state.tabs[cell].length + 1}`,
        item: entry.item,
        lot: entry.lot,
        sequence: entry.sequence,
        stdPph: entry.stdPph,
        actualPph: Math.round(actualPph),
        oe: Math.round(oe * 10) / 10,
        timeMins: entry.timeMins,
        startQty: entry.startQty,
        endQty: entry.endQty,
        lossReason: '',
        submittedAt: getCurrentHHMM(),
    });

    savePiJxJState(state);
    renderPiJxJ(cell);
}
```

---

## End Shift Flow

Mirrors PTFE End Shift exactly:

1. Associate clicks **End Shift** (top-right of JxJ Tracker card)
2. Dialog: "Submit shift summary and sign out?"
3. Countermeasures textarea (optional)
4. If confirmed → `showSubmittingOverlay()`
5. For each cell tab with ≥1 job entry:
   - Build payload: one row per job + one Summary row
   - Summary row carries `Countermeasures` value
6. `POST /api/submit-pi-jxj` → array of row objects
7. On success: clear `pi_jxj_state`, sign out via `performLogout()`
8. On failure: show error, keep state, let associate retry

---

## Server Endpoint: `POST /api/submit-pi-jxj`

**File:** `server.js`  
**Env var needed:** `DEPT_PI_JOB_LOG_SHEET_ID`

```js
// PI_JOB_LOG_COLUMN_MAP — populate after sheet is created and get_columns is run
const PI_JOB_LOG_COLUMN_MAP = {
    'Row ID':          TBD,
    'Work Date':       TBD,
    'Associate Name':  TBD,
    'Cell':            TBD,
    'Job Slot':        TBD,
    'Row Type':        TBD,
    'Item Number':     TBD,
    'Lot Number':      TBD,
    'Std PPH':         TBD,
    'Actual PPH':      TBD,
    'OE %':            TBD,
    'Time (Min)':      TBD,
    'Start Qty':       TBD,
    'End Qty':         TBD,
    'Loss Reason':     TBD,
    'Countermeasures': TBD,
    'Submitted At':    TBD,
};
```

Test-account (`test-pi`) and `ALLOW_PI_MASTER_LOG_WRITES` flag interception mirrors `POST /api/submit-ptfe-jxj`. Use `getClientForDept('PI')` for the API call.

---

## Implementation Checklist

### Smartsheet
- [ ] Create "PI Finishing – Job x Job Log" sheet in PI Metrics workspace
- [ ] Set Cell column PICKLIST values to match PI tab cell names (Pull, Cut to Length, Inspection, Roll Cut, Packaging — or whatever is confirmed)
- [ ] Run `get_columns` to record all 17 column IDs
- [ ] Add `DEPT_PI_JOB_LOG_SHEET_ID` to `.env`

### Server
- [ ] Populate `PI_JOB_LOG_COLUMN_MAP` with real column IDs
- [ ] Add `POST /api/submit-pi-jxj` endpoint (mirrors `submit-ptfe-jxj`)
- [ ] `test-pi` account interception
- [ ] `ALLOW_PI_MASTER_LOG_WRITES` gate

### Frontend
- [ ] `PI_JXJ_TABS` config array with confirmed PI cell names
- [ ] `getPiCellForSequence()` — maps sequence name → cell name
- [ ] `pi_jxj_state` localStorage management functions (load/save/clear)
- [ ] `appendPiJxJEntry()` — called from PI submit flow
- [ ] `renderPiJxJ(cellName)` — builds the table for active tab
- [ ] Tab switching
- [ ] Stale-state detection on PI portal init
- [ ] Loss Reason inline input per row
- [ ] Shift Summary row calculations
- [ ] End Shift button + `confirmPiEndShift()` dialog
- [ ] `performPiEndShift()` — POST to `/api/submit-pi-jxj`
- [ ] Add `pi_jxj_state` to Ctrl+Shift+X supervisor reset clear list
- [ ] OE color-coding (same CSS variables as PTFE — no new styles needed)
- [ ] JxJ section HTML with `id="piJxjSection"`

---

## Known Constraints

- `ALLOW_PI_MASTER_LOG_WRITES` gates both master log and JxJ submissions (same flag — both are production writes)
- Do not submit JxJ rows to the master log — they are separate records
- Packaging can accumulate many jobs per shift; table must scroll gracefully
- Roll Cut lot may span multiple HR slots — handled naturally (each Job Entry creates a new row)
- Confirm cell names before creating the Smartsheet sheet — changing PICKLIST values after data exists is painful
