# Smartsheet API Rate Limits — Reference

Last updated: 2026-05-12

---

## Hard Limits

| Limit | Value |
|-------|-------|
| Standard requests | **300 per minute, per API token** |
| File attachments (POST) | **30 per minute** (counted as 10x each toward 300 limit) |
| Cell history fetch (GET) | **30 per minute** (counted as 10x each toward 300 limit) |
| Rate limit scope | **Per API token** — not per account, not per IP |
| Rows per add/update request | **500 rows maximum** |
| Sheet cell capacity | **500,000 cells maximum** (rows × columns) |
| Individual cell character limit | **4,000 characters** |
| Read vs. write distinction | **None** — GET and POST count equally |

---

## HTTP Response When Rate Limited

**Status:** `429 Too Many Requests`

**Body:**
```json
{
  "errorCode": 4003,
  "message": "Rate limit exceeded."
}
```

**Headers returned on every response (not just 429s):**

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Your total quota (e.g., `300`) |
| `X-RateLimit-Remaining` | Requests left in the current window |
| `X-RateLimit-Reset` | Unix timestamp (UTC) when the window resets |

> **Important:** Smartsheet does NOT use the standard `Retry-After` header. Read `X-RateLimit-Reset` to know exactly when to retry. Convert it: `new Date(parseInt(header) * 1000)`.

---

## Sheet & Data Limits

| Constraint | Limit |
|------------|-------|
| Sheet capacity | 500,000 cells (rows × columns) |
| Rows per add/update API call | 500 max |
| Report row retrieval | 10,000 max per request (default 100) |
| Max report total rows | 50,000 |
| Inbound cell links per sheet | 500,000 |
| Email recipients per API call | 1,000 |

### Webhook Disabling Thresholds
Smartsheet automatically disables webhooks on sheets that exceed **any** of:
- 20,000 rows
- 400 columns
- 500,000 cells

---

## Smartsheet Official Best Practices

1. **Use bulk operations** — add/update up to 500 rows in a single POST instead of one-row-per-request. This is the single biggest lever for staying under rate limits.
2. **Serial, not parallel, updates to the same object** — parallel writes to the same sheet cause save collisions. Separate sheets can be updated in parallel safely.
3. **Exponential backoff on 429** — wait, then retry with progressively longer delays. Use `X-RateLimit-Reset` for exact timing.
4. **Webhooks over polling** — webhooks deliver change notifications at zero API quota cost. Polling burns requests continuously.
5. **Cache read-heavy data** — config sheets, dropdown lists, and other rarely-changing data should be cached server-side rather than fetched fresh on every request.

---

## Multiple Tokens = Multiple Quotas

Rate limits are **per token**, not per account. A second API token (from the same Smartsheet account) gets its own independent 300 req/min allocation. This is the simplest scaling mechanism — one token per physical kiosk station effectively multiplies total throughput.

---

## Sources

- [Smartsheet API Limitations](https://developers.smartsheet.com/api/smartsheet/guides/basics/limitations)
- [Scalability Options](https://developers.smartsheet.com/api/smartsheet/guides/advanced-topics/scalability-options)
- [Webhooks Guide](https://developers.smartsheet.com/api/smartsheet/guides/webhooks)
- [API Best Practices](https://www.smartsheet.com/content-center/best-practices/tips-tricks/api-best-practices)
