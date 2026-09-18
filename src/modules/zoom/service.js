const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const config = require('../../config');
const { getZoomSlots, getCourses } = require('../../config/data-loader');
const auth = require('../../core/auth');
const navigation = require('../../core/navigation');
const { sendTelegramMessage, formatZoomReport } = require('../../core/reporter');
const { parseMeetingOption } = require('./parser');

/**
 * Menambahkan Vidcon untuk 1 Mata Kuliah dengan Deteksi Sesi Otomatis
 */
async function addVidconForCourse(page, course, zoomUrl, options = {}) {
    const isForce = !!options.isForce;

    console.log(`\n-----------------------------------------------------------`);
    console.log(`[MATKUL] ${course.nama} (${course.kode})`);
    console.log(`[DOSEN]  ${course.pengajar || '-'}`);
    console.log(`[HARI]   ${course.hari || '-'} | Jam: ${course.jam_mulai_h || ''}:${course.jam_mulai_m || ''}`);
    console.log(`[ZOOM]   Slot ${String(course.kode_slot).toUpperCase()} -> ${zoomUrl}`);

    // 1. Ke Menu Kelas & Cari baris mata kuliah
    const openRes = await navigation.searchAndOpenCourse(page, course, { classType: 'Kelas Sore' });
    if (!openRes.success) {
        console.warn(`⚠️ [SKIP] ${openRes.reason}`);
        return { success: false, status: 'not_found', reason: openRes.reason };
    }

    // 2. Masuk ke Tab Vidcon
    const hasVidconTab = await navigation.openCourseTab(page, 'Vidcon');
    if (!hasVidconTab) {
        console.warn(`⚠️ Tab 'Vidcon' tidak ditemukan.`);
        return { success: false, status: 'tab_not_found', reason: 'Tab Vidcon tidak ditemukan' };
    }

    // 3. Cek Pertemuan apa saja yang SUDAH dibuat sebelumnya di tab Vidcon
    const vidconContainer = page.locator('.tab-content, .b-tabs').first();
    const vidconText = await vidconContainer.innerText().catch(() => '');
    const existingMeetingNums = new Set();
    const matches = vidconText.matchAll(/Kuliah\s*(\d+)/gi);
    for (const m of matches) {
        existingMeetingNums.add(parseInt(m[1], 10));
    }

    if (existingMeetingNums.size > 0) {
        console.log(`ℹ️ [STATUS] Pertemuan yang sudah terdaftar: Kuliah ${Array.from(existingMeetingNums).sort((a,b)=>a-b).join(', Kuliah ')}`);
    }

    // 4. Klik tombol "Tambah Vidcon"
    const tambahVidconBtn = page.getByRole('button', { name: /Tambah Vidcon/i }).first();
    if (!await tambahVidconBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        console.warn(`⚠️ Tombol 'Tambah Vidcon' tidak ditemukan.`);
        return { success: false, status: 'button_hidden', reason: 'Tombol Tambah Vidcon tidak terlihat' };
    }
    await tambahVidconBtn.click();
    await page.waitForTimeout(1500);

    // 5. Baca Opsi Pertemuan di Modal Dialog
    const modal = page.locator('.modal, .modal-card, .animation-content').first();
    const pertemuanSelect = modal.locator('select').first();

    const optionElements = await pertemuanSelect.locator('option').all();
    const availableMeetings = [];
    for (let i = 0; i < optionElements.length; i++) {
        const txt = await optionElements[i].innerText();
        const val = await optionElements[i].getAttribute('value');
        const parsed = parseMeetingOption(txt);
        if (parsed) {
            availableMeetings.push({ index: i, value: val, ...parsed });
        }
    }

    if (availableMeetings.length === 0) {
        console.warn(`⚠️ Tidak ditemukan jadwal pertemuan aktif di dropdown.`);
        const cancelBtn = modal.locator('button:has-text("Batal"), .delete').first();
        if (await cancelBtn.isVisible().catch(() => false)) await cancelBtn.click();
        return { success: false, status: 'empty_dropdown', reason: 'Jadwal pertemuan tidak ada di LMS (Praktikum / Non-teori)' };
    }

    // 6. Cek apakah pertemuan untuk jadwal target tanggal hari ini sudah terdaftar
    const targetDate = options.targetDate || new Date();
    const targetDayNum = targetDate.getDate();
    const targetMonthIndex = targetDate.getMonth();
    const targetYearNum = targetDate.getFullYear();
    const targetDateFormatted = `${targetDayNum} ${config.MONTH_NAMES[targetMonthIndex]} ${targetYearNum}`;

    const matchingMeetings = availableMeetings.filter(m =>
        m.day === targetDayNum &&
        m.monthIndex === targetMonthIndex &&
        m.year === targetYearNum
    );

    let nextMeeting = null;

    if (matchingMeetings.length > 0 && !isForce) {
        const uncreatedSession = matchingMeetings.find(m => !existingMeetingNums.has(m.meetingNumber));

        if (!uncreatedSession) {
            const titles = matchingMeetings.map(m => `Kuliah ${m.meetingNumber}`).join(', ');
            console.log(`ℹ️ [SUDAH TERSEDIA] Vidcon tanggal ${targetDateFormatted} (${titles}) sudah terdaftar di LMS. Melewati.`);
            const cancelBtn = modal.locator('button:has-text("Batal"), .delete').first();
            if (await cancelBtn.isVisible().catch(() => false)) await cancelBtn.click();
            return {
                success: true,
                status: 'already_exists',
                meetingTitle: titles,
                meetingDate: targetDateFormatted,
                reason: 'Pertemuan untuk tanggal ini sudah terdaftar'
            };
        }

        nextMeeting = uncreatedSession;
    } else if (!isForce) {
        console.log(`ℹ️ [LEWATI] Tidak ada jadwal sesi perkuliahan pada tanggal ${targetDateFormatted} untuk ${course.nama}.`);
        const cancelBtn = modal.locator('button:has-text("Batal"), .delete').first();
        if (await cancelBtn.isVisible().catch(() => false)) await cancelBtn.click();
        return {
            success: true,
            status: 'no_session_today',
            meetingTitle: '-',
            meetingDate: targetDateFormatted,
            reason: `Tidak ada sesi perkuliahan pada tanggal ${targetDateFormatted}`
        };
    } else {
        console.log(`⚠️ [--force] Mode paksa aktif: Mencari sesi terawal yang belum dibuat...`);
        nextMeeting = availableMeetings.find(m => !existingMeetingNums.has(m.meetingNumber));
    }

    if (!nextMeeting) {
        console.log(`✅ [LENGKAP] Seluruh pertemuan (${availableMeetings.length} sesi) untuk ${course.nama} sudah dibuat.`);
        const cancelBtn = modal.locator('button:has-text("Batal"), .delete').first();
        if (await cancelBtn.isVisible().catch(() => false)) await cancelBtn.click();
        return {
            success: true,
            status: 'complete',
            meetingTitle: `Lengkap (${availableMeetings.length} sesi)`,
            meetingDate: targetDateFormatted,
            reason: 'Semua pertemuan sudah lengkap'
        };
    }

    const judul = `Kuliah ${nextMeeting.meetingNumber}`;
    console.log(`🎯 [TARGET] Menyiapkan: ${judul}`);
    console.log(`   Jadwal : ${nextMeeting.day} ${nextMeeting.monthName} ${nextMeeting.year}, ${nextMeeting.startHour}:${String(nextMeeting.startMinute).padStart(2,'0')} - ${nextMeeting.endHour}:${String(nextMeeting.endMinute).padStart(2,'0')} WIB`);

    // a. Pilih pertemuan di select
    await pertemuanSelect.selectOption(nextMeeting.value);
    await page.waitForTimeout(400);

    // b. Judul Vidcon
    await modal.getByPlaceholder('Tulis Judul').first().fill(judul);

    // c. Platform: Zoom
    const platformSelect = modal.locator('select').nth(1);
    await platformSelect.selectOption('zoom').catch(() => {});

    // d. Link Zoom
    await modal.getByPlaceholder('Link').first().fill(zoomUrl);

    // e. Tanggal Perkuliahan
    const dateInput = modal.getByPlaceholder('dd/mm/yyyy').first();
    await dateInput.click();
    await page.waitForTimeout(400);

    const yearSelect = page.locator('.datepicker-header select').nth(1);
    if (await yearSelect.isVisible().catch(() => false)) {
        await yearSelect.selectOption(String(nextMeeting.year)).catch(() => {});
    }

    const monthSelect = page.locator('.datepicker-header select').nth(0);
    if (await monthSelect.isVisible().catch(() => false)) {
        await monthSelect.selectOption(String(nextMeeting.monthIndex)).catch(() => {});
    }
    await page.waitForTimeout(300);

    const dayBtn = page.getByRole('button', { name: String(nextMeeting.day), exact: true }).or(
        page.locator('.datepicker-cell:not(.is-nearby):not(.is-unselectable)').filter({ hasText: new RegExp(`^${nextMeeting.day}$`) })
    );
    if (await dayBtn.count() > 0) {
        await dayBtn.first().click();
    }
    await page.waitForTimeout(400);

    // f. Jam Mulai & Jam Selesai
    const selects = modal.locator('select');
    await selects.nth(4).selectOption(String(nextMeeting.startHour), { force: true }).catch(() => {});
    await selects.nth(5).selectOption(String(nextMeeting.startMinute), { force: true }).catch(() => {});
    await selects.nth(6).selectOption(String(nextMeeting.endHour), { force: true }).catch(() => {});
    await selects.nth(7).selectOption(String(nextMeeting.endMinute), { force: true }).catch(() => {});
    await page.waitForTimeout(300);

    // g. Simpan (Klik Tambah) dan Pantau Response API
    let apiSuccess = false;
    let apiErrorMsg = null;

    const onResponse = async (res) => {
        if (res.url().includes('/v2/lms/vidcon') && res.request().method() === 'POST') {
            if (res.status() === 201 || res.status() === 200) {
                apiSuccess = true;
            } else {
                try {
                    const data = await res.json();
                    apiErrorMsg = data.status?.message || data.message || `HTTP ${res.status()}`;
                } catch (e) {
                    apiErrorMsg = `HTTP ${res.status()}`;
                }
            }
        }
    };

    page.on('response', onResponse);

    const submitBtn = modal.locator('button.button.is-primary').filter({ hasText: 'Tambah' }).first();
    await submitBtn.click();
    await page.waitForTimeout(3500);

    page.off('response', onResponse);

    if (apiErrorMsg) {
        console.error(`❌ [GAGAL SIMPAN] Server menolak pembuatan vidcon: ${apiErrorMsg}`);
        const cancelBtn = modal.locator('button:has-text("Batal"), .delete').first();
        if (await cancelBtn.isVisible().catch(() => false)) await cancelBtn.click();
        return { success: false, status: 'api_error', reason: apiErrorMsg };
    }

    console.log(`✅ [BERHASIL] ${judul} untuk ${course.nama} berhasil disimpan!`);
    return {
        success: true,
        status: 'created',
        meetingTitle: judul,
        meetingDate: `${nextMeeting.day} ${nextMeeting.monthName} ${nextMeeting.year}`
    };
}

/**
 * Runner Utama Automasi Zoom dengan Deteksi Jadwal Harian & Auto-Retry
 */
async function runZoomAutomation(options = {}) {
    const lmsUrl = config.lms.url;
    const username = config.lms.username;
    const password = config.lms.password;
    const isHeadless = options.headless !== undefined ? options.headless : config.lms.headless;

    const now = new Date();
    const todayName = config.HARI_MAP[now.getDay()];

    let targetDateObj = options.targetDate || new Date();
    let targetDay = options.day || todayName;

    if (options.day && options.day !== todayName && options.day !== 'Semua') {
        const targetDayIdx = config.HARI_MAP.findIndex(h => h.toLowerCase() === options.day.toLowerCase());
        if (targetDayIdx !== -1) {
            const diff = targetDayIdx - now.getDay();
            targetDateObj = new Date(now);
            targetDateObj.setDate(now.getDate() + diff);
            targetDay = config.HARI_MAP[targetDayIdx];
        }
    }

    const isForce = !!options.isForce;
    const limitCount = options.limitCount !== undefined ? options.limitCount : Infinity;

    // Proteksi Akhir Pekan (kecuali jika secara eksplisit diminta atau mode Semua)
    if (!options.day && !options.targetDate && (targetDay === 'Sabtu' || targetDay === 'Minggu')) {
        console.log('===========================================================');
        console.log('   AUTOMASI INPUT VIDCON / ZOOM CIVITAS LMS OPERATOR       ');
        console.log('===========================================================');
        console.log(`Hari Ini    : ${targetDay}`);
        console.log(`Status      : Libur Akhir Pekan (Tidak ada jadwal perkuliahan)`);
        console.log('===========================================================\n');
        return { success: true, reason: 'weekend' };
    }

    const zoomSlots = getZoomSlots();
    const coursesPerSemester = getCourses();

    const targetSemesters = ['1', '3', '5', '7'];
    let totalTargetCourses = 0;
    for (const sem of targetSemesters) {
        const list = coursesPerSemester[sem] || [];
        const filtered = targetDay === 'Semua'
            ? list
            : list.filter(c => c.hari && c.hari.toLowerCase() === targetDay.toLowerCase());
        totalTargetCourses += filtered.length;
    }

    if (totalTargetCourses === 0) {
        console.log(`ℹ️ Tidak ada mata kuliah dengan jadwal hari '${targetDay}'. Selesai.`);
        return { success: true, reason: 'no_courses_scheduled' };
    }

    // Validasi Integritas Matkul Gabungan (Rabu: Sem 1 & Sem 7)
    const sem1List = coursesPerSemester['1'] || [];
    const sem7List = coursesPerSemester['7'] || [];
    const iotSem1 = sem1List.find(c => c.kode === 'PU 1209');
    const iotSem7 = sem7List.find(c => c.kode === 'ST 7105');
    const etikaSem1 = sem1List.find(c => c.kode === 'PU 1210');
    const etikaSem7 = sem7List.find(c => c.kode === 'ST 7106');

    if (iotSem1 && iotSem7) {
        const link1 = zoomSlots.get(String(iotSem1.kode_slot).toLowerCase().trim())?.link_zoom;
        const link7 = zoomSlots.get(String(iotSem7.kode_slot).toLowerCase().trim())?.link_zoom;
        if (link1 && link7 && link1 !== link7) {
            console.warn(`⚠️ [PERINGATAN GABUNGAN] Link Zoom 'Logika Teknologi' (Sem 1) != 'Teknologi Digital' (Sem 7)!`);
        }
    }
    if (etikaSem1 && etikaSem7) {
        const link1 = zoomSlots.get(String(etikaSem1.kode_slot).toLowerCase().trim())?.link_zoom;
        const link7 = zoomSlots.get(String(etikaSem7.kode_slot).toLowerCase().trim())?.link_zoom;
        if (link1 && link7 && link1 !== link7) {
            console.warn(`⚠️ [PERINGATAN GABUNGAN] Link Zoom 'Etika Profesi' (Sem 1) != (Sem 7)!`);
        }
    }

    const targetDateFormatted = targetDateObj.toLocaleDateString('id-ID', {
        day: 'numeric', month: 'long', year: 'numeric'
    });

    console.log('===========================================================');
    console.log('   AUTOMASI INPUT VIDCON / ZOOM CIVITAS LMS OPERATOR       ');
    console.log('===========================================================');
    console.log(`Target LMS     : ${lmsUrl}`);
    console.log(`User           : ${username}`);
    console.log(`Mode           : ${isHeadless ? 'Headless (Background)' : 'Visual (Jendela Browser Terbuka)'}`);
    console.log(`Target Tanggal : ${targetDay}, ${targetDateFormatted}`);
    console.log(`Target Matkul  : ${totalTargetCourses} mata kuliah`);
    console.log(`Target Run     : ${limitCount !== Infinity ? limitCount + ' mata kuliah' : 'Seluruh jadwal target'}`);
    if (isForce) console.log(`Mode Paksa     : YA (--force aktif)`);
    console.log('===========================================================\n');

    const browser = await chromium.launch({
        headless: isHeadless,
        slowMo: 60
    });

    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await context.newPage();
    const credentials = { url: lmsUrl, username, password };

    const courseResults = [];

    try {
        console.log('[AUTH] Melakukan login ke Civitas LMS...');
        await auth.login(page, credentials);

        let successTotal = 0;
        let skipTotal = 0;
        let processedTotal = 0;

        semesterLoop:
        for (const semester of targetSemesters) {
            let courses = coursesPerSemester[semester] || [];
            if (targetDay !== 'Semua') {
                courses = courses.filter(c => c.hari && c.hari.toLowerCase() === targetDay.toLowerCase());
            }

            if (courses.length === 0) continue;

            console.log(`\n===========================================================`);
            console.log(`>>> PROSES SEMESTER ${semester} (${courses.length} MATA KULIAH HARI ${targetDay.toUpperCase()})`);
            console.log(`===========================================================`);

            for (const course of courses) {
                await auth.ensureLoggedIn(page, credentials);

                const slotKey = String(course.kode_slot || semester).toLowerCase().trim();
                const slotObj = zoomSlots.get(slotKey);

                const resultItem = {
                    semester,
                    kode: course.kode,
                    nama: course.nama,
                    dosen: course.pengajar || '-',
                    hari: course.hari,
                    jam: `${course.jam_mulai_h || ''}:${course.jam_mulai_m || ''}`,
                    slot: slotKey.toUpperCase(),
                    zoomUrl: slotObj ? slotObj.link_zoom : '',
                    status: 'failed',
                    meetingTitle: '-',
                    meetingDate: '-',
                    reason: ''
                };

                if (!slotObj || !slotObj.link_zoom) {
                    console.warn(`[LEWATI] Tidak ada link Zoom untuk slot '${slotKey}' (${course.nama})`);
                    skipTotal++;
                    resultItem.status = 'no_zoom_link';
                    resultItem.reason = 'Link Zoom belum dikonfigurasi';
                    courseResults.push(resultItem);
                    continue;
                }

                let courseTargetDate = targetDateObj;
                if (targetDay === 'Semua' && course.hari) {
                    const courseDayIdx = config.HARI_MAP.findIndex(h => h.toLowerCase() === course.hari.toLowerCase());
                    if (courseDayIdx !== -1) {
                        const diff = courseDayIdx - now.getDay();
                        courseTargetDate = new Date(now);
                        courseTargetDate.setDate(now.getDate() + diff);
                    }
                }

                // 1x Auto-Retry jika terjadi logout di tengah jalan
                for (let attempt = 1; attempt <= 2; attempt++) {
                    try {
                        const res = await addVidconForCourse(page, course, slotObj.link_zoom, {
                            isForce,
                            targetDate: courseTargetDate
                        });
                        resultItem.status = res.status || (res.success ? 'created' : 'failed');
                        resultItem.meetingTitle = res.meetingTitle || '-';
                        resultItem.meetingDate = res.meetingDate || '-';
                        resultItem.reason = res.reason || '';

                        if (res.success) {
                            successTotal++;
                            break;
                        } else {
                            skipTotal++;
                            break;
                        }
                    } catch (err) {
                        console.error(`⚠️ [PERINGATAN] Percobaan ${attempt} gagal pada ${course.nama}: ${err.message}`);
                        resultItem.reason = err.message;
                        if (await auth.isLoginPage(page)) {
                            console.log('[AUTH] Terdeteksi logout otomatis. Melakukan re-login segera...');
                            await auth.login(page, credentials);
                        }
                        if (attempt === 2) {
                            console.error(`❌ [ERROR FINAL] Gagal memproses ${course.nama}`);
                            skipTotal++;
                        }
                    }
                }

                courseResults.push(resultItem);

                processedTotal++;
                if (processedTotal >= limitCount) {
                    console.log(`\n[SELESAI] Berhenti setelah memproses ${processedTotal} mata kuliah.`);
                    break semesterLoop;
                }

                await page.waitForTimeout(1000);
            }
        }

        const waReport = formatZoomReport({
            targetDay,
            targetDate: targetDateObj,
            courses: courseResults
        });

        const waReportFile = path.join(config.DATA_DIR, 'last_report_wa.txt');
        const jsonReportFile = path.join(config.DATA_DIR, 'last_report.json');
        try {
            fs.writeFileSync(waReportFile, waReport, 'utf8');
            fs.writeFileSync(jsonReportFile, JSON.stringify({
                generatedAt: new Date().toISOString(),
                targetDay,
                targetDate: targetDateObj.toISOString().slice(0, 10),
                totalCourses: courseResults.length,
                courses: courseResults
            }, null, 2), 'utf8');
        } catch (e) {}

        const createdTotal = courseResults.filter(c => c.status === 'created').length;
        const alreadyTotal = courseResults.filter(c => c.status === 'already_exists').length;
        const noSessionTotal = courseResults.filter(c => c.status === 'no_session_today').length;
        const emptyTotal = courseResults.filter(c => c.status === 'empty_dropdown').length;
        const failedTotal = courseResults.filter(c => !['created', 'already_exists', 'no_session_today', 'complete', 'empty_dropdown'].includes(c.status)).length;

        console.log('\n===========================================================');
        console.log('                   REKAPITULASI HASIL                      ');
        console.log('===========================================================');
        console.log(`Total Target     : ${courseResults.length} mata kuliah`);
        console.log(`Baru Terinput    : ${createdTotal}`);
        console.log(`Sudah Terdaftar  : ${alreadyTotal} (di-skip, aman)`);
        if (noSessionTotal > 0) console.log(`Tidak Ada Sesi   : ${noSessionTotal}`);
        if (emptyTotal > 0) console.log(`Dilewati (Lab)   : ${emptyTotal}`);
        if (failedTotal > 0) console.log(`Gagal/Perhatian  : ${failedTotal}`);
        console.log('===========================================================');

        console.log('\n================== LAPORAN EKSEKUSI ==================');
        console.log(waReport);
        console.log('======================================================\n');

        if (options.notify !== false) {
            await sendTelegramMessage(waReport);
        }

        return {
            success: true,
            targetDay,
            targetDate: targetDateObj,
            courses: courseResults,
            report: waReport
        };

    } finally {
        await browser.close();
    }
}

module.exports = {
    addVidconForCourse,
    runZoomAutomation
};
