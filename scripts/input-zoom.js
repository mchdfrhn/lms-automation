require('dotenv').config();
const path = require('path');
const fs = require('fs');
const config = require('../src/config');
const { getZoomSlots } = require('../src/config/data-loader');
const { parseMeetingOption } = require('../src/modules/zoom/parser');
const { addVidconForCourse, runZoomAutomation } = require('../src/modules/zoom/service');
const { runPresensiAutomation } = require('../src/modules/presensi/service');
const { sendTelegramMessage, formatUnifiedReport } = require('../src/core/reporter');

/**
 * =========================================================================
 * CLI ENTRYPOINT: PIPELINE HARIAN LMS CIVITAS
 * (1. INPUT LINK ZOOM -> 2. AKTIVASI PRESENSI MAHASISWA)
 * =========================================================================
 * Memastikan presensi mahasiswa HANYA diaktifkan untuk kelas yang link Zoom-nya
 * sudah terkonfirmasi terinput di LMS (baru dibuat atau sudah siap).
 *
 * Kompatibel 100% dengan cron harian n8n, Windows Task Scheduler, dan npm scripts.
 */

function isProcessAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    } catch (e) {
        return false;
    }
}

async function main() {
    // =========================================================================
    // PROTEKSI EKSEKUSI GANDA (SINGLE INSTANCE FILE LOCK)
    // =========================================================================
    const lockFile = path.join(config.DATA_DIR, 'execution.lock');
    if (fs.existsSync(lockFile)) {
        try {
            const lockData = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
            if (lockData.pid && isProcessAlive(lockData.pid)) {
                console.warn(`\n⚠️ [LOCK] Automasi sedang berjalan oleh proses lain (PID: ${lockData.pid}, sejak ${lockData.startedAt}).`);
                console.warn(`   Melewati eksekusi ini untuk mencegah duplikasi proses dan laporan Telegram.\n`);
                return;
            } else {
                console.log(`ℹ️ [LOCK] Menemukan lock usang (PID: ${lockData.pid} sudah berhenti). Memperbarui lock.`);
            }
        } catch (e) {}
    }

    try {
        fs.writeFileSync(lockFile, JSON.stringify({
            pid: process.pid,
            startedAt: new Date().toISOString()
        }), 'utf8');
    } catch (e) {}

    const cleanupLock = () => {
        try {
            if (fs.existsSync(lockFile)) {
                const cur = JSON.parse(fs.readFileSync(lockFile, 'utf8'));
                if (cur.pid === process.pid) fs.unlinkSync(lockFile);
            }
        } catch (e) {}
    };

    process.on('exit', cleanupLock);
    process.on('SIGINT', () => { cleanupLock(); process.exit(0); });
    process.on('SIGTERM', () => { cleanupLock(); process.exit(0); });

    try {
        await runPipeline();
    } finally {
        cleanupLock();
    }
}

async function runPipeline() {
    const isAllDays = process.argv.includes('--all') || process.argv.includes('-a');
    const dayArgIdx = process.argv.findIndex(a => a === '--day' || a === '-d');
    const dateArgIdx = process.argv.findIndex(a => a === '--date');
    const isForce = process.argv.includes('--force') || process.argv.includes('-f');
    const isTestMode = process.argv.includes('--test') || process.argv.includes('-t');
    const limitIdx = process.argv.findIndex(a => a === '--limit' || a === '-l');
    const skipPresensi = process.argv.includes('--skip-presensi');

    let day = null;
    let targetDate = null;

    if (dateArgIdx !== -1 && process.argv[dateArgIdx + 1]) {
        const dateStr = process.argv[dateArgIdx + 1];
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            targetDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        } else {
            targetDate = new Date(dateStr);
        }
        day = config.HARI_MAP[targetDate.getDay()];
    } else if (dayArgIdx !== -1 && process.argv[dayArgIdx + 1]) {
        day = process.argv[dayArgIdx + 1];
    } else if (isAllDays) {
        day = 'Semua';
    }

    const limitCount = limitIdx !== -1
        ? parseInt(process.argv[limitIdx + 1], 10)
        : (isTestMode ? 1 : Infinity);

    // =========================================================================
    // TAHAP 1: INPUT & VALIDASI LINK ZOOM / VIDCON
    // =========================================================================
    console.log('\n===========================================================');
    console.log('>>> TAHAP 1: INPUT & VERIFIKASI LINK VIDCON / ZOOM         ');
    console.log('===========================================================');

    // Jika skipPresensi, kirim notifikasi langsung dari Tahap 1.
    // Jika pipeline terpadu (default), tahan notifikasi (notify: false) untuk digabung di Tahap 3.
    const zoomResult = await runZoomAutomation({
        day,
        targetDate,
        isForce,
        limitCount,
        notify: skipPresensi
    });

    if (skipPresensi) {
        console.log('\nℹ️ [PRESENSI] Dilewati karena opsi --skip-presensi disertakan.');
        return;
    }

    if (!zoomResult || !zoomResult.courses || zoomResult.courses.length === 0) {
        console.log('\nℹ️ Tidak ada jadwal atau proses selesai (Libur/Weekend).');
        return;
    }

    // =========================================================================
    // TAHAP 2: AKTIVASI PRESENSI MAHASISWA (IKUT VIDCON)
    // Syarat Mutlak: Hanya kelas yang link Zoom-nya sudah terinput di LMS
    // (status 'created' atau 'already_exists')
    // =========================================================================
    const validZoomCourses = (zoomResult.courses || []).filter(c =>
        c.status === 'created' || c.status === 'already_exists'
    );

    let presensiResult = { results: [] };

    if (validZoomCourses.length === 0) {
        console.log('\nℹ️ [PRESENSI] Tidak ada mata kuliah dengan link Zoom aktif untuk jadwal ini. Melewati Tahap 2.');
    } else {
        console.log('\n===========================================================');
        console.log('>>> TAHAP 2: AKTIVASI PRESENSI MAHASISWA (IKUT VIDCON)      ');
        console.log(`    (Dijalankan untuk ${validZoomCourses.length} matkul yang Zoom-nya sudah terinput)`);
        console.log('===========================================================');

        presensiResult = await runPresensiAutomation({
            day,
            courses: validZoomCourses,
            dryRun: false,
            notify: false // Tahan notifikasi terpisah, akan digabungkan di Tahap 3
        });
    }

    // =========================================================================
    // TAHAP 3: LAPORAN HARIAN TERPADU TELEGRAM (1 PESAN GABUNGAN)
    // =========================================================================
    console.log('\n===========================================================');
    console.log('>>> TAHAP 3: MENGIRIM LAPORAN TERPADU KE TELEGRAM          ');
    console.log('===========================================================');

    const unifiedReport = formatUnifiedReport({
        targetDay: zoomResult.targetDay || day || config.HARI_MAP[new Date().getDay()],
        targetDate: zoomResult.targetDate || targetDate || new Date(),
        courses: zoomResult.courses || [],
        presensiResults: presensiResult.results || []
    });

    console.log('\n================== LAPORAN TERPADU ==================');
    console.log(unifiedReport);
    console.log('=====================================================\n');

    // Simpan salinan teks laporan terpadu ke file
    const unifiedReportFile = path.join(config.DATA_DIR, 'last_unified_report.txt');
    const waReportFile = path.join(config.DATA_DIR, 'last_report_wa.txt');
    try {
        fs.writeFileSync(unifiedReportFile, unifiedReport, 'utf8');
        fs.writeFileSync(waReportFile, unifiedReport, 'utf8');
    } catch (e) {}

    await sendTelegramMessage(unifiedReport);
}

if (require.main === module) {
    main().catch(err => {
        console.error('Fatal unhandled error:', err);
        process.exit(1);
    });
}

module.exports = {
    main,
    addVidconForCourse,
    getZoomSlots,
    parseMeetingOption,
    runZoomAutomation
};
