/**
 * n8n Watchdog Daemon (Production Service for Windows)
 * Menjaga proses server n8n tetap hidup 24/7, auto-restart otomatis jika crash,
 * dan mencatat aktivitas ke file logs/n8n.log.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const config = require('../config');

const rootDir = config.ROOT_DIR;
const logsDir = config.LOGS_DIR;
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

const logFile = path.join(logsDir, 'n8n.log');
const pidFile = path.join(config.DATA_DIR, 'daemon.pid');

function writeLog(msg) {
    const time = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    const line = `[${time}] [WATCHDOG] ${msg}\n`;
    try {
        fs.appendFileSync(logFile, line, 'utf8');
        process.stdout.write(line);
    } catch (e) {}
}

// Cek apakah daemon sudah berjalan sebelumnya
if (fs.existsSync(pidFile)) {
    try {
        const oldPid = parseInt(fs.readFileSync(pidFile, 'utf8').trim(), 10);
        if (oldPid && !isNaN(oldPid)) {
            try {
                process.kill(oldPid, 0);
                writeLog(`Daemon sudah berjalan pada PID ${oldPid}. Keluar.`);
                process.exit(0);
            } catch (e) {
                // Proses lama sudah mati, lanjutkan
            }
        }
    } catch (e) {}
}

// Simpan PID daemon saat ini
try {
    fs.writeFileSync(pidFile, String(process.pid), 'utf8');
} catch (e) {}

writeLog('===========================================================');
writeLog(`MEMULAI WATCHDOG DAEMON (PID: ${process.pid})`);
writeLog('===========================================================');

const n8nBin = path.join(
    process.env.APPDATA || 'C:\\Users\\USER\\AppData\\Roaming',
    'npm',
    'node_modules',
    'n8n',
    'bin',
    'n8n'
);

let isShuttingDown = false;
let currentChild = null;

function cleanup() {
    isShuttingDown = true;
    writeLog('Menerima sinyal berhenti, menghentikan n8n...');
    try {
        if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile);
    } catch (e) {}
    if (currentChild) {
        try {
            currentChild.kill('SIGTERM');
        } catch (e) {}
    }
    process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', () => {
    try {
        if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile);
    } catch (e) {}
});

function launchN8n() {
    if (isShuttingDown) return;

    writeLog('Meluncurkan server n8n...');

    const env = Object.assign({}, process.env, {
        NODES_EXCLUDE: '[]',
        N8N_PORT: '5678',
        GENERIC_TIMEZONE: 'Asia/Jakarta',
        N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS: 'false'
    });

    const child = spawn(process.execPath, [n8nBin, 'start'], {
        cwd: rootDir,
        env,
        stdio: ['ignore', 'pipe', 'pipe']
    });

    currentChild = child;
    writeLog(`Server n8n berjalan pada PID: ${child.pid}`);

    child.stdout.on('data', (chunk) => {
        try {
            fs.appendFileSync(logFile, chunk);
        } catch (e) {}
    });

    child.stderr.on('data', (chunk) => {
        try {
            fs.appendFileSync(logFile, chunk);
        } catch (e) {}
    });

    child.on('error', (err) => {
        writeLog(`Error pada server n8n: ${err.message}`);
    });

    child.on('exit', (code, signal) => {
        currentChild = null;
        if (isShuttingDown) return;

        writeLog(`Server n8n terhenti (exit code: ${code}, signal: ${signal}).`);
        writeLog('Memulai ulang n8n otomatis dalam 3 detik...');
        setTimeout(launchN8n, 3000);
    });
}

launchN8n();
