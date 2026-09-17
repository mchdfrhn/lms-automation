require('dotenv').config();
const { chromium } = require('playwright');
const path = require('path');
const auth = require('./auth');

async function testDateClick() {
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

    // Buka Datepicker
    const dateInput = modal.getByPlaceholder('dd/mm/yyyy').first();
    await dateInput.click();
    await page.waitForTimeout(500);

    // Ambil info semua cell yang mengandung angka 16
    const cells = await page.locator('.datepicker-cell').evaluateAll(els => {
        return els.map(e => ({
            tag: e.tagName,
            className: e.className,
            text: e.innerText.trim()
        })).filter(e => e.text === '16');
    });
    console.log('Semua element dengan teks 16:', cells);

    // Coba klik cell tanggal 16 dengan locator yang tepat
    const targetCell = page.locator('.datepicker-cell.is-unselectable').filter({ hasText: /^16$/ }).first();
    console.log('Cell visible?', await targetCell.isVisible());
    await targetCell.click();
    await page.waitForTimeout(500);

    console.log('Nilai input tanggal setelah klik cell:', await dateInput.inputValue());

    await browser.close();
}

testDateClick().catch(console.error);
