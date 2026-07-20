const crypto = require('crypto');

function mapSession(row) {
    if (!row) return null;
    return {
        id: row.session_id,
        userId: row.user_id,
        name: row.display_name,
        role: row.role,
        department: row.department,
        kioskId: row.kiosk_id,
        expiresAt: row.expires_at,
        lastSeenAt: row.last_seen_at
    };
}

function createIdentityRepository(database) {
    return {
        async createSession(input) {
            return database.withTransaction(async (client) => {
                await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`${input.department}:${input.name.toLowerCase()}`]);
                const existingUser = await client.query(`
                    SELECT * FROM users
                    WHERE department = $1 AND lower(display_name) = lower($2)
                    FOR UPDATE
                `, [input.department, input.name]);
                const user = existingUser.rowCount > 0
                    ? await client.query(`
                        UPDATE users SET display_name = $2, role = $3,
                            password_hash = COALESCE($4, password_hash), active = true,
                            updated_at = current_timestamp
                        WHERE id = $1
                        RETURNING *
                    `, [existingUser.rows[0].id, input.name, input.role, input.passwordHash || null])
                    : await client.query(`
                        INSERT INTO users (id, department, display_name, role, password_hash)
                        VALUES ($1, $2, $3, $4, $5)
                        RETURNING *
                    `, [crypto.randomUUID(), input.department, input.name, input.role, input.passwordHash || null]);

                await client.query('DELETE FROM kiosk_locks WHERE expires_at <= current_timestamp');
                const existingLock = await client.query(`
                    SELECT * FROM kiosk_locks WHERE user_id = $1 FOR UPDATE
                `, [user.rows[0].id]);
                if (existingLock.rowCount > 0 && existingLock.rows[0].kiosk_id !== input.kioskId) {
                    return { conflict: true, lock: existingLock.rows[0] };
                }
                if (existingLock.rowCount > 0) {
                    await client.query(`
                        UPDATE sessions SET revoked_at = current_timestamp, revoke_reason = 'replaced_by_login'
                        WHERE id = $1 AND revoked_at IS NULL
                    `, [existingLock.rows[0].session_id]);
                }

                const sessionId = crypto.randomUUID();
                const session = await client.query(`
                    INSERT INTO sessions (id, token_hash, user_id, kiosk_id, expires_at)
                    VALUES ($1, $2, $3, $4, $5)
                    RETURNING *
                `, [sessionId, input.tokenHash, user.rows[0].id, input.kioskId, input.expiresAt]);

                await client.query(`
                    INSERT INTO kiosk_locks (user_id, session_id, department, kiosk_id, expires_at)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (user_id) DO UPDATE SET
                        session_id = EXCLUDED.session_id,
                        department = EXCLUDED.department,
                        kiosk_id = EXCLUDED.kiosk_id,
                        updated_at = current_timestamp,
                        expires_at = EXCLUDED.expires_at
                `, [user.rows[0].id, sessionId, input.department, input.kioskId, input.expiresAt]);

                await client.query(`
                    INSERT INTO audit_events (
                        actor_name, actor_role, department, workstation, action,
                        entity_type, entity_id, details
                    ) VALUES ($1, $2, $3, $4, 'session.created', 'session', $5, '{}'::jsonb)
                `, [input.name, input.role, input.department, input.kioskId, sessionId]);

                return {
                    conflict: false,
                    session: mapSession({
                        ...session.rows[0],
                        session_id: session.rows[0].id,
                        display_name: user.rows[0].display_name,
                        role: user.rows[0].role,
                        department: user.rows[0].department
                    })
                };
            });
        },

        async findSession(tokenHash, expiresAt) {
            const result = await database.query(`
                UPDATE sessions s
                SET last_seen_at = current_timestamp, expires_at = $2
                FROM users u
                WHERE s.token_hash = $1 AND s.user_id = u.id
                  AND s.revoked_at IS NULL AND s.expires_at > current_timestamp AND u.active = true
                RETURNING s.id AS session_id, s.user_id, s.kiosk_id, s.expires_at,
                    s.last_seen_at, u.display_name, u.role, u.department
            `, [tokenHash, expiresAt]);
            if (result.rowCount === 0) return null;
            await database.query(`
                UPDATE kiosk_locks SET updated_at = current_timestamp, expires_at = $2
                WHERE session_id = $1
            `, [result.rows[0].session_id, expiresAt]);
            return mapSession(result.rows[0]);
        },

        async revokeSession(session, reason, options = {}) {
            return database.withTransaction(async (client) => {
                const openWorkspace = await client.query(`
                    SELECT * FROM workspaces
                    WHERE user_id = $1 AND department = $2 AND status = 'open'
                    FOR UPDATE
                `, [session.userId, session.department]);
                if (openWorkspace.rows[0]?.has_unsaved_work && !options.discard) {
                    return { revoked: false, unsavedWorkspace: true };
                }
                if (openWorkspace.rowCount > 0 && options.discard) {
                    await client.query(`
                        UPDATE workspaces SET status = 'discarded', has_unsaved_work = false,
                            closed_at = current_timestamp, close_reason = $2, updated_at = current_timestamp
                        WHERE id = $1
                    `, [openWorkspace.rows[0].id, options.discardReason]);
                    await client.query(`
                        INSERT INTO audit_events (
                            actor_name, actor_role, department, workstation, action,
                            entity_type, entity_id, details
                        ) VALUES ($1, $2, $3, $4, 'workspace.discarded', 'workspace', $5, $6::jsonb)
                    `, [session.name, session.role, session.department, session.kioskId, openWorkspace.rows[0].id, JSON.stringify({ reason: options.discardReason })]);
                }
                await client.query(`
                    UPDATE sessions SET revoked_at = current_timestamp, revoke_reason = $2
                    WHERE id = $1 AND revoked_at IS NULL
                `, [session.id, reason]);
                await client.query('DELETE FROM kiosk_locks WHERE session_id = $1', [session.id]);
                await client.query(`
                    INSERT INTO audit_events (
                        actor_name, actor_role, department, workstation, action,
                        entity_type, entity_id, details
                    ) VALUES ($1, $2, $3, $4, 'session.revoked', 'session', $5, $6::jsonb)
                `, [session.name, session.role, session.department, session.kioskId, session.id, JSON.stringify({ reason })]);
                return { revoked: true };
            });
        },

        async listLocks(department) {
            const result = await database.query(`
                SELECT k.user_id, k.session_id, k.department, k.kiosk_id, k.acquired_at,
                    k.updated_at, k.expires_at, u.display_name
                FROM kiosk_locks k JOIN users u ON u.id = k.user_id
                WHERE k.department = $1 AND k.expires_at > current_timestamp
                ORDER BY u.display_name
            `, [department]);
            return result.rows;
        },

        async releaseLock(userId, actor, reason) {
            return database.withTransaction(async (client) => {
                const user = await client.query(`
                    SELECT display_name FROM users WHERE id = $1 AND department = $2
                `, [userId, actor.department]);
                const lock = await client.query(`
                    DELETE FROM kiosk_locks
                    WHERE user_id = $1 AND department = $2
                    RETURNING *
                `, [userId, actor.department]);
                if (lock.rowCount === 0) return { released: false };
                await client.query(`
                    UPDATE sessions SET revoked_at = current_timestamp, revoke_reason = $2
                    WHERE id = $1 AND revoked_at IS NULL
                `, [lock.rows[0].session_id, reason]);
                await client.query(`
                    INSERT INTO audit_events (
                        actor_name, actor_role, department, workstation, action,
                        entity_type, entity_id, details
                    ) VALUES ($1, $2, $3, $4, 'kiosk_lock.released', 'user', $5, $6::jsonb)
                `, [actor.name, actor.role, actor.department, actor.kioskId, userId, JSON.stringify({ reason })]);
                return {
                    released: true,
                    name: user.rows[0]?.display_name,
                    kioskId: lock.rows[0].kiosk_id,
                    department: lock.rows[0].department
                };
            });
        }
    };
}

module.exports = {
    createIdentityRepository,
    mapSession
};
