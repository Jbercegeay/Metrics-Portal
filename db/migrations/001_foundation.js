exports.up = (pgm) => {
    pgm.createTable('app_metadata', {
        key: { type: 'text', primaryKey: true },
        value: { type: 'jsonb', notNull: true, default: '{}' },
        updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') }
    });

    pgm.sql(`
        INSERT INTO app_metadata (key, value)
        VALUES ('schema_foundation', '{"version": 1}'::jsonb)
    `);
};

exports.down = (pgm) => {
    pgm.dropTable('app_metadata');
};
