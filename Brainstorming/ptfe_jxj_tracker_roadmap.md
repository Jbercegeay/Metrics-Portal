# PTFE Job x Job Tracker — Phase 1.5 Roadmap

Last updated: 2026-05-13

---

## Background

The PTFE Finishing Department currently uses a paper/Excel sheet called  
`Job x Job Sheets (HR x HR Sheets).xlsx` to track productivity at each cell.  
This roadmap replaces that sheet with a live portal section that auto-populates  
from job entry submissions and submits to Smartsheet at End of Shift.

### Excel sheet structure (reference)
Five tabs, one per cell. Each tab shares this structure:
- **Header row**: Cell name, Associate, Shift, Date
- **Job rows** (Job 1–15, or HR 1–12 for Roll Cut): Part #, Std PPH, Actual PPH, OE %, Loss Reason, Sign-off
- **Shift Summary row**: Total Std, Total Actual, Shift OE, Countermeasures Taken

Only **Roll Cut** tracks true hour-by-hour (HR 1–12). All other cells (Table Pull,
Cut to Length, Inspection, Packaging) track job-by-job (Job 1–15, Packaging up to 30).

---

## Design Decisions

| Decision | Choice | Reason |
|---|---|---|
| Storage during shift | localStorage (`ptfe_jxj_state`) | No network dependency mid-shift, same pattern as PL |
| Submission target | Dedicated Smartsheet sheet ("PTFE Finishing – Job x Job Log") | Mirrors PL's separate H×H sheet; keeps master log clean |
| Data format | Narrow/tall (one row per job + one summary row per cell per shift) | Avoids 75+ column wide pivot; easy Smartsheet filtering |
| Roll Cut labeling | HR 1, HR 2... instead of Job 1, Job 2... | Matches Excel convention; same data model underneath |
| History section fate | Replaced by the Job x Job Tracker table | JxJ table renders the same info in a richer format |
| Loss Reason field | Optional free-text on every job (not just low OE) | User decision — always optional, never blocking |
| End Shift trigger | Same button/flow pattern as Precision Liner | Consistency; associates already familiar with this pattern |

---

## Smartsheet Sheet: "PTFE Finishing – Job x Job Log"

**Location:** PTFE Metrics workspace (ID `2462922992576388`)  
**Sheet ID:** `2513150724231044`  
**Env var:** `DEPT_PTFE_JOB_LOG_SHEET_ID=2513150724231044` ← already added to `.env`

### Column definitions (in order)

| # | Column Title | Type | Notes |
|---|---|---|---|
| 1 | Row ID | TEXT_NUMBER | Primary column. Auto-label: `{Associate}-{Cell}-{Date}-{Slot}` |
| 2 | Work Date | DATE | |
| 3 | Associate Name | TEXT_NUMBER | |
| 4 | Cell | PICKLIST | Table Pull, Cut to Length, Inspection, Roll Cut, Packaging |
| 5 | Job Slot | TEXT_NUMBER | "Job 1", "Job 2"... or "HR 1"... for Roll Cut |
| 6 | Row Type | PICKLIST | Job, Summary |
| 7 | Item Number | TEXT_NUMBER | |
| 8 | Lot Number | TEXT_NUMBER | |
| 9 | Std PPH | TEXT_NUMBER | From PTFE_STANDARDS lookup |
| 10 | Actual PPH | TEXT_NUMBER | (End Qty / Time Min) × 60 |
| 11 | OE % | TEXT_NUMBER | (Actual PPH / Std PPH) × 100 |
| 12 | Time (Min) | TEXT_NUMBER | |
| 13 | Start Qty | TEXT_NUMBER | |
| 14 | End Qty | TEXT_NUMBER | |
| 15 | Loss Reason | TEXT_NUMBER | Optional per-job note |
| 16 | Countermeasures | TEXT_NUMBER | Filled on Summary rows at shift close |
| 17 | Submitted At | TEXT_NUMBER | HH:MM timestamp of portal submission |

---

## Portal UI — Job x Job Tracker

### Location in the page
Replace the `<section class="card"><h2>Hour by Hour Tracker</h2>` stub in the PTFE portal
(`public/index.html`, inside `#ptfePortal`, below the entry form sections).

The History section (`#ptfeHistorySection`) is also removed — JxJ table supersedes it.
Remove the History button from the mode toggle bar as well.

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Job x Job Tracker          [End Shift]                     │
│  ┌──────────┬──────────┬────────────┬──────────┬──────────┐ │
│  │Table Pull│   CTL    │ Inspection │ Roll Cut │Packaging │ │
│  └──────────┴──────────┴────────────┴──────────┴──────────┘ │
│  ┌───────┬────────┬────────┬─────────┬─────────┬──────────┐ │
│  │ Slot  │ Item   │Std PPH │ Act PPH │  OE %   │  Time    │ │
│  ├───────┼────────┼────────┼─────────┼─────────┼──────────┤ │
│  │ Job 1 │ 311318 │  120   │   104   │  87%  ✓ │  28m     │ │
│  │ Job 2 │ 311318 │  120   │    88   │  73%  ⚠ │  34m     │ │
│  │       Loss Reason: [___________________________]        │ │
│  ├───────┴────────┴────────┴─────────┴─────────┴──────────┤ │
│  │ SHIFT  │  120   │    96   │  80%  ⚠ │  62m     │        │ │
│  └──────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Tab definitions
| Tab label | Cell value | Slot prefix |
|---|---|---|
| Table Pull | Table Pull | Job |
| CTL | Cut to Length | Job |
| Inspection | Inspection | Job |
| Roll Cut | Roll Cut | HR |
| Packaging | Packaging | Job |

### OE color coding
- OE ≥ 85% → green accent (`var(--accent)`)
- OE 70–84% → yellow/warn (`var(--warn)`)
- OE < 70% → red/danger (`var(--danger)`)

### Shift Summary row (always visible at bottom of table)
Auto-calculates from all job rows in the active tab:
- Shift Std PPH = weighted average of Std PPH by time
- Shift Actual PPH = (sum End Qty – sum Start Qty across jobs) / total minutes × 60
- Shift OE = (Shift Actual / Shift Std) × 100
- Total Time = sum of all job minutes

### Loss Reason
Inline `<input type="text">` in a sub-row under each job entry (always visible, always optional).
Pre-populated from localStorage if already entered.
Changes persist to localStorage immediately on blur.

---

## localStorage State: `ptfe_jxj_state`

```js
{
  date: "2026-05-13",           // getLocalDate()
  associate: "Johnny",
  tabs: {
    "Table Pull": [
      {
        slot: "Job 1",           // assigned sequentially per cell
        item: "311318",
        lot: "10155074-01",
        stdPph: 120,
        actualPph: 104,
        oe: 86.7,
        timeMins: 28,
        startQty: 0,
        endQty: 49,
        lossReason: "",
        submittedAt: "08:42"
      }
      // ...more jobs
    ],
    "Cut to Length": [],
    "Inspection": [],
    "Roll Cut": [],
    "Packaging": []
  }
}
```

**State management rules:**
- Initialized fresh when date changes or associate changes
- Each Job Entry submit appends a record to the correct cell tab
- The slot label is `${prefix} ${tabs[cell].length + 1}` at time of submit
- Loss Reason edits update in-place (no re-submit needed)
- State persists across page refresh

**Stale state detection:** Same pattern as PL — on portal init, if `ptfe_jxj_state.date !== today`, prompt "Stale shift data from {date}. Discard and start fresh?" and clear on confirm.

---

## End Shift Flow

Mirrors Precision Liner's End Shift exactly:

1. Associate clicks **End Shift** button (top-right of JxJ Tracker card)
2. `confirmPtfeEndShift()` checks for unsaved loss reasons, prompts:
   > "Submit shift summary and sign out?"
3. If confirmed → `showSubmittingOverlay()`
4. For each cell tab with ≥1 job entry:
   - Build payload: one row object per job + one Summary row
   - Summary row carries `Countermeasures` field (prompt input shown in step 2 dialog)
5. `POST /api/submit-ptfe-jxj` → array of row objects
6. On success: clear `ptfe_jxj_state` from localStorage, sign out (`performLogout()`)
7. On failure: show error, keep state, let associate retry

### End Shift dialog fields
- "Countermeasures taken this shift:" (textarea, optional)
- Submit button / Cancel button

---

## Server Endpoint: `POST /api/submit-ptfe-jxj`

**File:** `server.js`  
**Env var needed:** `DEPT_PTFE_JOB_LOG_SHEET_ID`

```js
// Request body: array of row objects
// [
//   { "Row ID": "Johnny-Table Pull-2026-05-13-Job 1", "Work Date": "2026-05-13",
//     "Associate Name": "Johnny", "Cell": "Table Pull", "Job Slot": "Job 1",
//     "Row Type": "Job", "Item Number": "311318", "Lot Number": "10155074-01",
//     "Std PPH": 120, "Actual PPH": 104, "OE %": 86.7, "Time (Min)": 28,
//     "Start Qty": 0, "End Qty": 49, "Loss Reason": "", "Countermeasures": "",
//     "Submitted At": "08:42" },
//   { ... Summary row ... }
// ]

const PTFE_JOB_LOG_SHEET_ID = getRequiredEnv('DEPT_PTFE_JOB_LOG_SHEET_ID');

const PTFE_JOB_LOG_COLUMN_MAP = {
    'Row ID':          3775244732239748,
    'Work Date':       8278844359610244,
    'Associate Name':  960494965133188,
    'Cell':            5464094592503684,
    'Job Slot':        3212294778818436,
    'Row Type':        7715894406188932,
    'Item Number':     2086394871975812,
    'Lot Number':      6589994499346308,
    'Std PPH':         4338194685661060,
    'Actual PPH':      8841794313031556,
    'OE %':            256807523356548,
    'Time (Min)':      4760407150727044,
    'Start Qty':       2508607337041796,
    'End Qty':         7012206964412292,
    'Loss Reason':     1382707430199172,
    'Countermeasures': 5886307057569668,
    'Submitted At':    3634507243884420
};
```

Test-account and `ALLOW_PTFE_MASTER_LOG_WRITES` flag interception mirrors `/api/submit-ptfe`.  
Use `getClientForDept('PTFE')` for the API call.

---

## Integration with Existing Job Entry

When `savePtfeEntryToHistory()` is called after a successful job submit,
also call `appendPtfeJxJEntry(entryData)` which:
1. Loads `ptfe_jxj_state` from localStorage
2. Determines the cell from `entry.sequence`
3. Calculates `actualPph = (entry.endQty / entry.timeMins) * 60`
4. Calculates `oe = (actualPph / entry.stdPph) * 100`
5. Appends the job record to the correct cell tab
6. Assigns slot number: `${slotPrefix} ${tabs[cell].length}` (after push, length = slot #)
7. Saves back to localStorage
8. Calls `renderPtfeJxJ()` to refresh the table

---

## What to Remove / Replace

| Element | Action |
|---|---|
| `#ptfeHistorySection` | Remove entirely |
| `ptfeHistoryModeBtn` | Remove from mode toggle bar |
| `togglePtfeHistory()` | Remove |
| `savePtfeEntryToHistory()` / `loadPtfeHistory()` / `renderPtfeHistory()` | Remove (replaced by JxJ functions) |
| `PTFE_HISTORY_KEY` constant | Remove |
| `.ptfe-history-*` CSS classes | Remove |
| `<section class="card"><h2>Hour by Hour Tracker</h2>...coming soon` | Replace with JxJ tracker section |

---

## Implementation Checklist

### Smartsheet (Agent 1) — COMPLETE
- [x] Identify PTFE Metrics workspace (ID: `2462922992576388`)
- [x] Create "PTFE Finishing – Job x Job Log" sheet with all 17 columns
- [x] Record all column IDs (see PTFE_JOB_LOG_COLUMN_MAP above)
- [x] Add `DEPT_PTFE_JOB_LOG_SHEET_ID=2513150724231044` to `.env`

### Server (Agent 2 — portal agent)
- [ ] Add `PTFE_JOB_LOG_SHEET_ID` constant loading from env
- [ ] Add `PTFE_JOB_LOG_COLUMN_MAP` with real column IDs
- [ ] Add `POST /api/submit-ptfe-jxj` handler (after existing `/api/submit-ptfe`)
- [ ] Test-account interception + `ALLOW_PTFE_MASTER_LOG_WRITES` gate

### Frontend (Agent 2 — portal agent)
- [ ] Remove History section, button, and related JS/CSS
- [ ] Add `ptfe_jxj_state` localStorage management functions
- [ ] Add `appendPtfeJxJEntry()` — called from existing submit flow
- [ ] Add `renderPtfeJxJ(cellName)` — builds the table for active tab
- [ ] Add `PTFE_JXJ_TABS` config array + tab switching
- [ ] Add stale-state detection on portal init
- [ ] Add End Shift button + `confirmPtfeEndShift()` dialog
- [ ] Add `submitPtfeJxJToSmartsheet()` — POST to `/api/submit-ptfe-jxj`
- [ ] Wire End Shift into `performLogout()` / sign-out flow
- [ ] Replace "Hour by Hour Tracker coming soon" stub with JxJ tracker section HTML
- [ ] Add OE color-coding CSS
- [ ] Add Loss Reason inline input per row
- [ ] Verify all 4 themes render correctly

---

## Sequence → Cell Mapping

The portal's `Sequence` dropdown values map to `Cell` column values as follows:

| Sequence dropdown value | Cell (Smartsheet) | Slot prefix |
|---|---|---|
| Table Pull | Table Pull | Job |
| Cut to Length | Cut to Length | Job |
| Inspection | Inspection | Job |
| EV3 Inspection | Inspection | Job |
| Roll Cut | Roll Cut | HR |
| Packaging | Packaging | Job |

Any sequence not in this map (e.g. Slit Tube Pull, events) is excluded from JxJ tracking.

---

## Known Constraints

- `ALLOW_PTFE_MASTER_LOG_WRITES` env flag gates **both** master log and JxJ submissions
  (reuse same flag — both are production writes)
- Do not submit JxJ rows to the **master log** — they are separate records
- Packaging can accumulate 30 jobs per shift; table must scroll gracefully
- Roll Cut lot may span multiple HR slots — this is normal and handled naturally
  (each Job Entry creates a new row; if one lot spans HR 1–3, it becomes HR 1, HR 2, HR 3)
