require('dotenv').config();
const { chromium } = require('playwright');
const path = require('path');
const auth = require('./auth');

async function testSelectByValue() {
    const browser = await chromium.launch({ headless: false, slowMo: 70 });
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });

    await auth.login(page, {
        url: process.env.LMS_URL,
        username: process.env.LMS_USERNAME,
        password: process.env.LMS_PASSWORD
    });

    await page.getByRole('link', { name: 'Kelas' }).click();
    await page.waitForTimeout(2000);

    const searchInput = page.getByPlaceholder(/Cari ID kelas/i).first();
    await searchInput.fill('TS 3327');
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
    const pertemuanSelect = modal.locator('select').first();

    // 1. Select by VALUE
    const firstOption = pertemuanSelect.locator('option').first();
    const val = await firstOption.getAttribute('value');
    console.log('Value opsi pertama:', val);
    await pertemuanSelect.selectOption(val);
    await page.waitForTimeout(400);

    // 2. Judul
    await modal.getByPlaceholder('Tulis Judul').fill('Kuliah 1');

    // 3. Platform Zoom
    await modal.locator('select').nth(1).selectOption('zoom');

    // 4. Link Zoom
    await modal.getByPlaceholder('Link').fill('https://us06web.zoom.us/j/4540591032?pwd=5AlfFjdcUdHjhGUYykTdclTVID0egW.1&omn=89285501233');

    // 5. Tanggal
    const dateInput = modal.getByPlaceholder('dd/mm/yyyy').first();
    await dateInput.click();
    await page.waitForTimeout(400);

    const monthSelect = page.locator('span').filter({ hasText: 'January February March April' }).getByRole('combobox');
    if (await monthSelect.isVisible().catch(() => false)) {
        await monthSelect.selectOption('8'); // September
    }
    const yearSelect = page.locator('span').filter({ hasText: /2026/ }).getByRole('combobox');
    if (await yearSelect.isVisible().catch(() => false)) {
        await yearSelect.selectOption('2026');
    }
    await page.waitForTimeout(300);

    // Klik span 16 di datepicker-body
    console.log('Mengklik hari 16 di .datepicker-body...');
    const daySpan = page.locator('.datepicker-body span').filter({ hasText: /^16$/ }).first();
    await daySpan.click();
    await page.waitForTimeout(400);

    console.log('Nilai input tanggal sekarang:', await dateInput.inputValue());

    // 6. Waktu
    const modalSelects = modal.locator('select');
    await modalSelects.nth(4).selectOption('19', { force: true });
    await modalSelects.nth(5).selectOption('0', { force: true });
    await modalSelects.nth(6).selectOption('20', { force: true });
    await modalSelects.nth(7).selectOption('0', { force: true });

    // 7. Simpan (Klik Tambah)
    console.log('Menyimpan data (Klik Tambah)...');
    const submitBtn = modal.locator('button.button.is-primary').filter({ hasText: 'Tambah' }).first();
    await submitBtn.click();
    await page.waitForTimeout(3000);

    const scratchDir = path.join(__dirname, '..', 'scratch');
    await page.screenshot({ path: path.join(scratchDir, '10_modal_saved.png') });
    console.log('🎉 Selesai! Modal berhasil disimpan!');

    await browser.close();
}

testSelectByValue().catch(console.error);
