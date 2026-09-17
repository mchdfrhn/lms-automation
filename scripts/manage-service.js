/**
 * Service Manager for Windows Production Setup
 * Memulai, menghentikan, memeriksa status, dan mengatur autostart n8n di Windows.
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const dataDir = path.join(rootDir, 'data');
const pidFile = path.join(dataDir, 'daemon.pid');
const logFile = path.join(rootDir, 'logs', 'n8n.log');
const vbsLauncher = path.join(rootDir, 'scripts', 'run-n8n-hidden.vbs');

const startupFolder = path.join(
    process.env.APPDATA || 'C:\\Users\\USER\\AppData\\Roaming',
    'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup'
);
const startupVbs = path.join(startupFolder, 'Start-LMS-Civitas.vbs');
const taskName = 'LMS-Civitas-n8n-Daemon';

const command = process.argv[2] || 'status';

function isProcessAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    } catch (e) {
        return false;
    }
}

async function checkN8nHealth() {
    try {
        const res = await fetch('http://localhost:5678/healthz', { signal: AbortSignal.timeout(2500) });
        if (res.ok) {
            const json = await res.json();
            return { ok: true, status: json.status || 'running' };
        }
    } catch (e) {}
    return { ok: false };
}

async function handleStatus() {
    console.log('===========================================================');
    console.log('       STATUS LAYANAN PRODUKSI LMS CIVITAS (LOCAL)         ');
    console.log('===========================================================');

    let daemonRunning = false;
    let daemonPid = null;

    if (fs.existsSync(pidFile)) {
        daemonPid = parseInt(fs.readFileSync(pidFile, 'utf8').trim(), 10);
        if (daemonPid && isProcessAlive(daemonPid)) {
            daemonRunning = true;
        }
    }

    console.log(`• Watchdog Daemon : ${daemonRunning ? `🟢 BERJALAN (PID: ${daemonPid})` : '🔴 BERHENTI'}`);

    const health = await checkN8nHealth();
    console.log(`• Server n8n Web  : ${health.ok ? '🟢 ONLINE (http://localhost:5678)' : '🔴 OFFLINE'}`);

    // Cek Autostart
    const hasStartupFile = fs.existsSync(startupVbs);
    console.log(`• Windows Autostart: ${hasStartupFile ? '🟢 AKTIF (Startup Folder)' : '🟡 BELUM AKTIF'}`);

    // Cek Task Scheduler
    let hasTask = false;
    try {
        const taskQuery = execSync(`schtasks /Query /TN "${taskName}" 2>&1`, { encoding: 'utf8' });
        if (taskQuery.includes(taskName)) hasTask = true;
    } catch (e) {}
    console.log(`• Task Scheduler  : ${hasTask ? '🟢 TERDAFTAR (OnLogon)' : '⚪ TIDAK TERDAFTAR'}`);

    console.log('===========================================================');
    if (!daemonRunning || !health.ok) {
        console.log('👉 Untuk menjalankan layanan di latar belakang:');
        console.log('   npm run service:start\n');
    }
}

function handleStart() {
    if (fs.existsSync(pidFile)) {
        const oldPid = parseInt(fs.readFileSync(pidFile, 'utf8').trim(), 10);
        if (oldPid && isProcessAlive(oldPid)) {
            console.log(`ℹ️ Layanan watchdog sudah berjalan pada PID ${oldPid}.`);
            return;
        }
    }

    console.log('🚀 Memulai layanan n8n di latar belakang (tanpa jendela popup)...');
    try {
        const daemonScript = path.join(rootDir, 'scripts', 'n8n-daemon.js');
        const child = spawn(process.execPath, [daemonScript], {
            cwd: rootDir,
            detached: true,
            stdio: 'ignore'
        });
        child.unref();

        console.log(`✅ Perintah peluncuran berhasil dieksekusi (PID: ${child.pid}).`);
        console.log('⏳ Menunggu n8n inisialisasi (sekitar 5-10 detik)...');
        console.log('👉 Periksa status dengan: npm run service:status');
    } catch (err) {
        console.error(`❌ Gagal meluncurkan layanan: ${err.message}`);
    }
}

function handleStop() {
    console.log('🛑 Menghentikan layanan n8n...');
    let stopped = false;

    if (fs.existsSync(pidFile)) {
        const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim(), 10);
        if (pid) {
            try {
                // Kill process tree di Windows
                execSync(`taskkill /F /T /PID ${pid} 2>&1`);
                console.log(`✅ Watchdog Daemon (PID ${pid}) berhasil dihentikan.`);
                stopped = true;
            } catch (e) {}
        }
        try { fs.unlinkSync(pidFile); } catch (e) {}
    }

    // Pastikan proses node yang mendengarkan port 5678 juga dihentikan
    try {
        const netstat = execSync('netstat -ano | findstr :5678', { encoding: 'utf8' });
        const lines = netstat.trim().split('\n');
        for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            const portPid = parts[parts.length - 1];
            if (portPid && portPid !== '0') {
                try {
                    execSync(`taskkill /F /PID ${portPid} 2>&1`);
                    console.log(`✅ Proses n8n pada port 5678 (PID ${portPid}) dihentikan.`);
                    stopped = true;
                } catch (e) {}
            }
        }
    } catch (e) {}

    if (!stopped) {
        console.log('ℹ️ Tidak ada proses n8n yang sedang berjalan.');
    }
}

function handleLogs() {
    if (!fs.existsSync(logFile)) {
        console.log('ℹ️ Belum ada file log di: logs/n8n.log');
        return;
    }
    const content = fs.readFileSync(logFile, 'utf8');
    const lines = content.trim().split('\n');
    const recent = lines.slice(-40).join('\n');
    console.log('================== LOG TERAKHIR (n8n.log) ==================');
    console.log(recent);
    console.log('===========================================================');
}

function handleEnableAutostart() {
    console.log('⚙️ Mengonfigurasi Autostart Windows (2 Lapisan Proteksi)...');

    // 1. Lapisan 1: Windows Startup Folder
    try {
        const daemonBat = path.join(rootDir, 'scripts', 'run-daemon.bat');
        fs.writeFileSync(startupVbs, `Set WshShell = CreateObject("WScript.Shell")\nWshShell.Run """${daemonBat}""", 0, False\n`, 'utf8');
        console.log(`✅ [LAPISAN 1] Berhasil menambahkan launcher ke Startup Folder:`);
        console.log(`   ${startupVbs}`);
    } catch (err) {
        console.warn(`⚠️ Gagal menulis ke Startup Folder: ${err.message}`);
    }

    // 2. Lapisan 2: Windows Task Scheduler (On Logon)
    try {
        const cmd = `schtasks /Create /TN "${taskName}" /TR "wscript.exe \\"${vbsLauncher}\\"" /SC ONLOGON /F`;
        execSync(cmd, { stdio: 'pipe' });
        console.log(`✅ [LAPISAN 2] Berhasil mendaftarkan Task Scheduler: '${taskName}'`);
    } catch (err) {
        console.log(`ℹ️ [LAPISAN 2] Task Scheduler info: ${err.message}`);
    }

    console.log('\n✨ Autostart selesai dikonfigurasi!');
    console.log('Setiap kali komputer menyala atau restart, n8n akan otomatis berjalan di latar belakang.');
}

function handleDisableAutostart() {
    console.log('🗑️ Menghapus Autostart Windows...');
    try {
        if (fs.existsSync(startupVbs)) {
            fs.unlinkSync(startupVbs);
            console.log('✅ Shortcut Startup Folder berhasil dihapus.');
        }
    } catch (e) {}

    try {
        execSync(`schtasks /Delete /TN "${taskName}" /F 2>&1`);
        console.log('✅ Task Scheduler berhasil dihapus.');
    } catch (e) {}

    console.log('✨ Autostart dinonaktifkan.');
}

async function main() {
    switch (command.toLowerCase()) {
        case 'start':
            handleStart();
            break;
        case 'stop':
            handleStop();
            break;
        case 'restart':
            handleStop();
            setTimeout(handleStart, 2000);
            break;
        case 'logs':
            handleLogs();
            break;
        case 'autostart-enable':
        case 'enable-autostart':
            handleEnableAutostart();
            break;
        case 'autostart-disable':
        case 'disable-autostart':
            handleDisableAutostart();
            break;
        case 'status':
        default:
            await handleStatus();
            break;
    }
}

main();
