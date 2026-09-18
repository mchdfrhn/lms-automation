const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const config = require('../../config');
const { getCourses } = require('../../config/data-loader');
const auth = require('../../core/auth');
const { sendTelegramMessage } = require('../../core/reporter');

/**
 * Ekstraksi daftar kata kunci pencarian dari nama dosen (membersihkan gelar akademik)
 */
function getLecturerSearchKeywords(fullName) {
    if (!fullName) return [];
    const cleaned = fullName
        .replace(/(Dra\.|Drs\.|Dr\.|Ir\.|Prof\.|M\.T\.|M\.Sc\.|S\.T\.|M\.M\.|M\.Pd\.|M\.Kom\.|S\.Kom\.|S\.Si\.|M\.Si\.)/gi, ' ')
        .replace(/[,\.]/g, ' ')
        .trim();
    const words = cleaned.split(/\s+/).filter(w => w.length >= 3);
    const keywords = [];
    // Prioritaskan nama belakang/unik lalu nama depan
    if (words.length > 1 && words[words.length - 1] !== words[0]) {
        keywords.push(words[words.length - 1]);
    }
    if (words.length > 0) keywords.push(words[0]);
    return keywords;
}

/**
 * Format Laporan Eksekusi Presensi Mahasiswa untuk Telegram
 */
function formatPresensiReport({ targetDay, targetDate, results }) {
    const dateObj = targetDate || new Date();
    const tglStr = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const now = new Date();
    const jamStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';

    const checkedList = results.filter(r => r.status === 'checked');
    const alreadyList = results.filter(r => r.status === 'already_checked');
    const previewList = results.filter(r => r.status === 'preview');
    const failedList = results.filter(r => !['checked', 'already_checked', 'preview'].includes(r.status));

    let headerStatus = '✅ *STATUS: SEMUA PRESENSI VIDCON TERPASANG*';
    if (previewList.length > 0 && failedList.length === 0) {
        headerStatus = '🔍 *STATUS: PRATINJAU (DRY RUN) SELESAI*';
    } else if (failedList.length > 0) {
        headerStatus = `⚠️ *STATUS: ${failedList.length} KELAS MEMERLUKAN PERHATIAN*`;
    }

    let report = `📋 *LAPORAN AUTOMASI PRESENSI LMS CIVITAS*\n`;
    report += `🗓️ *Jadwal :* ${targetDay}, ${tglStr}\n`;
    report += `⏰ *Waktu  :* ${jamStr}\n`;
    report += `🎓 *Target :* Aktivasi Presensi Vidcon (Kelas Sore)\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    report += `${headerStatus}\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    results.forEach((item, idx) => {
        let badge = '✅ *Baru Dicentang*';
        if (item.status === 'already_checked') {
            badge = '🔹 *Sudah Aktif (Aman)*';
        } else if (item.status === 'checked') {
            badge = '✅ *Baru Diaktifkan*';
        } else if (item.status === 'preview') {
            badge = '🔍 *Pratinjau (Siap Dicentang)*';
        } else {
            badge = `❌ *Gagal:* ${item.reason || 'Error'}`;
        }

        report += `${idx + 1}. *${item.nama}* (\`${item.kode}\`)\n`;
        report += `   • Dosen  : ${item.pengajar || '-'}\n`;
        report += `   • Sesi   : ${item.sessionTitle || 'Pertemuan 1'}\n`;
        report += `   • Status : ${badge}\n\n`;
    });

    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    report += `📊 *RINGKASAN EKSEKUSI PRESENSI:*\n`;
    report += `• Total Target   : ${results.length} mata kuliah\n`;
    if (checkedList.length > 0) report += `• Baru Diaktifkan: ${checkedList.length}\n`;
    if (alreadyList.length > 0) report += `• Sudah Aktif    : ${alreadyList.length}\n`;
    if (previewList.length > 0) report += `• Pratinjau (Dry): ${previewList.length}\n`;
    if (failedList.length > 0) report += `• Gagal/Perhatian: ${failedList.length}\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    report += `_Automasi Presensi Civitas LMS Operator_`;

    return report;
}

/**
 * Impersonasi Dosen & Centang 'Mengikuti Vidcon' untuk mata kuliah yang diajar
 */
async function processLecturerCourses(operatorPage, pengajarName, courses, options = {}) {
    const results = [];
    const keywords = getLecturerSearchKeywords(pengajarName);
    const sessionNumber = options.session || 1;
    const isDryRun = !!options.dryRun;

    console.log(`\n===========================================================`);
    console.log(`>>> IMPERSONASI DOSEN: ${pengajarName}`);
    console.log(`===========================================================`);

    // 1. Klik menu profil operator
    const profileBtn = operatorPage.locator('button.pointer-block, button').filter({ hasText: /Operator/i }).first();
    await profileBtn.click();
    await operatorPage.waitForTimeout(600);

    // 2. Klik "Login Akun Lain"
    const loginLain = operatorPage.getByRole('menuitem', { name: /Login Akun Lain/i }).first();
    await loginLain.click();
    await operatorPage.waitForTimeout(1000);

    // 3. Pilih role Dosen
    const roleSelect = operatorPage.getByRole('combobox').first();
    await roleSelect.selectOption('dosen');
    await operatorPage.waitForTimeout(600);

    // 4. Cari nama dosen dengan fallback multi-kata kunci
    const searchInput = operatorPage.getByRole('textbox', { name: /Masukkan Nama/i })
        .or(operatorPage.getByPlaceholder(/Masukkan Nama/i)).first();

    let dosenBtn = null;

    for (const kw of keywords) {
        console.log(`[SEARCH] Mencari dosen dengan keyword: "${kw}"...`);
        await searchInput.click();
        await searchInput.fill('');
        await searchInput.fill(kw);
        await operatorPage.waitForTimeout(2000);

        // Cari tombol item dosen di dropdown
        const candidate = operatorPage.locator('[role="button"]').filter({ hasText: '-' })
            .filter({ hasText: new RegExp(kw, 'i') }).first();

        if (await candidate.isVisible({ timeout: 4000 }).catch(() => false)) {
            dosenBtn = candidate;
            break;
        }
    }

    if (!dosenBtn || !await dosenBtn.isVisible().catch(() => false)) {
        console.warn(`⚠️ [SKIP] Dosen "${pengajarName}" tidak ditemukan pada daftar impersonasi.`);
        for (const c of courses) {
            results.push({
                ...c,
                sessionTitle: `Pertemuan ${sessionNumber}`,
                status: 'lecturer_not_found',
                reason: `Dosen "${pengajarName}" tidak ditemukan di pencarian akun`
            });
        }
        await operatorPage.goto('https://sttpu.operator.lms.civitas.id/beranda', { waitUntil: 'domcontentloaded' });
        await operatorPage.waitForTimeout(1000);
        return results;
    }

    console.log(`[MATCH] Memilih akun dosen: ${await dosenBtn.innerText()}`);
    await dosenBtn.click();
    await operatorPage.waitForTimeout(1000);

    // 6. Klik Login (Buka Popup Portal Dosen)
    console.log(`[AUTH] Membuka portal dosen untuk ${pengajarName}...`);
    const popupPromise = operatorPage.waitForEvent('popup');
    const submitLogin = operatorPage.getByRole('link', { name: 'Login' })
        .or(operatorPage.locator('a.button:has-text("Login"), button:has-text("Login")')).first();
    await submitLogin.click();

    const dosenPage = await popupPromise;
    await dosenPage.waitForURL(url => url.hostname.includes('dosen.lms.civitas.id'), { timeout: 20000 }).catch(() => {});
    await dosenPage.waitForLoadState('domcontentloaded');
    await dosenPage.waitForTimeout(3000);

    console.log(`[AUTH] Masuk ke portal dosen: ${dosenPage.url()}`);

    // 7. Proses masing-masing mata kuliah dosen ini
    for (const course of courses) {
        console.log(`\n-----------------------------------------------------------`);
        console.log(`[MATKUL] ${course.nama} (${course.kode})`);
        const itemResult = {
            kode: course.kode,
            nama: course.nama,
            pengajar: pengajarName,
            sessionTitle: `Pertemuan ${sessionNumber}`,
            status: 'failed',
            reason: ''
        };

        try {
            // Cari kartu mata kuliah di Beranda (Highlight)
            let courseLink = dosenPage.locator('a').filter({ hasText: course.kode }).first();

            if (!await courseLink.isVisible({ timeout: 4000 }).catch(() => false)) {
                console.log(`ℹ️ Belum terlihat di Highlight Beranda. Memeriksa menu 'Kelas' dosen...`);
                const kelasMenu = dosenPage.getByRole('link', { name: 'Kelas' }).first();
                if (await kelasMenu.isVisible().catch(() => false)) {
                    await kelasMenu.click();
                    await dosenPage.waitForTimeout(2000);
                    courseLink = dosenPage.locator('a, tr').filter({ hasText: course.kode }).first();
                }
            }

            if (!await courseLink.isVisible({ timeout: 5000 }).catch(() => false)) {
                console.warn(`⚠️ Mata kuliah ${course.nama} (${course.kode}) tidak ditemukan di portal dosen.`);
                itemResult.status = 'course_not_found';
                itemResult.reason = 'Mata kuliah tidak ditemukan di portal dosen';
                results.push(itemResult);
                continue;
            }

            await courseLink.click();
            await dosenPage.waitForLoadState('domcontentloaded');
            await dosenPage.waitForTimeout(2500);

            // Klik sesi pertemuan target (mengikuti nomor sesi Zoom yang terdaftar jika ada)
            let sessionTitle = `Pertemuan ${sessionNumber}`;
            if (course.meetingTitle && course.meetingTitle !== '-') {
                const matchNum = course.meetingTitle.match(/\d+/);
                if (matchNum) {
                    sessionTitle = `Pertemuan ${matchNum[0]}`;
                }
            }
            itemResult.sessionTitle = sessionTitle;

            const sessionBtn = dosenPage.getByText(sessionTitle, { exact: false }).first();
            if (!await sessionBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
                console.warn(`⚠️ Sesi "${sessionTitle}" tidak ditemukan.`);
                itemResult.status = 'session_not_found';
                itemResult.reason = `Sesi ${sessionTitle} tidak ditemukan`;
                results.push(itemResult);
                continue;
            }

            await sessionBtn.click();
            await dosenPage.waitForTimeout(2000);

            // Temukan label dan input checkbox 'Mengikuti Vidcon'
            const label = dosenPage.locator('label').filter({ hasText: /Mengikuti Vidcon/i }).first();
            const inputCheckbox = label.locator('input[type="checkbox"]').first();
            const checkSpan = label.locator('.check').first();

            if (!await label.isVisible({ timeout: 5000 }).catch(() => false)) {
                console.warn(`⚠️ Checkbox 'Mengikuti Vidcon' tidak ditemukan pada sesi ini.`);
                itemResult.status = 'checkbox_not_found';
                itemResult.reason = 'Checkbox Mengikuti Vidcon tidak terlihat';
                results.push(itemResult);
                continue;
            }

            const isAlreadyChecked = await inputCheckbox.isChecked().catch(() => false);
            if (isAlreadyChecked) {
                console.log(`ℹ️ [SUDAH AKTIF] Presensi 'Mengikuti Vidcon' untuk ${course.nama} sudah tercentang.`);
                itemResult.status = 'already_checked';
                results.push(itemResult);
                continue;
            }

            if (isDryRun) {
                console.log(`🔍 [DRY RUN] Simulasi: Checkbox 'Mengikuti Vidcon' siap dicentang.`);
                itemResult.status = 'preview';
                results.push(itemResult);
                continue;
            }

            // Lakukan klik untuk mencentang (hanya jika belum tercentang)
            console.log(`🎯 [CENTANG] Mengaktifkan 'Mengikuti Vidcon' untuk ${course.nama}...`);
            if (await checkSpan.isVisible().catch(() => false)) {
                await checkSpan.click();
            } else {
                await label.click();
            }
            await dosenPage.waitForTimeout(2000);

            // Verifikasi state tercentang
            const verifiedChecked = await inputCheckbox.isChecked().catch(() => false);
            if (verifiedChecked) {
                console.log(`✅ [BERHASIL] 'Mengikuti Vidcon' berhasil diaktifkan dan terverifikasi!`);
                itemResult.status = 'checked';
            } else {
                console.warn(`⚠️ Checkbox belum tercentang setelah diklik, mencoba ulang dengan force check...`);
                await inputCheckbox.check({ force: true }).catch(() => {});
                await dosenPage.waitForTimeout(1500);
                itemResult.status = await inputCheckbox.isChecked() ? 'checked' : 'failed';
            }

            results.push(itemResult);

        } catch (err) {
            console.error(`❌ Error pada ${course.nama}: ${err.message}`);
            itemResult.status = 'error';
            itemResult.reason = err.message;
            results.push(itemResult);
        }
    }

    // 8. Tutup halaman portal dosen & reset halaman operator ke beranda bersih
    await dosenPage.close();
    await operatorPage.goto('https://sttpu.operator.lms.civitas.id/beranda', { waitUntil: 'domcontentloaded' });
    await operatorPage.waitForTimeout(1500);

    return results;
}

/**
 * Runner Utama Automasi Presensi Mahasiswa
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

    // Proteksi akhir pekan
    if (!options.day && (targetDay === 'Sabtu' || targetDay === 'Minggu')) {
        console.log('===========================================================');
        console.log('      AUTOMASI PRESENSI MAHASISWA CIVITAS LMS              ');
        console.log('===========================================================');
        console.log(`Hari Ini    : ${targetDay}`);
        console.log(`Status      : Libur Akhir Pekan (Tidak ada jadwal perkuliahan)`);
        console.log('===========================================================\n');
        return { success: true, reason: 'weekend' };
    }

    const coursesPerSemester = getCourses();
    const targetSemesters = ['1', '3', '5', '7'];

    let scheduledCourses = [];
    if (options.courses && Array.isArray(options.courses)) {
        // Gunakan daftar matkul yang sudah divalidasi (misal: link Zoom-nya sudah terkonfirmasi ada)
        scheduledCourses = options.courses;
    } else {
        for (const sem of targetSemesters) {
            const list = coursesPerSemester[sem] || [];
            const filtered = targetDay === 'Semua'
                ? list
                : list.filter(c => c.hari && c.hari.toLowerCase() === targetDay.toLowerCase());
            scheduledCourses = scheduledCourses.concat(filtered);
        }
    }

    if (options.courseCode) {
        scheduledCourses = scheduledCourses.filter(c =>
            c.kode.toLowerCase().includes(options.courseCode.toLowerCase()) ||
            c.nama.toLowerCase().includes(options.courseCode.toLowerCase())
        );
    }

    if (scheduledCourses.length === 0) {
        console.log(`ℹ️ Tidak ada mata kuliah dengan jadwal hari '${targetDay}'. Selesai.`);
        return { success: true, results: [] };
    }

    if (options.limit && options.limit > 0) {
        scheduledCourses = scheduledCourses.slice(0, options.limit);
    }

    // Kelompokkan mata kuliah berdasarkan Dosen Pengajar
    const lecturerMap = new Map();
    for (const c of scheduledCourses) {
        const dosen = (c.pengajar || c.dosen || '').trim();
        if (!dosen || dosen === '-') {
            console.warn(`⚠️ [SKIP] Dosen belum ditentukan untuk ${c.nama} (${c.kode})`);
            continue;
        }
        if (!lecturerMap.has(dosen)) {
            lecturerMap.set(dosen, []);
        }
        lecturerMap.get(dosen).push({
            ...c,
            pengajar: dosen
        });
    }

    console.log('===========================================================');
    console.log('      AUTOMASI PRESENSI MAHASISWA CIVITAS LMS              ');
    console.log('===========================================================');
    console.log(`Target Hari    : ${targetDay}`);
    console.log(`Sesi Target    : Pertemuan ${sessionNumber}`);
    console.log(`Target Matkul  : ${scheduledCourses.length} mata kuliah`);
    console.log(`Total Dosen    : ${lecturerMap.size} dosen pengajar`);
    console.log(`Mode           : ${options.dryRun ? '🔍 Dry Run (Pratinjau)' : '⚡ Eksekusi Langsung'}`);
    console.log('===========================================================\n');

    const browser = await chromium.launch({
        headless: isHeadless,
        slowMo: 60
    });

    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await context.newPage();
    const credentials = { url: lmsUrl, username, password };

    const allResults = [];

    try {
        console.log('[AUTH] Melakukan login operator ke Civitas LMS...');
        await auth.login(page, credentials);

        for (const [pengajarName, courses] of lecturerMap.entries()) {
            await auth.ensureLoggedIn(page, credentials);

            const lecturerResults = await processLecturerCourses(page, pengajarName, courses, {
                session: sessionNumber,
                dryRun: options.dryRun
            });

            allResults.push(...lecturerResults);
        }

        const report = formatPresensiReport({
            targetDay,
            targetDate: new Date(),
            results: allResults
        });

        console.log('\n================== LAPORAN PRESENSI ==================');
        console.log(report);
        console.log('======================================================\n');

        const reportFile = path.join(config.DATA_DIR, 'last_presensi_report.txt');
        try {
            fs.writeFileSync(reportFile, report, 'utf8');
        } catch (e) {}

        if (options.notify !== false && (!options.dryRun || options.notify)) {
            await sendTelegramMessage(report);
        }

        return {
            success: true,
            targetDay,
            targetDate: new Date(),
            results: allResults,
            report
        };

    } finally {
        await browser.close();
    }
}

module.exports = {
    runPresensiAutomation,
    processLecturerCourses,
    getLecturerSearchKeywords,
    formatPresensiReport
};
