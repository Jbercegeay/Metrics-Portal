exports.up = (pgm) => {
    pgm.sql(`
        CREATE TABLE submissions (
            id uuid PRIMARY KEY,
            department text NOT NULL CHECK (department IN ('PL', 'PTFE', 'PI')),
            associate_name text NOT NULL CHECK (length(associate_name) BETWEEN 1 AND 80),
            entry_type text NOT NULL CHECK (entry_type IN ('job', 'event', 'jxj')),
            work_date date NOT NULL,
            kiosk_id text NOT NULL,
            payload jsonb NOT NULL,
            payload_hash char(64) NOT NULL,
            validation_version integer NOT NULL DEFAULT 1,
            lifecycle_status text NOT NULL DEFAULT 'committed'
                CHECK (lifecycle_status IN ('committed', 'cancelled')),
            sync_status text NOT NULL DEFAULT 'pending'
                CHECK (sync_status IN ('pending', 'processing', 'submitted', 'failed', 'needs_review', 'resolved')),
            remote_row_id text,
            created_at timestamptz NOT NULL DEFAULT current_timestamp,
            updated_at timestamptz NOT NULL DEFAULT current_timestamp,
            submitted_at timestamptz,
            resolved_at timestamptz,
            resolution_reason text
        );

        CREATE INDEX submissions_status_created_idx
            ON submissions (sync_status, created_at DESC);
        CREATE INDEX submissions_department_date_idx
            ON submissions (department, work_date DESC, entry_type);
        CREATE INDEX submissions_associate_date_idx
            ON submissions (associate_name, work_date DESC);

        CREATE TABLE submission_outbox (
            id bigserial PRIMARY KEY,
            submission_id uuid NOT NULL UNIQUE REFERENCES submissions(id) ON DELETE RESTRICT,
            destination text NOT NULL,
            payload jsonb NOT NULL,
            state text NOT NULL DEFAULT 'pending'
                CHECK (state IN ('pending', 'processing', 'submitted', 'failed', 'needs_review', 'resolved')),
            attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
            next_attempt_at timestamptz NOT NULL DEFAULT current_timestamp,
            lease_owner text,
            lease_expires_at timestamptz,
            last_error_code text,
            last_error_message text,
            created_at timestamptz NOT NULL DEFAULT current_timestamp,
            updated_at timestamptz NOT NULL DEFAULT current_timestamp,
            delivered_at timestamptz
        );

        CREATE INDEX submission_outbox_claim_idx
            ON submission_outbox (next_attempt_at, id)
            WHERE state = 'pending';
        CREATE INDEX submission_outbox_expired_lease_idx
            ON submission_outbox (lease_expires_at)
            WHERE state = 'processing';

        CREATE TABLE submission_deliveries (
            id bigserial PRIMARY KEY,
            submission_id uuid NOT NULL REFERENCES submissions(id) ON DELETE RESTRICT,
            outbox_id bigint NOT NULL REFERENCES submission_outbox(id) ON DELETE RESTRICT,
            attempt_number integer NOT NULL CHECK (attempt_number > 0),
            worker_id text NOT NULL,
            started_at timestamptz NOT NULL DEFAULT current_timestamp,
            completed_at timestamptz,
            result text NOT NULL DEFAULT 'processing'
                CHECK (result IN ('processing', 'submitted', 'already_exists', 'retryable_error', 'permanent_error')),
            response_code text,
            remote_row_id text,
            diagnostic jsonb NOT NULL DEFAULT '{}'::jsonb,
            UNIQUE (outbox_id, attempt_number)
        );

        CREATE INDEX submission_deliveries_submission_idx
            ON submission_deliveries (submission_id, started_at DESC);

        CREATE TABLE audit_events (
            id bigserial PRIMARY KEY,
            occurred_at timestamptz NOT NULL DEFAULT current_timestamp,
            actor_name text NOT NULL,
            actor_role text NOT NULL,
            department text CHECK (department IN ('PL', 'PTFE', 'PI')),
            workstation text,
            action text NOT NULL,
            entity_type text NOT NULL,
            entity_id text NOT NULL,
            details jsonb NOT NULL DEFAULT '{}'::jsonb
        );

        CREATE INDEX audit_events_entity_idx
            ON audit_events (entity_type, entity_id, occurred_at DESC);
        CREATE INDEX audit_events_actor_idx
            ON audit_events (actor_name, occurred_at DESC);
    `);
};

exports.down = (pgm) => {
    pgm.sql(`
        DROP TABLE audit_events;
        DROP TABLE submission_deliveries;
        DROP TABLE submission_outbox;
        DROP TABLE submissions;
    `);
};
