require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const xlsx = require('xlsx');
const auth = require('./auth');

/**
 * =========================================================================
 * AUTOMASI INPUT VIDCON / ZOOM CIVITAS LMS (STTPU)
 * S1 TEKNIK SIPIL - KELAS SORE (SEMESTER 3, 5, 7)
 * =========================================================================
 * Fitur:
 * 1. Bypass bug filter sidebar menggunakan pencarian langsung 'Cari ID kelas'
 * 2. Auto-Detect Pertemuan Berikutnya (Kuliah 1 -> Kuliah 2 -> Kuliah 3, dst)
 * 3. Ekstraksi otomatis Tanggal & Jam dari opsi dropdown sistem
 * 4. Proteksi duplikasi jika pertemuan sudah pernah dibuat
 * 5. Auto-relogin tangguh jika sesi logout 5 menit di tengah proses
 * 6. Kompatibel penuh untuk trigger cron harian n8n
 */

const DATA_DIR = path.join(__dirname, '..', 'data');
const JSON_ZOOM_FILE = path.join(DATA_DIR, 'jadwal_zoom.json');
const EXCEL_ZOOM_FILE = path.join(DATA_DIR, 'jadwal_zoom.xlsx');
const MATKUL_FILE = path.join(DATA_DIR, 'daftar_matkul.json');

// Membaca link zoom per slot (1, 3, 5, 7a, 7b, 7c) dengan auto-sync
function getZoomSlots() {
    const hasJson = fs.existsSync(JSON_ZOOM_FILE);
    const hasExcel = fs.existsSync(EXCEL_ZOOM_FILE);

    if (!hasJson && !hasExcel) {
        throw new Error('Tidak ditemukan file jadwal_zoom.json maupun .xlsx di folder data!');
    }

    let activeSource = 'json';
    if (hasJson && hasExcel) {
        const jsonTime = fs.statSync(JSON_ZOOM_FILE).mtimeMs;
        const excelTime = fs.statSync(EXCEL_ZOOM_FILE).mtimeMs;
        activeSource = excelTime > jsonTime ? 'excel' : 'json';
    } else if (hasExcel) {
        activeSource = 'excel';
    }

    let list = [];
    if (activeSource === 'excel') {
        console.log(`📄 [DATA] Menggunakan data dari: jadwal_zoom.xlsx`);
        const wb = xlsx.readFile(EXCEL_ZOOM_FILE);
        list = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        try { fs.writeFileSync(JSON_ZOOM_FILE, JSON.stringify(list, null, 2), 'utf8'); } catch (e) {}
    } else {
        console.log(`📄 [DATA] Menggunakan data dari: jadwal_zoom.json`);
        list = JSON.parse(fs.readFileSync(JSON_ZOOM_FILE, 'utf8'));
    }

    const slotMap = new Map();
    list.forEach(item => {
        const key = String(item.kode_slot || item.semester).toLowerCase().trim();
        slotMap.set(key, {
            kode_slot: key,
            keterangan: item.keterangan || '',
            link_zoom: (item.link_zoom || '').trim()
        });
    });

    return slotMap;
}

// Membaca daftar mata kuliah Semester 3, 5, 7
function getCourses() {
    if (!fs.existsSync(MATKUL_FILE)) {
        throw new Error(`File daftar mata kuliah tidak ditemukan: ${MATKUL_FILE}`);
    }
    return JSON.parse(fs.readFileSync(MATKUL_FILE, 'utf8'));
}

/**
 * Parser teks opsi pertemuan Civitas LMS
 * Contoh teks: "2. (22 Sep 2026, 19:00 - 20:30 WIB)"
 */
function parseMeetingOption(text) {
    const regex = /(\d+)\.\s*\(\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\s*,\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/;
    const match = text.match(regex);
    if (!match) return null;

    const monthMap = {
        'jan': 0, 'januari': 0, 'january': 0,
        'feb': 1, 'februari': 1, 'february': 1,
        'mar': 2, 'maret': 2, 'march': 2,
        'apr': 3, 'april': 3,
        'mei': 4, 'may': 4,
        'jun': 5, 'juni': 5, 'june': 5,
        'jul': 6, 'juli': 6, 'july': 6,
        'agu': 7, 'agustus': 7, 'aug': 7, 'august': 7,
        'sep': 8, 'september': 8,
        'okt': 9, 'oktober': 9, 'oct': 9, 'october': 9,
        'nov': 10, 'november': 10,
        'des': 11, 'desember': 11, 'dec': 11, 'december': 11
    };

    const monthStr = match[3].toLowerCase();
    const monthIndex = monthMap[monthStr] !== undefined ? monthMap[monthStr] : 8;

    return {
        meetingNumber: parseInt(match[1], 10),
        day: parseInt(match[2], 10),
        monthIndex: monthIndex,
        monthName: match[3],
        year: parseInt(match[4], 10),
        startHour: parseInt(match[5], 10),
        startMinute: parseInt(match[6], 10),
        endHour: parseInt(match[7], 10),
        endMinute: parseInt(match[8], 10),
        raw: text.trim()
    };
}

/**
 * Menambahkan Vidcon untuk 1 Mata Kuliah dengan Deteksi Sesi Otomatis
 */
async function addVidconForCourse(page, course, zoomUrl, options = {}) {
    const isForce = !!options.isForce;

    console.log(`\n-----------------------------------------------------------`);
    console.log(`[MATKUL] ${course.nama} (${course.kode})`);
    console.log(`[DOSEN]  ${course.pengajar || '-'}`);
    console.log(`[HARI]   ${course.hari || '-'} | Jam: ${course.jam_mulai_h || ''}:${course.jam_mulai_m || ''}`);
    console.log(`[ZOOM]   Slot ${course.kode_slot.toUpperCase()} -> ${zoomUrl}`);

    // 1. Ke Menu Kelas (Gunakan .first() agar tidak ambigu dengan tautan breadcrumb di halaman detail)
    const kelasLink = page.getByRole('link', { name: 'Kelas' }).first();
    await kelasLink.click();
    await page.waitForTimeout(2000);

    // 2. Cari langsung menggunakan kotak 'Cari ID kelas'
    const searchInput = page.getByPlaceholder(/Cari ID kelas/i).first();
    await searchInput.fill(course.kode);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    // 3. Temukan baris Kelas Sore
    let targetRow = page.locator('table tr').filter({ hasText: 'Kelas Sore' }).filter({ hasText: course.kode }).first();
    if (!await targetRow.isVisible().catch(() => false)) {
        targetRow = page.locator('table tr').filter({ hasText: 'Kelas Sore' }).filter({ hasText: course.nama }).first();
    }

    if (!await targetRow.isVisible({ timeout: 4000 }).catch(() => false)) {
        console.warn(`⚠️ [SKIP] Kelas Sore untuk '${course.nama}' (${course.kode}) tidak ditemukan di tabel.`);
        return { success: false, status: 'not_found', reason: 'Baris Kelas Sore tidak ditemukan di tabel' };
    }

    // 4. Klik tombol "Lihat"
    const lihatBtn = targetRow.locator('button:has-text("Lihat")').first();
    await lihatBtn.click();
    await page.waitForTimeout(2500);

    // 5. Masuk ke Tab Vidcon
    const vidconTab = page.getByText('Vidcon', { exact: true }).first();
    await vidconTab.click();
    await page.waitForTimeout(1500);

    // 6. Cek Pertemuan apa saja yang SUDAH dibuat sebelumnya di tab Vidcon
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

    // 7. Klik tombol "Tambah Vidcon"
    const tambahVidconBtn = page.getByRole('button', { name: /Tambah Vidcon/i }).first();
    if (!await tambahVidconBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        console.warn(`⚠️ Tombol 'Tambah Vidcon' tidak ditemukan.`);
        return { success: false, status: 'button_hidden', reason: 'Tombol Tambah Vidcon tidak terlihat' };
    }
    await tambahVidconBtn.click();
    await page.waitForTimeout(1500);

    // 8. Baca Opsi Pertemuan di Modal Dialog
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

    // 9. Cek apakah pertemuan untuk jadwal hari ini sudah terdaftar
    const now = new Date();
    const todayDay = now.getDate();
    const todayMonth = now.getMonth();
    const todayYear = now.getFullYear();

    // Cari pertemuan di dropdown yang tanggalnya persis hari ini
    const todayMeeting = availableMeetings.find(m => m.day === todayDay && m.monthIndex === todayMonth && m.year === todayYear);

    let nextMeeting = null;

    if (todayMeeting && !isForce) {
        // Jika ada sesi yang terjadwal persis hari ini:
        if (existingMeetingNums.has(todayMeeting.meetingNumber)) {
            console.log(`ℹ️ [SUDAH TERSEDIA] Vidcon hari ini (Kuliah ${todayMeeting.meetingNumber} - ${todayMeeting.day} ${todayMeeting.monthName} ${todayMeeting.year}) sudah terdaftar di LMS.`);
            const cancelBtn = modal.locator('button:has-text("Batal"), .delete').first();
            if (await cancelBtn.isVisible().catch(() => false)) await cancelBtn.click();
            return {
                success: true,
                status: 'already_exists',
                meetingTitle: `Kuliah ${todayMeeting.meetingNumber}`,
                meetingDate: `${todayMeeting.day} ${todayMeeting.monthName} ${todayMeeting.year}`,
                reason: 'Pertemuan hari ini sudah dibuat'
            };
        }
        nextMeeting = todayMeeting;
    } else {
        // Jika tidak ada sesi persis hari ini (misal tanggal perkuliahan baru mulai minggu depan atau mode force),
        // pilih sesi terawal yang belum pernah dibuat
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
            reason: 'Semua pertemuan sudah lengkap'
        };
    }

    const judul = `Kuliah ${nextMeeting.meetingNumber}`;
    console.log(`🎯 [TARGET] Menyiapkan: ${judul}`);
    console.log(`   Jadwal : ${nextMeeting.day} ${nextMeeting.monthName} ${nextMeeting.year}, ${nextMeeting.startHour}:${String(nextMeeting.startMinute).padStart(2,'0')} - ${nextMeeting.endHour}:${String(nextMeeting.endMinute).padStart(2,'0')} WIB`);

    // a. Pilih pertemuan di select (by VALUE agar reactive binding Vue bekerja)
    await pertemuanSelect.selectOption(nextMeeting.value);
    await page.waitForTimeout(400);

    // b. Judul Vidcon
    await modal.getByPlaceholder('Tulis Judul').first().fill(judul);

    // c. Platform: Zoom
    const platformSelect = modal.locator('select').nth(1);
    await platformSelect.selectOption('zoom').catch(() => {});

    // d. Link Zoom
    await modal.getByPlaceholder('Link').first().fill(zoomUrl);

    // e. Tanggal Perkuliahan (Buka calendar header -> Pilih Tahun -> Pilih Bulan -> Klik Tanggal)
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
 * Format Laporan Eksekusi untuk WhatsApp (Humanize, Rapi & Elegan)
 */
function formatWhatsAppReport({ targetDay, courses }) {
    const now = new Date();
    const tglStr = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const jamStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';

    const createdList = courses.filter(c => c.status === 'created');
    const alreadyList = courses.filter(c => c.status === 'already_exists');
    const emptyList = courses.filter(c => c.status === 'empty_dropdown');
    const failedList = courses.filter(c => !['created', 'already_exists', 'complete', 'empty_dropdown'].includes(c.status));

    let headerStatus = '✅ *STATUS: SEMUA JADWAL AMAN & SESUAI*';
    if (failedList.length > 0) {
        headerStatus = `⚠️ *STATUS: ${failedList.length} MATA KULIAH MEMERLUKAN PERHATIAN*`;
    }

    let report = `📋 *LAPORAN AUTOMASI ZOOM CIVITAS LMS*\n`;
    report += `🗓️ *Jadwal :* ${targetDay}, ${tglStr}\n`;
    report += `⏰ *Waktu  :* ${jamStr}\n`;
    report += `🎓 *Target :* S1 Teknik Sipil (Kelas Sore)\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    report += `${headerStatus}\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    const semNames = { '1': 'Semester 1', '3': 'Semester 3', '5': 'Semester 5', '7': 'Semester 7' };

    for (const sem of ['1', '3', '5', '7']) {
        const list = courses.filter(c => c.semester === sem);
        if (list.length === 0) continue;

        report += `📚 *${semNames[sem]}* (${list.length} Mata Kuliah)\n`;

        list.forEach((c, idx) => {
            let badge = '✅ *Baru Terinput*';
            if (c.status === 'already_exists') {
                badge = '🔹 *Sudah Siap (Aman)*';
            } else if (c.status === 'empty_dropdown') {
                badge = '⚠️ *Dilewati (Praktikum / Non-Teori)*';
            } else if (c.status === 'complete') {
                badge = '🏁 *Sesi Lengkap*';
            } else {
                badge = `❌ *Gagal:* ${c.reason || 'Error'}`;
            }

            report += `${idx + 1}. *${c.nama}*\n`;
            report += `   • Kode / Slot : \`${c.kode}\` | *Slot ${c.slot}*\n`;
            if (c.dosen && c.dosen !== '-') report += `   • Dosen       : ${c.dosen}\n`;
            report += `   • Sesi        : ${c.meetingTitle} (${c.jam} WIB)\n`;
            report += `   • Status      : ${badge}\n\n`;
        });
    }

    // Sorotan Khusus Matkul Pilihan Hari Kamis jika ada
    const pilihanSem7 = courses.filter(c => ['TS 7472', 'TS 7473', 'TS 7474'].includes(c.kode));
    if (pilihanSem7.length > 0) {
        report += `⭐ *Pengecekan Matkul Pilihan (Kamis 19:00 WIB):*\n`;
        pilihanSem7.forEach(p => {
            const st = p.status === 'already_exists' ? 'Sudah Ada' : (p.status === 'created' ? 'Baru Terinput' : p.status);
            report += `• *${p.nama}* ➔ Slot *${p.slot}* (${st})\n`;
        });
        report += `\n`;
    }

    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    report += `📊 *RINGKASAN EKSEKUSI:*\n`;
    report += `• Total Terjadwal : ${courses.length} mata kuliah\n`;
    report += `• Baru Terinput   : ${createdList.length}\n`;
    report += `• Sudah Terdaftar : ${alreadyList.length}\n`;
    if (emptyList.length > 0) report += `• Dilewati (Lab)  : ${emptyList.length}\n`;
    if (failedList.length > 0) report += `• Gagal/Perhatian : ${failedList.length}\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    report += `_Automasi LMS Civitas Operator • Status Valid_`;

    return report;
}

/**
 * Runner Utama dengan Auto-Retry jika Session Expired
 */
async function main() {
    const lmsUrl = process.env.LMS_URL;
    const username = process.env.LMS_USERNAME;
    const password = process.env.LMS_PASSWORD;
    const isHeadless = process.env.HEADLESS === 'true';

    // 1. Deteksi Hari Ini & Opsi CLI
    const HARI_MAP = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const todayName = HARI_MAP[new Date().getDay()];

    const isAllDays = process.argv.includes('--all') || process.argv.includes('-a');
    const dayArgIdx = process.argv.findIndex(a => a === '--day' || a === '-d');
    const targetDay = dayArgIdx !== -1 ? process.argv[dayArgIdx + 1] : (isAllDays ? 'Semua' : todayName);

    const isForce = process.argv.includes('--force') || process.argv.includes('-f');
    const isTestMode = process.argv.includes('--test') || process.argv.includes('-t');
    const limitIdx = process.argv.findIndex(a => a === '--limit' || a === '-l');
    const limitCount = limitIdx !== -1 ? parseInt(process.argv[limitIdx + 1], 10) : (isTestMode ? 1 : Infinity);

    // 2. Proteksi Akhir Pekan (Sabtu / Minggu)
    if (!isAllDays && dayArgIdx === -1 && (targetDay === 'Sabtu' || targetDay === 'Minggu')) {
        console.log('===========================================================');
        console.log('   AUTOMASI INPUT VIDCON / ZOOM CIVITAS LMS OPERATOR       ');
        console.log('===========================================================');
        console.log(`Hari Ini    : ${targetDay}`);
        console.log(`Status      : Libur Akhir Pekan (Tidak ada jadwal perkuliahan)`);
        console.log('===========================================================\n');
        return;
    }

    const zoomSlots = getZoomSlots();
    const coursesPerSemester = getCourses();

    // 3. Hitung jumlah mata kuliah yang terjadwal untuk hari target
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
        console.log(`ℹ️ Tidak ada mata kuliah dengan jadwal hari '${targetDay}'. Skrip selesai.`);
        return;
    }

    console.log('===========================================================');
    console.log('   AUTOMASI INPUT VIDCON / ZOOM CIVITAS LMS OPERATOR       ');
    console.log('===========================================================');
    console.log(`Target LMS  : ${lmsUrl}`);
    console.log(`User        : ${username}`);
    console.log(`Mode        : ${isHeadless ? 'Headless (Background)' : 'Visual (Jendela Browser Terbuka)'}`);
    console.log(`Jadwal Hari : ${targetDay} (${totalTargetCourses} mata kuliah)`);
    console.log(`Target Run  : ${limitCount !== Infinity ? limitCount + ' mata kuliah' : 'Seluruh jadwal hari ini'}`);
    if (isForce) console.log(`Mode Paksa  : YA (--force aktif)`);
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
                // Auto-relogin jika sesi terputus
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

                // Eksekusi dengan 1x Auto-Retry jika terjadi error sesi logout 5 menit
                let success = false;
                for (let attempt = 1; attempt <= 2; attempt++) {
                    try {
                        const res = await addVidconForCourse(page, course, slotObj.link_zoom, { isForce });
                        resultItem.status = res.status || (res.success ? 'created' : 'failed');
                        resultItem.meetingTitle = res.meetingTitle || '-';
                        resultItem.meetingDate = res.meetingDate || '-';
                        resultItem.reason = res.reason || '';

                        if (res.success) {
                            successTotal++;
                            success = true;
                            break;
                        } else {
                            skipTotal++;
                            break;
                        }
                    } catch (err) {
                        console.error(`⚠️ [PERINGATAN] Percobaan ${attempt} gagal pada ${course.nama}: ${err.message}`);
                        resultItem.reason = err.message;
                        // Cek apakah sesi logout di tengah jalan
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
                    console.log(`\n[SELESAI] Berhenti setelah memproses ${processedTotal} mata kuliah (sesuai target batas run).`);
                    break semesterLoop;
                }

                await page.waitForTimeout(1000);
            }
        }

        // Generate dan Simpan Laporan WhatsApp
        const waReport = formatWhatsAppReport({
            targetDay,
            courses: courseResults
        });

        const waReportFile = path.join(DATA_DIR, 'last_report_wa.txt');
        const jsonReportFile = path.join(DATA_DIR, 'last_report.json');
        try {
            fs.writeFileSync(waReportFile, waReport, 'utf8');
            fs.writeFileSync(jsonReportFile, JSON.stringify({
                generatedAt: new Date().toISOString(),
                targetDay,
                totalCourses: courseResults.length,
                courses: courseResults
            }, null, 2), 'utf8');
        } catch (e) {}

        console.log('\n===========================================================');
        console.log('                   REKAPITULASI HASIL                      ');
        console.log('===========================================================');
        console.log(`Sukses Terproses : ${successTotal}`);
        console.log(`Gagal/Dilewati   : ${skipTotal}`);
        console.log('===========================================================');

        console.log('\n================== LAPORAN WHATSAPP ==================');
        console.log(waReport);
        console.log('======================================================\n');
        console.log(`💾 Laporan tersimpan di: ${waReportFile}`);

    } catch (err) {
        console.error(`❌ [FATAL ERROR]: ${err.message}`);
        process.exitCode = 1;
    } finally {
        await browser.close();
    }
}

if (require.main === module) {
    main().catch(err => {
        console.error('Fatal unhandled error:', err);
        process.exit(1);
    });
}

module.exports = { main, addVidconForCourse, getZoomSlots, parseMeetingOption };
