# Server Sessions And Workspaces

## Purpose

Server sessions and workspaces remove authoritative identity and active production state from browser `localStorage`. The compatibility login still validates the existing Smartsheet-backed account, then creates a database user, opaque session, kiosk lock, and HTTP-only cookie for departments enabled for migration.

## Feature Sequence

Enable only in this dependency order:

```text
DATABASE_ENABLED=true
SERVER_SESSIONS_ENABLED=true
PL_SERVER_SESSIONS_ENABLED=true
SERVER_WORKSPACES_ENABLED=true
DURABLE_SUBMISSIONS_ENABLED=true
PL_DATABASE_SUBMISSIONS_ENABLED=true
```

PTFE and PI session issuance remains separately disabled until their migration phases:

```text
PTFE_SERVER_SESSIONS_ENABLED=false
PI_SERVER_SESSIONS_ENABLED=false
```

The application rejects invalid feature combinations at startup.

## Session Security

- The browser receives a cryptographically random opaque token.
- PostgreSQL stores only the SHA-256 token hash.
- The cookie is HTTP-only, same-site `Lax`, path `/`, and secure by default in production.
- Session expiry slides with authenticated activity and defaults to 12 hours of inactivity.
- Re-login at the same kiosk replaces the previous session.
- An unexpired lock at another kiosk blocks login.
- Session, lock release, workspace discard, and submission actions create audit records.

HTTPS is required before production secure cookies are enabled.

## Session API

The compatibility `/api/login` response sets the cookie when the selected department's server sessions are enabled.

```text
GET    /api/v2/sessions/current
DELETE /api/v2/sessions/current
GET    /api/v2/sessions/kiosk-locks
POST   /api/v2/sessions/kiosk-locks/:userId/release
```

Sign-out returns HTTP 409 when the associate has unsaved workspace data. Intentional discard requires `discard=true` and a non-empty reason. Supervisor lock lists and releases are limited to the authenticated department.

## Workspace API

```text
GET /api/v2/workspaces/current
PUT /api/v2/workspaces/current
```

A workspace contains department, associate ownership through the session, work date, mode, form data, unsaved-work state, and integer version.

The first save uses version `0`. Every successful update increments the version. A stale tab receives HTTP 409 with the authoritative current workspace and cannot overwrite it.

The application permits only one open workspace per user and department. A successful durable capture clears the current workspace's form data and unsaved-work flag while retaining an audit link to the submission.

## Migration Compatibility

- Existing `localStorage` workflows remain active while all new flags are false.
- Enabling PL sessions does not issue database sessions for PTFE or PI.
- The in-memory compatibility kiosk lock is released when a database session signs out or a supervisor releases the durable lock.
- The database schema is additive; application rollback leaves session and workspace rows intact for audit and reconciliation.

## Validation

Automated coverage includes token hashing, cookie parsing, feature dependencies, kiosk conflict, same-kiosk replacement, inactivity resolution, stale-tab rejection, sign-out blocking, intentional discard, supervisor lock authorization, and audit-safe database cleanup.
