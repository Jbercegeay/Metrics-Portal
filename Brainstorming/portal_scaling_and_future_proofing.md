# PL Portal — Scaling & Future-Proofing Roadmap

Last updated: 2026-05-12  
Context: Brainstorming doc for agents and developers working on the PL Portal as operator headcount and station count grow.

---

## Departments

The portal currently serves one department and will expand to two more:

| Key | Department | Status |
|-----|------------|--------|
| `PL` | Precision Liner | **Live** |
| `PTFE` | PTFE | Planned |
| `PI` | Polyamide (PI) | Planned |

Each department will have its own set of Smartsheet sheets and its own API token. See **Improvement 7** below for the full multi-department architecture plan.

---

## Current Architecture Baseline (as of May 2026)

- Single Express server (`server.js`) on one machine, serving all kiosk stations over LAN
- One Smartsheet API token shared across all requests (Precision Liner department only)
- Smartsheet is the only backend data store (no local DB)
- Frontend is vanilla JS in a single monolithic `public/index.html`
- Key sheets: Master Log, Hour-by-Hour Tracker, Config/Schedule sheet
- Current operator count: ~30 associates, supervisors (Precision Liner)

**Resilience already in place (as of recent commit):**
- 30-second timeout on all Smartsheet API calls (`lib/smartsheet.js`)
- Auto-retry interceptor: up to 3 attempts, exponential backoff (2s/4s/8s) on 429/503/timeout
- 5-minute config sheet cache in `/api/login` to eliminate login-burst rate limit spikes
- `fetchWithTimeout` (30s, AbortController) on all frontend fetch calls
- Partial Job submission detection — alerts user if not all sequences saved

---

## Scaling Trigger Points

Use this table to decide when to act on each improvement below.

| Operator Count | Risk That Appears |
|----------------|-------------------|
| Today (~30 PL) | Occasional transient 429s at shift end — **handled by retry interceptor** |
| ~60–90 (multi-dept) | Simultaneous shift-end submissions may exhaust retry budget; per-dept API tokens help; config cache handles login |
| ~30–50 | Submit burst regularly exceeds 300 req/min window; need server-side batching |
| 50+ or multi-station | Single API token becomes a bottleneck; need per-station tokens or a queue |
| ~12–18 months of current use | Master Log sheet approaches 500,000 cell limit; need archival |

---

## Improvement 1 — Use `X-RateLimit-Reset` for Precise Retry Timing

**Priority:** Do this soon — small change, high correctness payoff.

**Problem:** The current retry interceptor waits a fixed 2s/4s/8s on 429 responses. Smartsheet tells you *exactly* when the rate limit window resets via the `X-RateLimit-Reset` response header (a Unix timestamp). Guessing means potentially retrying too early (wasting an attempt) or waiting longer than necessary.

**Solution:** Read `X-RateLimit-Reset` from the 429 response headers and wait until that timestamp before retrying.

**File to change:** `lib/smartsheet.js` — inside the retry interceptor

```js
// Replace the fixed wait calculation with:
const resetHeader = error.response?.headers['x-ratelimit-reset'];
const wait = resetHeader
    ? Math.max(200, (parseInt(resetHeader) * 1000) - Date.now() + 200) // +200ms buffer
    : Math.pow(2, cfg.__retryCount) * 1000; // fallback to exponential backoff
```

**Effort:** ~15 minutes. No other files change.

---

## Improvement 2 — Server-Side Submission Queue with Batching

**Priority:** Implement when you hit ~20+ concurrent operators.

**Problem:** Each operator's job submission fires one POST per sequence to the Master Log. With 20 operators each submitting 3 sequences at shift end, that's 60 simultaneous POSTs — roughly 20% of the 300/min budget in a single burst. With retries, that multiplies.

**Solution:** Add a short-lived submission queue on the server. Instead of immediately forwarding each POST to Smartsheet, hold incoming rows for a 500ms collection window, then flush them all in a single batched POST (Smartsheet supports 500 rows per request). This collapses N concurrent submissions into 1 API call.

**How it works:**
```
Associate submits → Server adds row to in-memory queue → Returns 202 Accepted immediately
                                                          ↓
                                          Every 500ms: flush queue → single POST to Smartsheet
                                                          ↓
                                          Any failures: retry the batch (not individual rows)
```

**Files to change:**
- `server.js` — add queue buffer, flush interval, and modify `/api/submit` to enqueue instead of immediately POST
- `public/index.html` — optionally handle the 202 Accepted response (submission is "accepted" not yet "confirmed")

**Trade-off:** Submission is no longer synchronous — the associate gets an "accepted" confirmation, not a "saved to Smartsheet" confirmation. This is the correct behavior at scale and matches how high-volume APIs work. The overlay/toast messaging would need to reflect this ("Submission received" vs. "Saved to Smartsheet").

**Effort:** ~3–4 hours including frontend messaging update.

---

## Improvement 3 — Per-Station API Tokens

**Priority:** Implement when you add a second physical kiosk machine, or when sustained 429s appear despite batching.

**Problem:** The 300 req/min rate limit is per API token. All stations currently share one token.

**Solution:** Create a separate Smartsheet API token for each physical station and store it in that station's `.env` file. Each token gets its own independent 300 req/min bucket.

```
Station A: SMARTSHEET_ACCESS_TOKEN=tokenA  → 300 req/min
Station B: SMARTSHEET_ACCESS_TOKEN=tokenB  → 300 req/min
Total capacity: 600 req/min with zero code changes
```

**Files to change:** Only `.env` on each machine — no code changes required.

**Note:** All tokens should belong to the same Smartsheet account. Smartsheet's rate limits are per-token, so this is fully supported and officially recommended for multi-app scenarios.

**Effort:** 5 minutes per station.

---

## Improvement 4 — Master Log Sheet Archival

**Priority:** Implement before the sheet exceeds ~400,000 cells (~12–18 months at current pace).

**Problem:** Smartsheet sheets have a hard cap of 500,000 cells (rows × columns). The Master Log has ~80 columns. At 8 operators × 3 sequences/day × 250 workdays/year, the sheet grows by roughly 480,000 cells/year. It will hit the limit and start rejecting writes with no warning to users.

**Calculation to monitor:**
```
Current cells = (row count) × (column count)
Danger zone: > 400,000 cells
Action required: < 100,000 cells of headroom remaining
```

**Solution:** A script (already has a `scripts/` folder in the project) that:
1. Fetches all Master Log rows older than a cutoff date (e.g., 12 months ago)
2. POSTs them to an Archive sheet (create once, leave permanently)
3. DELETEs those rows from the active Master Log

This can be run manually once a year by a supervisor, or scheduled via a cron job on the server.

**Files to create:** `scripts/archive_master_log.js`

**Effort:** ~2 hours to write and test.

---

## Improvement 5 — Webhooks for Supervisor Dashboard / Live View

**Priority:** Implement if a live "what's happening on the floor" supervisor view is ever built.

**Problem:** Any feature that polls Smartsheet to show live data (e.g., "how many parts has each associate made today") will burn API quota continuously. At 1 poll per 30 seconds across 3 supervisor views, that's 6 requests/min just for display — 2% of the budget doing nothing productive.

**Solution:** Register a Smartsheet webhook on the Master Log sheet. Smartsheet POSTs a notification to the server whenever a row is added or changed. The server caches the latest state in memory and serves it to the supervisor dashboard instantly, at zero ongoing API cost.

**Constraint to be aware of:** Webhooks are automatically disabled on sheets exceeding 20,000 rows, 400 columns, or 500,000 cells. The archival strategy (Improvement 4) is a prerequisite for webhooks to remain active long-term.

**Files to change:**
- `server.js` — add webhook registration endpoint and POST handler
- New supervisor dashboard view in `public/`

**Effort:** ~4–6 hours including the dashboard UI.

---

## Improvement 6 — Local SQLite Cache as Read Buffer

**Priority:** Consider if Smartsheet availability becomes a reliability concern (e.g., multiple outages per month).

**Problem:** The portal is 100% dependent on Smartsheet being reachable. If Smartsheet has an outage or the internet connection drops, associates cannot log in or submit data at all. There is no offline mode.

**Solution:** Add a local SQLite database (using `better-sqlite3`, already trivial to add to Node) that:
- Caches the config sheet (associates, sequences, defects, events) — refreshed every 5 minutes
- Buffers failed submissions locally when Smartsheet is unreachable
- Replays buffered submissions automatically when connectivity restores

This is a significant architectural addition but makes the portal resilient to internet outages, which is meaningful for a factory floor environment.

**Files to change:** `lib/smartsheet.js`, `server.js`, new `lib/db.js`

**Effort:** ~1–2 days.

---

## What NOT to Build Until Needed

- **Redis or external queue** — overkill until you have multiple server machines
- **JWT authentication** — the current bcrypt + in-memory session pattern is appropriate for LAN-only internal tools at this scale
- **Full database migration away from Smartsheet** — Smartsheet serves as both data store and reporting tool; replacing it removes supervisor visibility in Smartsheet's native UI, which is a real operational cost

---

## Improvement 7 — Multi-Department Support (PTFE and Polyamide/PI)

**Priority:** Implement when the second department (PTFE or PI) is ready to onboard.

**Background:** The portal currently serves Precision Liner (PL) only. Two additional departments — PTFE and Polyamide (PI) — will be added in the future. Each department has its own production process, sequences, defects, and Smartsheet sheets. They must be fully isolated from each other: a PTFE associate should never see PL data, and submissions must go to the correct sheets.

### Architecture Decision: One Server, Department Routing

Run a single Express server serving all three departments. The user's department is stored in their config sheet row and returned at login. All API calls are routed to the correct Smartsheet token and sheet IDs based on department.

This avoids managing three separate server processes while keeping data fully isolated per department.

### `.env` Structure (one block per department)

```
# Precision Liner (PL) — current
DEPT_PL_API_TOKEN=token_abc123
DEPT_PL_CONFIG_SHEET_ID=...
DEPT_PL_MASTER_LOG_SHEET_ID=...
DEPT_PL_HOUR_BY_HOUR_SHEET_ID=...
DEPT_PL_DEFECT_SEEDS_SHEET_ID=...

# PTFE
DEPT_PTFE_API_TOKEN=token_def456
DEPT_PTFE_CONFIG_SHEET_ID=...
DEPT_PTFE_MASTER_LOG_SHEET_ID=...
DEPT_PTFE_HOUR_BY_HOUR_SHEET_ID=...
DEPT_PTFE_DEFECT_SEEDS_SHEET_ID=...

# Polyamide (PI)
DEPT_PI_API_TOKEN=token_ghi789
DEPT_PI_CONFIG_SHEET_ID=...
DEPT_PI_MASTER_LOG_SHEET_ID=...
DEPT_PI_HOUR_BY_HOUR_SHEET_ID=...
DEPT_PI_DEFECT_SEEDS_SHEET_ID=...
```

Each department gets its own API token → independent 300 req/min rate limit budget.

### `lib/smartsheet.js` — Per-Department Client Factory

```js
const _clients = {};

function getClientForDept(dept) {
    if (_clients[dept]) return _clients[dept]; // cached after first use
    const token = process.env[`DEPT_${dept}_API_TOKEN`];
    if (!token) throw new Error(`No API token configured for department: ${dept}`);
    _clients[dept] = createSmartsheetClient(token);
    return _clients[dept];
}
```

### `server.js` — Department-Aware Routing

At login, the server reads the `Department` column from the config sheet row and returns it in the session response. The frontend stores it in `localStorage` alongside `currentUser` and includes it in every submission payload.

```js
// Every submit/config endpoint uses department from payload:
const dept = req.body.department; // 'PL', 'PTFE', or 'PI'
const api = getClientForDept(dept);
const sheetId = process.env[`DEPT_${dept}_MASTER_LOG_SHEET_ID`];
await api.post(`sheets/${sheetId}/rows`, [newRow]);
```

### Config Cache — Keyed Per Department

The existing `_configCache` must be a map keyed by department, not a single object:

```js
// Change from:
let _configCache = null;

// To:
const _configCache = {}; // { PL: { data, time }, PTFE: { data, time }, ... }

async function getCachedConfigSheet(dept) {
    const now = Date.now();
    const cached = _configCache[dept];
    if (cached && (now - cached.time) < CONFIG_CACHE_TTL) return cached.data;
    const response = await getClientForDept(dept).get(`sheets/${process.env[`DEPT_${dept}_CONFIG_SHEET_ID`]}`);
    _configCache[dept] = { data: response.data, time: now };
    return response.data;
}
```

### Column Maps — Per Department

Different departments will have different sequences, defect types, and potentially different columns in their Master Log sheets. Each department needs its own `MASTER_LOG_COLUMN_MAP` and `PCD_COLUMN_MAP`. These can be defined as a nested object keyed by department key, or loaded from per-department JSON files.

### Smartsheet Setup Checklist (per new department)

When onboarding PTFE or PI:
- [ ] Create Config/Schedule sheet (clone structure from PL)
- [ ] Create Master Log sheet (clone structure from PL, adjust defect columns for the department)
- [ ] Create Hour-by-Hour Tracker sheet (clone from PL)
- [ ] Create Defect Seeds sheet (adjust defect list for the department)
- [ ] Generate a new Smartsheet API token for the department
- [ ] Add all sheet IDs and token to `.env`
- [ ] Add `Department` column to the config sheet and populate it for each associate
- [ ] Update column ID maps in `server.js` for the new department's sheets

### Files to Change When Adding a Department

| File | Change |
|------|--------|
| `.env` | Add new department block |
| `lib/smartsheet.js` | Add `getClientForDept()` factory |
| `server.js` | Refactor config cache to be per-dept; update all endpoints to use `dept` param; add per-dept column maps |
| `public/index.html` | Include `department` field in all submission payloads; store from login response |
| `public/login.html` | Store `department` from login response in `localStorage` |

**Effort:** ~1–2 days for full multi-department refactor.

---

## Quick Reference: What to Do When

| Situation | Action |
|-----------|--------|
| Associates see occasional "try again" errors | Already handled by retry interceptor |
| Login failures at shift start | Already handled by config cache |
| Consistent 429s at shift end | Implement server-side batching (Improvement 2) |
| Second kiosk station added | Create a second API token for it (Improvement 3) |
| Master Log approaching 400k cells | Run archival script (Improvement 4) |
| Building a supervisor live view | Implement webhooks (Improvement 5) |
| Smartsheet outages causing floor disruption | Implement SQLite offline buffer (Improvement 6) |
| Adding PTFE or PI department | Follow Improvement 7 multi-department plan |
