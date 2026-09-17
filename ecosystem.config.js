const path = require('path');

const n8nBin = path.join(
    process.env.APPDATA || 'C:\\Users\\USER\\AppData\\Roaming',
    'npm',
    'node_modules',
    'n8n',
    'bin',
    'n8n'
);

module.exports = {
    apps: [
        {
            name: 'lms-n8n',
            script: n8nBin,
            args: 'start',
            cwd: 'C:\\lms-automation',
            watch: false,
            autorestart: true,
            max_restarts: 50,
            restart_delay: 3000,
            max_memory_restart: '1G',
            env: {
                NODES_EXCLUDE: '[]',
                N8N_PORT: 5678,
                GENERIC_TIMEZONE: 'Asia/Jakarta',
                N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS: 'false'
            },
            time: true
        }
    ]
};
