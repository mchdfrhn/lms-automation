const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const config = require('../../config');
const { getCourses } = require('../../config/data-loader');
const auth = require('../../core/auth');
const navigation = require('../../core/navigation');
const { sendTelegramMessage, formatPresensiReport } = require('../../core/reporter');
const { parseAttendanceTable } = require('./parser');

/**
 * Memproses presensi mahasiswa untuk 1 mata kuliah dan sesi tertentu
 * (Struktur dasar / scaffold - logika aksi spesifik siap diisi sesuai panduan user)
 */
async function markAttendanceForCourse(page, course, sessionNumber = 1, options = {}) {
    console.log(`\n-----------------------------------------------------------`);
    console.log(`[PRESENSI] ${course.nama} (${course.kode}) - Sesi ${sessionNumber}`);

    // 1. Cari dan buka mata kuliah Kelas Sore
    const openRes = await navigation.searchAndOpenCourse(page, course, { classType: 'Kelas Sore' });
    if (!openRes.success) {
        console.warn(`⚠️ [SKIP] ${openRes.reason}`);
        return { success: false, status: 'not_found', reason: openRes.reason };
    }

    // 2. Buka tab Pertemuan
    const hasPertemuan = await navigation.openCourseTab(page, 'Pertemuan');
    if (!hasPertemuan) {
        console.warn(`⚠️ Tab 'Pertemuan' tidak ditemukan.`);
        return { success: false, status: 'tab_not_found', reason: 'Tab Pertemuan tidak ditemukan' };
    }

    // 3. Masuk ke Sesi Pertemuan yang dituju
    const hasSession = await navigation.openSessionDetail(page, sessionNumber);
    if (!hasSession) {
        console.warn(`⚠️ Sesi ${sessionNumber} tidak ditemukan pada tab Pertemuan.`);
        return { success: false, status: 'session_not_found', reason: `Sesi ${sessionNumber} tidak ditemukan` };
    }

    // 4. Buka tab Kehadiran
    const hasKehadiran = await navigation.openCourseTab(page, 'Kehadiran');
    if (!hasKehadiran) {
        console.warn(`⚠️ Tab 'Kehadiran' tidak ditemukan.`);
        return { success: false, status: 'tab_not_found', reason: 'Tab Kehadiran tidak ditemukan' };
    }

    // 5. Baca data mahasiswa saat ini
    const studentsBefore = await parseAttendanceTable(page);
    console.log(`ℹ️ [INFO] Ditemukan ${studentsBefore.length} mahasiswa terdaftar.`);

    // 6. [PLACEHOLDER / HOOK LOGIKA DARI USER]
    // User akan menunjukkan langkah spesifiknya:
    // Misal: Klik 'Ubah kehadiran' -> Pilih 'Hadir Semua' atau centang per mahasiswa -> Klik 'Simpan'
    if (options.dryRun) {
        console.log(`[DRY RUN] Mode pratinjau aktif, tidak ada perubahan yang disimpan.`);
        return {
            success: true,
            status: 'preview',
            totalStudents: studentsBefore.length,
            hadirCount: studentsBefore.filter(s => s.kehadiran === 'Hadir').length,
            sessionTitle: `Pertemuan ${sessionNumber}`,
            statusText: 'Pratinjau (Dry Run)'
        };
    }

    // TODO: Pasang logika aksi spesifik presensi saat user memberikan instruksi
    console.log(`⏳ Menunggu konfigurasi aturan centang presensi dari instruksi lanjutan.`);

    return {
        success: true,
        status: 'ready',
        totalStudents: studentsBefore.length,
        hadirCount: studentsBefore.filter(s => s.kehadiran === 'Hadir').length,
        sessionTitle: `Pertemuan ${sessionNumber}`,
        statusText: 'Scaffold Siap'
    };
}

/**
 * Runner Utama Automasi Presensi
 */
async function runPresensiAutomation(options = {}) {
    const lmsUrl = config.lms.url;
    const username = config.lms.username;
    const password = config.lms.password;
    const isHeadless = options.headless !== undefined ? options.headless : config.lms.headless;

    const now = new Date();
    const todayName = config.HARI_MAP[now.getDay()];
    const targetDay = options.day || todayName;
    const sessionNumber = options.session || 1;

    const coursesPerSemester = getCourses();
    const targetSemesters = ['1', '3', '5', '7'];

    let targetCourses = [];
    for (const sem of targetSemesters) {
        const list = coursesPerSemester[sem] || [];
        const filtered = targetDay === 'Semua'
            ? list
            : list.filter(c => c.hari && c.hari.toLowerCase() === targetDay.toLowerCase());
        targetCourses = targetCourses.concat(filtered);
    }

    if (options.courseCode) {
        targetCourses = targetCourses.filter(c => c.kode.toLowerCase().includes(options.courseCode.toLowerCase()));
    }

    if (targetCourses.length === 0) {
        console.log(`ℹ️ Tidak ada mata kuliah yang cocok untuk presensi hari '${targetDay}'.`);
        return { success: true, results: [] };
    }

    console.log('===========================================================');
    console.log('      AUTOMASI PRESENSI MAHASISWA CIVITAS LMS              ');
    console.log('===========================================================');
    console.log(`Target Hari    : ${targetDay}`);
    console.log(`Sesi           : Pertemuan ${sessionNumber}`);
    console.log(`Target Matkul  : ${targetCourses.length} mata kuliah`);
    console.log(`Mode           : ${options.dryRun ? 'Dry Run (Pratinjau)' : 'Aktif'}`);
    console.log('===========================================================\n');

    const browser = await chromium.launch({ headless: isHeadless });
    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await context.newPage();
    const credentials = { url: lmsUrl, username, password };

    const results = [];

    try {
        await auth.login(page, credentials);

        for (const course of targetCourses) {
            await auth.ensureLoggedIn(page, credentials);
            const res = await markAttendanceForCourse(page, course, sessionNumber, options);
            results.push({
                kode: course.kode,
                nama: course.nama,
                ...res
            });

            if (options.limit && results.length >= options.limit) {
                break;
            }
        }

        const report = formatPresensiReport({
            targetDay,
            targetDate: new Date(),
            results
        });

        console.log('\n================== LAPORAN PRESENSI ==================');
        console.log(report);
        console.log('======================================================\n');

        if (!options.dryRun && options.notify) {
            await sendTelegramMessage(report);
        }

        return { success: true, results, report };

    } finally {
        await browser.close();
    }
}

module.exports = {
    markAttendanceForCourse,
    runPresensiAutomation
};
