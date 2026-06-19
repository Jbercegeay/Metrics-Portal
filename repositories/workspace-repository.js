const crypto = require('crypto');

function mapWorkspace(row) {
    if (!row) return null;
    return {
        id: row.id,
        userId: row.user_id,
        department: row.department,
        workDate: row.work_date instanceof Date ? row.work_date.toISOString().slice(0, 10) : String(row.work_date),
        mode: row.mode,
        formData: row.form_data,
        hasUnsavedWork: row.has_unsaved_work,
        version: row.version,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

function createWorkspaceRepository(database) {
    return {
        async getCurrent(session) {
            const result = await database.query(`
                SELECT * FROM workspaces
                WHERE user_id = $1 AND department = $2 AND status = 'open'
            `, [session.userId, session.department]);
            return mapWorkspace(result.rows[0]);
        },

        async save(session, workspace) {
            return database.withTransaction(async (client) => {
                if (workspace.version === 0) {
                    const existing = await client.query(`
                        SELECT * FROM workspaces
                        WHERE user_id = $1 AND department = $2 AND status = 'open'
                        FOR UPDATE
                    `, [session.userId, session.department]);
                    if (existing.rowCount > 0) return { conflict: true, workspace: mapWorkspace(existing.rows[0]) };
                    const inserted = await client.query(`
                        INSERT INTO workspaces (
                            id, user_id, department, work_date, mode, form_data, has_unsaved_work
                        ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
                        RETURNING *
                    `, [crypto.randomUUID(), session.userId, session.department, workspace.workDate, workspace.mode, JSON.stringify(workspace.formData), workspace.hasUnsavedWork]);
                    return { conflict: false, workspace: mapWorkspace(inserted.rows[0]) };
                }

                const updated = await client.query(`
                    UPDATE workspaces
                    SET work_date = $4, mode = $5, form_data = $6::jsonb,
                        has_unsaved_work = $7, version = version + 1,
                        updated_at = current_timestamp
                    WHERE id = $1 AND user_id = $2 AND department = $3
                      AND status = 'open' AND version = $8
                    RETURNING *
                `, [workspace.id, session.userId, session.department, workspace.workDate, workspace.mode, JSON.stringify(workspace.formData), workspace.hasUnsavedWork, workspace.version]);
                if (updated.rowCount > 0) return { conflict: false, workspace: mapWorkspace(updated.rows[0]) };
                const current = await client.query(`
                    SELECT * FROM workspaces
                    WHERE user_id = $1 AND department = $2 AND status = 'open'
                `, [session.userId, session.department]);
                return { conflict: true, workspace: mapWorkspace(current.rows[0]) };
            });
        },

        async markSubmitted(session, submissionId) {
            return database.withTransaction(async (client) => {
                const updated = await client.query(`
                    UPDATE workspaces
                    SET has_unsaved_work = false, form_data = '{}'::jsonb,
                        version = version + 1, updated_at = current_timestamp
                    WHERE user_id = $1 AND department = $2 AND status = 'open'
                    RETURNING *
                `, [session.userId, session.department]);
                if (updated.rowCount > 0) {
                    await client.query(`
                        INSERT INTO audit_events (
                            actor_name, actor_role, department, workstation, action,
                            entity_type, entity_id, details
                        ) VALUES ($1, $2, $3, $4, 'workspace.submission_captured', 'workspace', $5, $6::jsonb)
                    `, [session.name, session.role, session.department, session.kioskId, updated.rows[0].id, JSON.stringify({ submissionId })]);
                }
                return mapWorkspace(updated.rows[0]);
            });
        }
    };
}

module.exports = {
    createWorkspaceRepository,
    mapWorkspace
};
