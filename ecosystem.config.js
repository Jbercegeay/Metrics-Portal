module.exports = {
    apps: [
        {
            name: 'metrics-portal',
            script: './server.js',
            cwd: __dirname,
            instances: 1,
            exec_mode: 'fork',
            autorestart: true,
            max_restarts: 10,
            restart_delay: 2000,
            kill_timeout: 10000,
            time: true
        },
        {
            name: 'metrics-portal-worker',
            script: './workers/smartsheet-worker.js',
            cwd: __dirname,
            instances: 1,
            exec_mode: 'fork',
            autorestart: true,
            max_restarts: 10,
            restart_delay: 5000,
            kill_timeout: 10000,
            time: true
        }
    ]
};
