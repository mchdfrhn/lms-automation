require('dotenv').config();
const config = require('../src/config');
const { getZoomSlots } = require('../src/config/data-loader');
const { parseMeetingOption } = require('../src/modules/zoom/parser');
const { addVidconForCourse, runZoomAutomation } = require('../src/modules/zoom/service');
const { runPresensiAutomation } = require('../src/modules/presensi/service');

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

async function main() {
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

    const zoomResult = await runZoomAutomation({
        day,
        targetDate,
        isForce,
        limitCount
    });

    if (skipPresensi) {
        console.log('\nℹ️ [PRESENSI] Dilewati karena opsi --skip-presensi disertakan.');
        return;
    }

    // =========================================================================
    // TAHAP 2: AKTIVASI PRESENSI MAHASISWA (IKUT VIDCON)
    // Syarat Mutlak: Hanya kelas yang link Zoom-nya sudah terinput di LMS
    // (status 'created' atau 'already_exists')
    // =========================================================================
    const validZoomCourses = (zoomResult?.courses || []).filter(c =>
        c.status === 'created' || c.status === 'already_exists'
    );

    if (validZoomCourses.length === 0) {
        console.log('\nℹ️ [PRESENSI] Tidak ada mata kuliah dengan link Zoom aktif untuk jadwal ini. Selesai.');
        return;
    }

    console.log('\n===========================================================');
    console.log('>>> TAHAP 2: AKTIVASI PRESENSI MAHASISWA (IKUT VIDCON)      ');
    console.log(`    (Dijalankan untuk ${validZoomCourses.length} matkul yang Zoom-nya sudah terinput)`);
    console.log('===========================================================');

    await runPresensiAutomation({
        day,
        courses: validZoomCourses,
        dryRun: false,
        notify: true
    });
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
