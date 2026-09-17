require('dotenv').config();
const { chromium } = require('playwright');
const path = require('path');
const auth = require('./auth');

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

async function testAutoMeeting() {
    const browser = await chromium.launch({ headless: false, slowMo: 70 });
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });

    await auth.login(page, {
        url: process.env.LMS_URL,
        username: process.env.LMS_USERNAME,
        password: process.env.LMS_PASSWORD
    });

    console.log('[1/7] Membuka menu Kelas...');
    await page.getByRole('link', { name: 'Kelas' }).click();
    await page.waitForTimeout(2000);

    // Kita uji pada Kimia Dasar (TS 3327) yang belum ada vidcon sama sekali
    console.log('[2/7] Mencari "TS 3327" (Kimia Dasar)...');
    const searchInput = page.getByPlaceholder(/Cari ID kelas/i).first();
    await searchInput.fill('TS 3327');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    const soreRow = page.locator('table tr').filter({ hasText: 'Kelas Sore' }).first();
    await soreRow.locator('button:has-text("Lihat")').first().click();
    await page.waitForTimeout(2500);

    console.log('[3/7] Membuka Tab Vidcon...');
    await page.getByText('Vidcon', { exact: true }).first().click();
    await page.waitForTimeout(1500);

    console.log('[4/7] Mengklik "Tambah Vidcon"...');
    await page.getByRole('button', { name: 'Tambah Vidcon' }).first().click();
    await page.waitForTimeout(1500);

    const modal = page.locator('.modal, .modal-card, .animation-content').first();
    const pertemuanSelect = modal.locator('select').first();

    // Baca opsi-opsi pertemuan yang tersedia
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

    console.log(`[5/7] Ditemukan ${availableMeetings.length} sesi pertemuan terdaftar di sistem.`);
    console.log('Sesi pertama yang akan dipilih:', availableMeetings[0]);

    const targetMeeting = availableMeetings[0]; // Pertemuan pertama yang belum dibuat

    // a. Pilih pertemuan di select
    await pertemuanSelect.selectOption({ index: targetMeeting.index });
    await page.waitForTimeout(300);

    // b. Judul otomatis: Kuliah <Nomor>
    const judul = `Kuliah ${targetMeeting.meetingNumber}`;
    console.log(`[6/7] Mengisi judul otomatis: ${judul}`);
    await modal.getByPlaceholder('Tulis Judul').fill(judul);

    // c. Platform Zoom
    console.log('   - Memilih Platform: Zoom...');
    await modal.locator('select').nth(1).selectOption('zoom');

    // d. Link Zoom Slot 3
    const zoomLink = 'https://us06web.zoom.us/j/4540591032?pwd=5AlfFjdcUdHjhGUYykTdclTVID0egW.1&omn=89285501233';
    console.log(`   - Mengisi Link Zoom: ${zoomLink}`);
    await modal.getByPlaceholder('Link').fill(zoomLink);

    // e. Tanggal: otomatis dari parsed targetMeeting
    console.log(`   - Mengisi Tanggal otomatis: ${targetMeeting.day} ${targetMeeting.monthName} ${targetMeeting.year}...`);
    const dateBox = modal.getByPlaceholder('dd/mm/yyyy').first();
    await dateBox.click();
    await page.waitForTimeout(300);

    // Set bulan & tahun di datepicker
    const dateDropdowns = page.locator('.datepicker select');
    if (await dateDropdowns.count() >= 2) {
        await dateDropdowns.nth(0).selectOption(String(targetMeeting.monthIndex), { force: true });
        await dateDropdowns.nth(1).selectOption(String(targetMeeting.year), { force: true });
        await page.waitForTimeout(200);
    }

    // Klik cell tanggal
    const dayTarget = String(targetMeeting.day);
    const dayCell = page.locator('.datepicker-cell').filter({ hasText: new RegExp(`^${dayTarget}$`) }).first();
    await dayCell.click();
    await page.waitForTimeout(300);

    // f. Jam otomatis dari targetMeeting
    console.log(`   - Mengatur Jam otomatis: ${targetMeeting.startHour}:${targetMeeting.startMinute} s/d ${targetMeeting.endHour}:${targetMeeting.endMinute}...`);
    const modalSelects = modal.locator('select');
    await modalSelects.nth(4).selectOption(String(targetMeeting.startHour), { force: true });
    await modalSelects.nth(5).selectOption(String(targetMeeting.startMinute), { force: true });
    await modalSelects.nth(6).selectOption(String(targetMeeting.endHour), { force: true });
    await modalSelects.nth(7).selectOption(String(targetMeeting.endMinute), { force: true });

    // g. Klik Tambah
    console.log('[7/7] Menyimpan Vidcon (Klik Tambah)...');
    const submitBtn = modal.locator('button.button.is-primary').filter({ hasText: 'Tambah' }).first();
    await submitBtn.click();
    await page.waitForTimeout(3000);

    const scratchDir = path.join(__dirname, '..', 'scratch');
    await page.screenshot({ path: path.join(scratchDir, '8_vidcon_auto_sukses.png') });
    console.log(`🎉 [SELESAI] Vidcon ${judul} untuk Kimia Dasar berhasil disimpan otomatis!`);

    await browser.close();
}

testAutoMeeting().catch(console.error);
