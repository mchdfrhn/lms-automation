require('dotenv').config();
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const auth = require('./auth');

async function inspectModal() {
    const browser = await chromium.launch({ headless: true });
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

    // Ambil modal dialog HTML
    const modal = page.locator('.modal, .modal-card, .animation-content').first();
    const html = await modal.innerHTML();
    fs.writeFileSync(path.join(__dirname, '..', 'scratch', 'modal.html'), html, 'utf8');
    console.log('[MODAL] HTML modal berhasil disimpan di scratch/modal.html');

    await browser.close();
}

inspectModal().catch(console.error);
