require('dotenv').config();
const { chromium } = require('playwright');
const path = require('path');
const auth = require('./auth');

async function testDatepicker() {
    const browser = await chromium.launch({ headless: false, slowMo: 100 });
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });

    await auth.login(page, {
        url: process.env.LMS_URL,
        username: process.env.LMS_USERNAME,
        password: process.env.LMS_PASSWORD
    });

    await page.getByRole('link', { name: 'Kelas' }).click();
    await page.waitForTimeout(2000);

    const searchInput = page.getByPlaceholder(/Cari ID kelas/i).first();
    await searchInput.fill('TS 3326');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    const soreRow = page.locator('table tr').filter({ hasText: 'Kelas Sore' }).first();
    await soreRow.locator('button:has-text("Lihat")').first().click();
    await page.waitForTimeout(2500);

    await page.getByText('Vidcon', { exact: true }).first().click();
    await page.waitForTimeout(1500);

    await page.getByRole('button', { name: 'Tambah Vidcon' }).first().click();
    await page.waitForTimeout(1500);

    const modal = page.locator('.modal, .modal-card, .animation-content').first();

    // 1. Pilih Pertemuan 1
    console.log('[TEST] Opsi Pertemuan:');
    const pertemuanSelect = modal.locator('select').first();
    const options = await pertemuanSelect.locator('option').allTextContents();
    console.log('Options di Pertemuan:', options);

    // Pilih opsi ke-2 (index 1 atau yang mengandung "1.")
    await pertemuanSelect.selectOption({ index: 1 });
    await page.waitForTimeout(500);
    console.log('Selected Pertemuan value:', await pertemuanSelect.inputValue());

    // 2. Klik tanggal
    console.log('[TEST] Klik tanggal...');
    const dateInput = modal.getByPlaceholder('dd/mm/yyyy').first();
    await dateInput.click();
    await page.waitForTimeout(1000);

    // Cek dropdown bulan dan tahun di datepicker
    const datepickerDropdowns = await page.locator('.datepicker select').all();
    console.log('Jumlah select di .datepicker:', datepickerDropdowns.length);

    if (datepickerDropdowns.length >= 2) {
        await datepickerDropdowns[0].selectOption('8'); // September
        await page.waitForTimeout(300);
        await datepickerDropdowns[1].selectOption('2026'); // 2026
        await page.waitForTimeout(300);
    }

    // Klik hari 15
    const day15 = page.locator('.datepicker-cell').filter({ hasText: /^15$/ }).first();
    console.log('Day 15 visible?', await day15.isVisible());
    await day15.click();
    await page.waitForTimeout(500);

    console.log('Nilai input tanggal sekarang:', await dateInput.inputValue());

    const scratchDir = path.join(__dirname, '..', 'scratch');
    await page.screenshot({ path: path.join(scratchDir, '7_datepicker_terisi.png') });

    await browser.close();
}

testDatepicker().catch(console.error);
