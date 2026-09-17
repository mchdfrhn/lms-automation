require('dotenv').config();
const { chromium } = require('playwright');
const path = require('path');
const auth = require('./auth');

async function testFisika() {
    const browser = await chromium.launch({ headless: false, slowMo: 50 });
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });

    await auth.login(page, {
        url: process.env.LMS_URL,
        username: process.env.LMS_USERNAME,
        password: process.env.LMS_PASSWORD
    });

    console.log('[1/8] Membuka menu Kelas...');
    await page.getByRole('link', { name: 'Kelas' }).click();
    await page.waitForTimeout(2000);

    console.log('[2/8] Mencari "TS 3326" di kotak Cari ID kelas...');
    const searchInput = page.getByPlaceholder(/Cari ID kelas/i).first();
    await searchInput.fill('TS 3326');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    console.log('[3/8] Mencari baris "Kelas Sore"...');
    const soreRow = page.locator('table tr').filter({ hasText: 'Kelas Sore' }).first();
    await soreRow.waitFor({ state: 'visible', timeout: 5000 });

    console.log('[4/8] Mengklik tombol "Lihat"...');
    await soreRow.locator('button:has-text("Lihat")').first().click();
    await page.waitForTimeout(2500);

    console.log('[5/8] Membuka Tab Vidcon...');
    await page.getByText('Vidcon', { exact: true }).first().click();
    await page.waitForTimeout(1500);

    console.log('[6/8] Mengklik "Tambah Vidcon"...');
    await page.getByRole('button', { name: 'Tambah Vidcon' }).first().click();
    await page.waitForTimeout(1500);

    console.log('[7/8] Mengisi Form Modal Vidcon...');
    const modal = page.locator('.modal, .modal-card, .animation-content').first();
    const selects = modal.locator('select');

    // a. Sesi Pertemuan
    console.log('   - Memilih Sesi Pertemuan...');
    await selects.nth(0).selectOption({ index: 0 });

    // b. Judul
    console.log('   - Mengisi Judul: Kuliah 1...');
    await modal.getByPlaceholder('Tulis Judul').fill('Kuliah 1');

    // c. Platform Zoom
    console.log('   - Memilih Platform Zoom...');
    await selects.nth(1).selectOption('zoom');

    // d. Link Zoom
    const zoomLink = 'https://us06web.zoom.us/j/4540591032?pwd=5AlfFjdcUdHjhGUYykTdclTVID0egW.1&omn=89285501233';
    console.log(`   - Mengisi Link Zoom: ${zoomLink}`);
    await modal.getByPlaceholder('Link').fill(zoomLink);

    // e. Tanggal: 15 Sep 2026
    console.log('   - Memilih Tanggal: 15 Sep 2026...');
    const dateInput = modal.getByPlaceholder('dd/mm/yyyy').first();
    await dateInput.click();
    await page.waitForTimeout(300);
    await selects.nth(2).selectOption('8', { force: true }); // September
    await selects.nth(3).selectOption('2026', { force: true }); // 2026
    await page.locator('.datepicker-cell').filter({ hasText: /^15$/ }).first().click();
    await page.waitForTimeout(300);

    // f. Jam Mulai: 19:00
    console.log('   - Mengatur Jam Mulai: 19:00...');
    await selects.nth(4).selectOption('19', { force: true });
    await selects.nth(5).selectOption('0', { force: true });

    // g. Jam Selesai: 20:30
    console.log('   - Mengatur Jam Selesai: 20:30...');
    await selects.nth(6).selectOption('20', { force: true });
    await selects.nth(7).selectOption('30', { force: true });

    // 8. Klik Tambah
    console.log('[8/8] Mengklik tombol Tambah (Simpan)...');
    const submitBtn = modal.locator('button.button.is-primary').filter({ hasText: 'Tambah' }).first();
    await submitBtn.click();
    await page.waitForTimeout(3000);

    const scratchDir = path.join(__dirname, '..', 'scratch');
    await page.screenshot({ path: path.join(scratchDir, '6_vidcon_fisika_sukses.png') });
    console.log('🎉 [SELESAI] Vidcon Fisika II berhasil disimpan!');

    await browser.close();
}

testFisika().catch(console.error);
