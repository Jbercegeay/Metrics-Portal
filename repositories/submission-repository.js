function mapSubmission(row) {
    if (!row) return null;
    return {
        id: row.id,
        department: row.department,
        associateName: row.associate_name,
        entryType: row.entry_type,
        workDate: row.work_date instanceof Date ? row.work_date.toISOString().slice(0, 10) : String(row.work_date),
        kioskId: row.kiosk_id,
        payload: row.payload,
        payloadHash: row.payload_hash,
        validationVersion: row.validation_version,
        lifecycleStatus: row.lifecycle_status,
        syncStatus: row.sync_status,
        remoteRowId: row.remote_row_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        submittedAt: row.submitted_at,
        resolvedAt: row.resolved_at,
        resolutionReason: row.resolution_reason,
        retryCount: Number(row.attempt_count || 0),
        nextAttemptAt: row.next_attempt_at,
        lastErrorCode: row.last_error_code,
        lastErrorMessage: row.last_error_message
    };
}

function createSubmissionRepository(database) {
    return {
        async create(submission, destination, actor) {
            return database.withTransaction(async (client) => {
                const inserted = await client.query(`
                    INSERT INTO submissions (
                        id, department, associate_name, entry_type, work_date, kiosk_id,
                        payload, payload_hash, validation_version
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
                    ON CONFLICT (id) DO NOTHING
                    RETURNING *
                `, [
                    submission.id,
                    submission.department,
                    submission.associateName,
                    submission.entryType,
                    submission.workDate,
                    submission.kioskId,
                    JSON.stringify(submission.payload),
                    submission.payloadHash,
                    submission.validationVersion
                ]);

                if (inserted.rowCount === 0) {
                    const existing = await client.query(`
                        SELECT s.*, o.attempt_count, o.next_attempt_at, o.last_error_code, o.last_error_message
                        FROM submissions s
                        LEFT JOIN submission_outbox o ON o.submission_id = s.id
                        WHERE s.id = $1
                    `, [submission.id]);
                    return { created: false, submission: mapSubmission(existing.rows[0]) };
                }

                await client.query(`
                    INSERT INTO submission_outbox (submission_id, destination, payload)
                    VALUES ($1, $2, $3::jsonb)
                `, [submission.id, destination, JSON.stringify(submission.payload)]);

                await client.query(`
                    INSERT INTO audit_events (
                        actor_name, actor_role, department, workstation, action,
                        entity_type, entity_id, details
                    ) VALUES ($1, $2, $3, $4, 'submission.created', 'submission', $5, $6::jsonb)
                `, [
                    actor.name,
                    actor.role,
                    submission.department,
                    actor.workstation,
                    submission.id,
                    JSON.stringify({ entryType: submission.entryType, destination })
                ]);

                return { created: true, submission: mapSubmission(inserted.rows[0]) };
            });
        },

        async getById(id) {
            const result = await database.query(`
                SELECT s.*, o.attempt_count, o.next_attempt_at, o.last_error_code, o.last_error_message
                FROM submissions s
                LEFT JOIN submission_outbox o ON o.submission_id = s.id
                WHERE s.id = $1
            `, [id]);
            return mapSubmission(result.rows[0]);
        },

        async list(filters = {}) {
            const clauses = [];
            const values = [];
            const add = (sql, value) => {
                values.push(value);
                clauses.push(sql.replace('?', `$${values.length}`));
            };
            if (filters.status) add('s.sync_status = ?', filters.status);
            if (filters.department) add('s.department = ?', filters.department);
            if (filters.associateName) add('s.associate_name = ?', filters.associateName);
            if (filters.entryType) add('s.entry_type = ?', filters.entryType);
            if (filters.workDate) add('s.work_date = ?', filters.workDate);
            values.push(filters.limit || 100);
            const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
            const result = await database.query(`
                SELECT s.*, o.attempt_count, o.next_attempt_at, o.last_error_code, o.last_error_message
                FROM submissions s
                LEFT JOIN submission_outbox o ON o.submission_id = s.id
                ${where}
                ORDER BY s.created_at DESC
                LIMIT $${values.length}
            `, values);
            return result.rows.map(mapSubmission);
        },

        async retry(id, actor, reason) {
            return database.withTransaction(async (client) => {
                const result = await client.query(`
                    UPDATE submission_outbox o
                    SET state = 'pending', next_attempt_at = current_timestamp,
                        lease_owner = NULL, lease_expires_at = NULL, updated_at = current_timestamp
                    FROM submissions s
                    WHERE o.submission_id = s.id AND s.id = $1
                      AND s.sync_status IN ('failed', 'needs_review')
                    RETURNING s.department
                `, [id]);
                if (result.rowCount === 0) return false;
                await client.query(`
                    UPDATE submissions
                    SET sync_status = 'pending', updated_at = current_timestamp,
                        resolved_at = NULL, resolution_reason = NULL
                    WHERE id = $1
                `, [id]);
                await client.query(`
                    INSERT INTO audit_events (
                        actor_name, actor_role, department, workstation, action,
                        entity_type, entity_id, details
                    ) VALUES ($1, $2, $3, $4, 'submission.retry_requested', 'submission', $5, $6::jsonb)
                `, [actor.name, actor.role, result.rows[0].department, actor.workstation, id, JSON.stringify({ reason })]);
                return true;
            });
        },

        async resolve(id, actor, reason) {
            return database.withTransaction(async (client) => {
                const result = await client.query(`
                    UPDATE submissions
                    SET sync_status = 'resolved', resolved_at = current_timestamp,
                        resolution_reason = $2, updated_at = current_timestamp
                    WHERE id = $1 AND sync_status IN ('failed', 'needs_review')
                    RETURNING department
                `, [id, reason]);
                if (result.rowCount === 0) return false;
                await client.query(`
                    UPDATE submission_outbox
                    SET state = 'resolved', lease_owner = NULL, lease_expires_at = NULL,
                        updated_at = current_timestamp
                    WHERE submission_id = $1
                `, [id]);
                await client.query(`
                    INSERT INTO audit_events (
                        actor_name, actor_role, department, workstation, action,
                        entity_type, entity_id, details
                    ) VALUES ($1, $2, $3, $4, 'submission.resolved', 'submission', $5, $6::jsonb)
                `, [actor.name, actor.role, result.rows[0].department, actor.workstation, id, JSON.stringify({ reason })]);
                return true;
            });
        },

        async claimNext(workerId, leaseMs) {
            return database.withTransaction(async (client) => {
                const claimed = await client.query(`
                    WITH candidate AS (
                        SELECT id
                        FROM submission_outbox
                        WHERE (state = 'pending' AND next_attempt_at <= current_timestamp)
                           OR (state = 'processing' AND lease_expires_at < current_timestamp)
                        ORDER BY next_attempt_at, id
                        FOR UPDATE SKIP LOCKED
                        LIMIT 1
                    )
                    UPDATE submission_outbox o
                    SET state = 'processing', attempt_count = attempt_count + 1,
                        lease_owner = $1,
                        lease_expires_at = current_timestamp + ($2 * interval '1 millisecond'),
                        updated_at = current_timestamp
                    FROM candidate
                    WHERE o.id = candidate.id
                    RETURNING o.*
                `, [workerId, leaseMs]);
                if (claimed.rowCount === 0) return null;
                const outbox = claimed.rows[0];
                const submission = await client.query('SELECT * FROM submissions WHERE id = $1 FOR UPDATE', [outbox.submission_id]);
                await client.query(`
                    UPDATE submissions SET sync_status = 'processing', updated_at = current_timestamp WHERE id = $1
                `, [outbox.submission_id]);
                const delivery = await client.query(`
                    INSERT INTO submission_deliveries (
                        submission_id, outbox_id, attempt_number, worker_id
                    ) VALUES ($1, $2, $3, $4)
                    RETURNING id
                `, [outbox.submission_id, outbox.id, outbox.attempt_count, workerId]);
                return {
                    ...outbox,
                    submission: mapSubmission(submission.rows[0]),
                    deliveryId: delivery.rows[0].id
                };
            });
        },

        async completeSuccess(claim, result) {
            return database.withTransaction(async (client) => {
                const completed = await client.query(`
                    UPDATE submission_outbox
                    SET state = 'submitted', delivered_at = current_timestamp,
                        lease_owner = NULL, lease_expires_at = NULL,
                        last_error_code = NULL, last_error_message = NULL,
                        updated_at = current_timestamp
                    WHERE id = $1 AND lease_owner = $2 AND state = 'processing'
                    RETURNING id
                `, [claim.id, claim.lease_owner]);
                if (completed.rowCount === 0) throw new Error('Worker lease was lost before delivery completion.');
                await client.query(`
                    UPDATE submissions
                    SET sync_status = 'submitted', remote_row_id = $2,
                        submitted_at = current_timestamp, updated_at = current_timestamp
                    WHERE id = $1
                `, [claim.submission_id, result.remoteRowId || null]);
                await client.query(`
                    UPDATE submission_deliveries
                    SET result = $2, completed_at = current_timestamp,
                        remote_row_id = $3, response_code = $4, diagnostic = $5::jsonb
                    WHERE id = $1
                `, [
                    claim.deliveryId,
                    result.alreadyExists ? 'already_exists' : 'submitted',
                    result.remoteRowId || null,
                    result.responseCode || '200',
                    JSON.stringify(result.diagnostic || {})
                ]);
                await client.query(`
                    INSERT INTO audit_events (
                        actor_name, actor_role, department, action,
                        entity_type, entity_id, details
                    ) VALUES ('system', 'worker', $1, 'submission.submitted', 'submission', $2, $3::jsonb)
                `, [
                    claim.submission.department,
                    claim.submission_id,
                    JSON.stringify({ remoteRowId: result.remoteRowId || null, alreadyExists: result.alreadyExists === true })
                ]);
            });
        },

        async completeFailure(claim, failure) {
            return database.withTransaction(async (client) => {
                const terminal = failure.terminal === true;
                const state = terminal ? 'needs_review' : 'pending';
                const completed = await client.query(`
                    UPDATE submission_outbox
                    SET state = $3, next_attempt_at = $4,
                        lease_owner = NULL, lease_expires_at = NULL,
                        last_error_code = $5, last_error_message = $6,
                        updated_at = current_timestamp
                    WHERE id = $1 AND lease_owner = $2 AND state = 'processing'
                    RETURNING id
                `, [
                    claim.id,
                    claim.lease_owner,
                    state,
                    failure.nextAttemptAt,
                    failure.code,
                    failure.message
                ]);
                if (completed.rowCount === 0) throw new Error('Worker lease was lost before failure completion.');
                await client.query(`
                    UPDATE submissions SET sync_status = $2, updated_at = current_timestamp WHERE id = $1
                `, [claim.submission_id, terminal ? 'needs_review' : 'failed']);
                await client.query(`
                    UPDATE submission_deliveries
                    SET result = $2, completed_at = current_timestamp,
                        response_code = $3, diagnostic = $4::jsonb
                    WHERE id = $1
                `, [
                    claim.deliveryId,
                    terminal ? 'permanent_error' : 'retryable_error',
                    failure.code,
                    JSON.stringify({ message: failure.message })
                ]);
                if (terminal) {
                    await client.query(`
                        INSERT INTO audit_events (
                            actor_name, actor_role, department, action,
                            entity_type, entity_id, details
                        ) VALUES ('system', 'worker', $1, 'submission.needs_review', 'submission', $2, $3::jsonb)
                    `, [claim.submission.department, claim.submission_id, JSON.stringify({ code: failure.code })]);
                }
            });
        },

        async integrationHealth() {
            const result = await database.query(`
                SELECT
                    count(*) FILTER (WHERE state = 'pending')::integer AS pending_count,
                    count(*) FILTER (WHERE state = 'needs_review')::integer AS needs_review_count,
                    min(created_at) FILTER (WHERE state = 'pending') AS oldest_pending_at,
                    max(delivered_at) AS last_delivery_at
                FROM submission_outbox
            `);
            return result.rows[0];
        }
    };
}

module.exports = {
    createSubmissionRepository,
    mapSubmission
};
