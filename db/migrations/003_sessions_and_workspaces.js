exports.up = (pgm) => {
    pgm.sql(`
        CREATE TABLE users (
            id uuid PRIMARY KEY,
            department text NOT NULL CHECK (department IN ('PL', 'PTFE', 'PI')),
            display_name text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 80),
            role text NOT NULL DEFAULT 'Associate' CHECK (role IN ('Associate', 'Supervisor', 'Administrator')),
            password_hash text,
            active boolean NOT NULL DEFAULT true,
            created_at timestamptz NOT NULL DEFAULT current_timestamp,
            updated_at timestamptz NOT NULL DEFAULT current_timestamp
        );
        CREATE UNIQUE INDEX users_department_name_unique
            ON users (department, lower(display_name));

        CREATE TABLE sessions (
            id uuid PRIMARY KEY,
            token_hash char(64) NOT NULL UNIQUE,
            user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
            kiosk_id text NOT NULL,
            created_at timestamptz NOT NULL DEFAULT current_timestamp,
            last_seen_at timestamptz NOT NULL DEFAULT current_timestamp,
            expires_at timestamptz NOT NULL,
            revoked_at timestamptz,
            revoke_reason text
        );
        CREATE INDEX sessions_active_token_idx
            ON sessions (token_hash, expires_at)
            WHERE revoked_at IS NULL;
        CREATE INDEX sessions_user_idx
            ON sessions (user_id, created_at DESC);

        CREATE TABLE kiosk_locks (
            user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT,
            session_id uuid NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
            department text NOT NULL CHECK (department IN ('PL', 'PTFE', 'PI')),
            kiosk_id text NOT NULL,
            acquired_at timestamptz NOT NULL DEFAULT current_timestamp,
            updated_at timestamptz NOT NULL DEFAULT current_timestamp,
            expires_at timestamptz NOT NULL
        );
        CREATE INDEX kiosk_locks_expiry_idx ON kiosk_locks (expires_at);

        CREATE TABLE workspaces (
            id uuid PRIMARY KEY,
            user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
            department text NOT NULL CHECK (department IN ('PL', 'PTFE', 'PI')),
            work_date date NOT NULL,
            mode text NOT NULL DEFAULT 'job' CHECK (mode IN ('job', 'event', 'jxj')),
            form_data jsonb NOT NULL DEFAULT '{}'::jsonb,
            has_unsaved_work boolean NOT NULL DEFAULT false,
            version integer NOT NULL DEFAULT 1 CHECK (version > 0),
            status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'submitted', 'discarded')),
            created_at timestamptz NOT NULL DEFAULT current_timestamp,
            updated_at timestamptz NOT NULL DEFAULT current_timestamp,
            closed_at timestamptz,
            close_reason text
        );
        CREATE UNIQUE INDEX workspaces_one_open_per_user_department
            ON workspaces (user_id, department)
            WHERE status = 'open';
        CREATE INDEX workspaces_department_updated_idx
            ON workspaces (department, updated_at DESC)
            WHERE status = 'open';
    `);
};

exports.down = (pgm) => {
    pgm.sql(`
        DROP TABLE workspaces;
        DROP TABLE kiosk_locks;
        DROP TABLE sessions;
        DROP TABLE users;
    `);
};
