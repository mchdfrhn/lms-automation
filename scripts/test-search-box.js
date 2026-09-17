require('dotenv').config();
const { chromium } = require('playwright');
const path = require('path');
const auth = require('./auth');

async function testSearchBox() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });

    await auth.login(page, {
        url: process.env.LMS_URL,
        username: process.env.LMS_USERNAME,
        password: process.env.LMS_PASSWORD
    });

    await page.getByRole('link', { name: 'Kelas' }).click();
    await page.waitForTimeout(2500);

    const searchInput = page.getByPlaceholder(/Cari ID kelas/i).first();
    if (await searchInput.isVisible()) {
        console.log('[TEST] Mengetik "Matematika III" di search box...');
        await searchInput.fill('Matematika III');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2500);

        await page.screenshot({ path: path.join(__dirname, '..', 'scratch', 'search_result.png') });
        console.log('[TEST] Screenshot hasil pencarian disimpan di scratch/search_result.png');

        // Cek isi tabel
        const rows = await page.locator('table tr, .table tr').allTextContents();
        console.log('[TEST] Hasil baris tabel setelah search:', rows);
    } else {
        console.log('[TEST] Input Cari ID kelas tidak ditemukan.');
    }

    await browser.close();
}

testSearchBox().catch(console.error);
