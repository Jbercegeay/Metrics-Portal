# Polyimide (PI) Department Integration Roadmap

Last updated: 2026-05-13  
Context: Brainstorming doc for agents and developers building the PI (Polyimide) department into the portal. PTFE Phase 1 & 1.5 are complete and serve as the direct pattern to follow. Research complete — Smartsheet column IDs captured, Reference Sheets audited, architecture decisions confirmed from the PTFE build.

**PTFE Phase 1 & 1.5: COMPLETE.** See `ptfe_phase1_implementation_spec.md`.  
**PI: Not yet started.** This doc covers everything needed to build PI.

> **Pattern decision:** PI follows PTFE exactly — same server architecture, same config sheet pattern, same Job x Job tracker format. The only differences are PI-specific field values (sequences, pareto options, spool footage auto-calc) and the two unique sequences (Spark Test, Crush Test). Build PI by mirroring the PTFE implementation, not by designing from scratch.

---

## Overview

**Current state:** PI runs off a standalone single-HTML-file portal (no server, no authentication, submits to Smartsheet via Form URL).

**Target state:** PI integrated into the portal as a first-class department route — with proper bcrypt login, server-backed direct Smartsheet API writes, and the same resilience features already built for PL and PTFE.

**Build order:** PTFE was built first and is proven. PI is next. The architecture is already in place — this is mostly a matter of wiring PI-specific config and adding the one meaningful difference (spool footage auto-calc for Start Qty).

---

## Key Architecture Decisions (Inherited from PTFE)

| Decision | Choice | Reason |
|----------|--------|--------|
| Config sheet pattern | One Master Configuration sheet per dept | Mirrors PL/PTFE exactly |
| Sequence source | Master Configuration sheet (Sequences column rows) | Standards sheet has sequences per item — not the source of truth |
| Event source | Master Configuration sheet (Events column rows) | Same sheet, same pattern |
| Defect section | Not included | PI uses Pareto multi-selects instead |
| OE calculation | Actual PPH ÷ Standard PPH | Same as PTFE — loaded from Standards sheet |
| Item Number input | Text input (6-digit, typed) | Same as PTFE — faster on kiosk than scrolling 200+ item dropdown |
| Tracker format | Job x Job (same as PTFE) | Same per-job pattern — confirm PI cell names before building |
| Pareto fields | Multi-select checkboxes → comma-separated string | Same MULTI_PICKLIST pattern as PTFE |
| PPH Standards source | Load from PI Standards sheet server-side | Replaces the massive hardcoded table in the standalone portal (~200+ items) |

---

## How PI Differs from PTFE

These are the only meaningful differences. Everything else is the same pattern.

| Feature | PTFE | PI |
|---------|------|----|
| **Spool Footage** | No | Yes — decimal input (feet), drives Start Qty auto-calc |
| **Start Qty auto-calc** | Not applicable | `Math.floor((spoolFeet × 12) / partLengthInches)` — triggers when both spool footage and processing length are entered |
| **Sequences** | 16 (no Spark/Crush Test) | 16 + Spark Test + Crush Test = 18 total |
| **Inspection Pareto options** | 16 options | 18 options — PI-specific additions: Black Spots, Fibers, Glue, Oxidation, Unflushed |
| **Pulling Pareto options** | 8 options (detailed) | 4 options only: Material Breaking, Other, Release Issues, Wrong Footage |
| **Associate rates** | Mixed (0.69–0.81 per person) | All flat 0.80 — no per-person rate variation |
| **PPH Standards table** | ~30 items | 200+ items, more sequences per item (Spark Test, Crush Test, Specs, Tensile Test, etc.) |
| **Items sheet** | Item + FG Length (in) + Product Family | Item + FG Length (in) + Product Family + **Unit Of Measure** |
| **Unit Of Measure** | Not applicable | Extra column in Items sheet — may affect how quantities are displayed |
| **Smartsheet form (old)** | `248bcb0aeced4c1bb8782da7d00fc64b` | `8cdbc10deed54f85b6221a7294a88b42` (legacy, not used in new portal) |

---

## Smartsheet Resources

- **Workspace ID:** `2188483709167492` (PI Metrics)
- **Master Log Sheet ID:** `8097032053936004`

**PI Reference Sheets** (folder ID: `4015392298428292`):

| Sheet | Sheet ID | Columns | Portal Use |
|-------|----------|---------|------------|
| Associates | `3607206386683780` | Name, Cell, Scheduled Minutes, Rate, Mon–Sun | Smartsheet-native reporting only — **not** the portal config source |
| Standards | `7039666403364740` | Item, Sequence (TEXT_NUMBER), Good PPH Std, Total PPH Std | PPH lookup — load server-side, cache on startup. **Not** used for sequence list. |
| Items | `4226933660274564` | Item, FG Length (in), Product Family, Unit Of Measure | FG Length feeds Start Qty auto-calc; Item list not needed (typed input) |
| Historical Yields | `5599530046148484` | — | Not needed for portal |
| Holidays Date | `6235767174025092` | — | Optional: schedule logic |

**PI Master Configuration sheet** — must be created before building (same structure as PTFE's, `Department = "PI"`):

> Env var: `DEPT_PI_CONFIG_SHEET_ID`

---

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

> **Before writing the submit endpoint:** Run `get_columns` on the PI Master Log sheet (`8097032053936004`) to verify every column. Any column where `formula` is non-null must be excluded. Likely formula columns: `Scrap Rate %`, `Sequence OE`, any column with "%" in the name. The map above already omits `scrapRatePct` as a precaution.

---

## Sequences, Events & Pareto Options

### PI Sequences (18 total — verify against live config sheet at build time)
Long Pull, Table Pull, CTL, Inspection, Packaging, Flush, Wrapping, Check Flush, Pressure Test, 10X, Length Check, First Cut, Overall Length, Roll Cut (Both Ends), Spark Test, Crush Test

> Note: PI sequences are stored as `TEXT_NUMBER` rows in the Standards sheet (not a PICKLIST column), unlike PTFE which uses a PICKLIST. This means distinct sequence names must be extracted from the row data. The Master Config sheet is still the authoritative source for the portal sequence list — Standards sheet is PPH lookup only.

### PI Events (confirmed)
Baking, Clean-Up, Meeting, Misc, No Pay No Penalty, PTO, Toolbox, Training

> Required events always injected (not from config): Lunch, Break, Bathroom

### PI Inspection Pareto Options (18 options — load from Master Log column definitions)
Black Spots, Blisters, Braid Breaks, Bumps, Chatter Marks, Delamination, Discoloration, Fibers, Glue, Green Folder, Oxidation, Other, Poly didn't clean off, Red Folder, Stretched, Torn ID, Unflushed, Wrinkles

> PI-specific additions vs PTFE: Black Spots, Fibers, Glue, Oxidation, Unflushed

### PI Pulling Pareto Options (4 options — much simpler than PTFE's 8)
Material Breaking, Other (Enter Comments), Release Issues, Wrong Footage

### PI Pulling Methods (same 7 as PTFE)
Stretch Then Score, Score Then Stretch, Scrape, Straighten Only, Single, Double, Triple

> All Pareto and Pulling Method options should be read from the Master Log column definitions (`GET /sheets/{id}/columns`) and cached at login — same pattern as PTFE. This avoids hardcoding the option list in code.

---

## OE Calculation

Same formula as PTFE:

```
OE = (endQty / timeWorked) / PPH_STANDARD[item][sequence]
```

The PPH_STANDARD table is loaded from the PI Standards sheet (`7039666403364740`). PI's table is significantly larger than PTFE's (~200+ items vs ~30) but the loading and caching pattern is identical — fetch on startup with same TTL as config cache.

Associate rate for PI is flat 0.80 for all associates. The "Apply Multiplier" UI should still be present (same as PTFE) but will default to 0.80 for everyone.

---

## Spool Footage Auto-Calc (PI Only)

This is the primary behavioral difference from PTFE in the job entry form:

```js
// Triggers when both spoolFootage and processingLength are entered
function calcPiStartQty(spoolFeet, partLength, partLengthUnit) {
    const partLengthInches = convertToInches(partLength, partLengthUnit);
    const spoolInches = spoolFeet * 12;
    return Math.floor(spoolInches / partLengthInches);
}
```

- **Spool Footage** field: decimal number input (feet)
- Fires on `input` for either field when both are non-empty
- Result populates Start Qty (same as PTFE's auto-calc, just different trigger)
- "Reset to Manual" button allows associate to override the auto-calc (same Apply Multiplier / Reset pattern as PTFE)

---

## MULTI_PICKLIST Field Handling (Pareto fields)

Same as PTFE — no changes to the pattern:

```js
// Example: Inspection Pareto
const inspectionPareto = Array.from(
    document.querySelectorAll('[name="piInspectionPareto"]:checked')
).map(cb => cb.value).join(',');

// In the row cell:
{ columnId: PI_COLUMN_MAP.inspectionPareto, value: inspectionPareto }
```

---

## What Needs to Be Created in Smartsheet Before Building

### 1. PI Master Configuration sheet (MUST CREATE)

Create a new sheet in the PI workspace named **"Master Configuration"**. Model it exactly on the PTFE Master Configuration sheet.

**Columns:**

| Column | Type | Notes |
|--------|------|-------|
| Associate Name | TEXT_NUMBER (primary) | Populate with all PI associates |
| Cell | PICKLIST | Cell assignment |
| Scheduled Minutes | PICKLIST | 420 or 525 |
| Rate | PICKLIST | All 0.80 for PI |
| Mon / Tue / Wed / Thurs / Fri / Sat / Sun | TEXT_NUMBER | Schedule |
| Role | PICKLIST (`Associate`, `Supervisor`) | |
| Password Hash | TEXT_NUMBER | Written by server on password setup |
| Department | TEXT_NUMBER | Value = `"PI"` |
| Sequences | TEXT_NUMBER | One per row: all 18 PI sequences |
| Sequence Goals | TEXT_NUMBER | Leave as 0 — PI uses PPH OE, not goals |
| Events | TEXT_NUMBER | One per row: all PI events |

After creating: add `DEPT_PI_CONFIG_SHEET_ID` to `.env`.

### 2. PI Finishing – Job x Job Log sheet (MUST CREATE)

Same structure as the PTFE JxJ Log (`2513150724231044`) but for PI. See `pi_jxj_tracker_roadmap.md` for full column definitions.

After creating: add `DEPT_PI_JOB_LOG_SHEET_ID` to `.env`.

### What's already in Smartsheet — no new sheets needed
- Standards sheet — exists and populated (200+ items). Load server-side.
- Items sheet — exists with FG Length column (needed for Start Qty auto-calc).
- Associates reference sheet — remains as-is for Smartsheet-native reporting.

---

## Phase 2: PI Integration — Step-by-Step

Follow the same pattern as PTFE Phase 1. Reference `ptfe_phase1_implementation_spec.md` at every step — PI should mirror it exactly except where noted below.

### Smartsheet setup
- [ ] Create PI Master Configuration sheet (same structure as PTFE's, `Department = "PI"`)
- [ ] Populate all PI associates, sequences (18), and events as rows
- [ ] Create "PI Finishing – Job x Job Log" sheet (see `pi_jxj_tracker_roadmap.md`)
- [ ] Add all env vars to `.env`:
  - `DEPT_PI_API_TOKEN`
  - `DEPT_PI_CONFIG_SHEET_ID`
  - `DEPT_PI_MASTER_LOG_SHEET_ID` = `8097032053936004`
  - `DEPT_PI_STANDARDS_SHEET_ID` = `7039666403364740`
  - `DEPT_PI_ITEMS_SHEET_ID` = `4226933660274564`
  - `DEPT_PI_JOB_LOG_SHEET_ID` (once sheet is created)

### Server changes
- [ ] `getClientForDept('PI')` — already supported in `lib/smartsheet.js` (key just needs env var)
- [ ] `_configCache` is already dept-keyed — no changes needed
- [ ] `/api/config?dept=PI` — add PI branch in the config endpoint (mirrors PTFE branch)
- [ ] `POST /api/submit-pi` — new endpoint, mirrors `POST /api/submit-ptfe` with `PI_COLUMN_MAP`
- [ ] `POST /api/submit-pi-jxj` — new endpoint, mirrors `POST /api/submit-ptfe-jxj` with PI JxJ column map
- [ ] Add `PI_COLUMN_MAP` to `server.js`
- [ ] Add `PI_JOB_LOG_COLUMN_MAP` to `server.js` (once sheet is created and IDs are known)
- [ ] `test-pi` training account — same pattern as `test-ptfe`
- [ ] `ALLOW_PI_MASTER_LOG_WRITES` env flag — gates all PI Smartsheet writes

### Frontend changes
- [ ] PI portal section in `public/index.html` (mirrors `#ptfePortal`, rename to `#piPortal`)
- [ ] All form field IDs prefixed with `pi` instead of `ptfe`
- [ ] Add **Spool Footage** field (decimal, feet) — not in PTFE
- [ ] Start Qty auto-calc from spool footage + processing length
- [ ] Sequences dropdown populated from PI config (18 sequences including Spark Test + Crush Test)
- [ ] PI-specific Inspection Pareto options (18 options)
- [ ] PI-specific Pulling Pareto options (4 options, not 8)
- [ ] Pulling Methods (same 7 as PTFE)
- [ ] OE gauge — same component, same color thresholds
- [ ] Job x Job tracker with PI cells (see `pi_jxj_tracker_roadmap.md`)
- [ ] Event entry — same pattern as PTFE
- [ ] `PI_CONFIG` object loaded from `/api/config?dept=PI`
- [ ] `PI_NAV_SEQUENCE` for Enter-key field navigation
- [ ] `pi_jxj_state` localStorage key for JxJ tracker
- [ ] Ctrl+Shift+X supervisor reset — already global, no change needed
- [ ] `admin-pi.html` stub or placeholder for PI admin panel
- [ ] Update `public/admin.html` to route PI supervisors to `admin-pi.html`

---

## Critical Notes for the Building Agent

Read these before writing any code. These mirror the PTFE critical notes with PI-specific additions.

### 1. Verify PI Master Log column map via `get_columns` before writing the submit endpoint

The PI Master Log has 51 columns. The map in this doc covers ~20 submission fields. Run `get_columns` on sheet `8097032053936004` and exclude any column where `formula` is non-null. Likely formula columns: `Scrap Rate %`, `Sequence OE`. The map already omits `scrapRatePct` as a precaution.

### 2. PI sequence source in Standards sheet is TEXT_NUMBER, not PICKLIST

The PTFE Standards sheet uses a PICKLIST column for sequences — the option list can be read from column metadata. The PI Standards sheet uses TEXT_NUMBER for sequences — distinct sequence names must be extracted from actual row values. The Master Config sheet is still the authoritative sequence list for the portal; the Standards sheet is PPH lookup only.

### 3. Unit Of Measure column in PI Items sheet

PI's Items sheet has a `Unit Of Measure` column that PTFE's does not. Read this column when fetching items data and include it in the config response. It may affect how Start Qty or End Qty are displayed to the associate.

### 4. Spool Footage auto-calc must handle unit conversion

Processing Length is entered with a unit selector (in/cm/mm). Spool footage is always in feet. The auto-calc must convert all values to inches before dividing:

```
startQty = Math.floor((spoolFeet * 12) / partLengthInches)
```

If partLengthUnit is `cm`: `partLengthInches = partLength / 2.54`  
If partLengthUnit is `mm`: `partLengthInches = partLength / 25.4`  
If partLengthUnit is `in`: use as-is

### 5. PI JxJ cell names — confirm before building the tracker

The PTFE cells (Pull, Cut to Length, Inspection, Roll Cut, Packaging) map naturally from PTFE's production workflow. PI's cells may differ. Confirm the exact cell names used on the floor before hardcoding them in the tracker. See `pi_jxj_tracker_roadmap.md` for the working assumptions and the sequence → cell mapping to verify.

### 6. `test-pi` training account

Add `test-pi` following the same `TEST_ACCOUNT_DETAILS` pattern as `test-ptfe` in `server.js`. Same password (`trenton1`). No Smartsheet writes. Also add `test-pi-super` for the PI supervisor test account.

### 7. `ALLOW_PI_MASTER_LOG_WRITES` env flag

Gate all PI Smartsheet writes behind this flag, same as `ALLOW_PTFE_MASTER_LOG_WRITES`. Both master log and JxJ writes should check this flag.

### 8. PPH Standards table is much larger for PI

PI has 200+ item numbers vs PTFE's ~30. The loading pattern is identical but the cached payload will be significantly larger. This is not a problem — the server-side cache handles it — but be aware that `/api/config?dept=PI` will return a larger `standards` object than the PTFE equivalent.

### 9. PI admin panel

Build a minimal `admin-pi.html` that mirrors `admin-ptfe.html`. At minimum it needs: associate roster management, sequence management, and event management. PPH standards editing can be deferred (managed in Smartsheet directly for now).

---

## Resolved Questions (inherited from PTFE research)

| Question | Resolution |
|----------|------------|
| Tracker format for PI | Job x Job — same as PTFE. Confirm cell names before building. |
| PI sequences | Confirmed 18 sequences (verify against live config at build time). |
| PI events | Confirmed: Baking, Clean-Up, Meeting, Misc, No Pay No Penalty, PTO, Toolbox, Training |
| Pareto source | Load from Master Log column definitions — same pattern as PTFE |
| Item input format | Text input (6-digit typed) — same as PTFE, not a dropdown |
| Associate rates | All flat 0.80 for PI |

## Open Questions (resolve before building)

| Question | Impact |
|----------|--------|
| PI JxJ cell names | Cell tab labels and Smartsheet PICKLIST values in the JxJ Log sheet |
| PI sequence → cell mapping | Which sequences map to which JxJ tabs |
| Unit Of Measure values | What values appear in the UOM column — affects qty display |
| PI admin panel scope | What admin controls PI supervisors need on day one |
| `DEPT_PI_API_TOKEN` | Confirm this is the same API token as PTFE or a separate one |
