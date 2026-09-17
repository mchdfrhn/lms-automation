require('dotenv').config();
const { chromium } = require('playwright');
const auth = require('./auth');

async function testFilter() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });

    await auth.login(page, {
        url: process.env.LMS_URL,
        username: process.env.LMS_USERNAME,
        password: process.env.LMS_PASSWORD
    });

    await page.getByRole('link', { name: 'Kelas' }).click();
    await page.waitForTimeout(2500);

    // Buka Filter
    await page.getByRole('button', { name: /Filter/i }).click();
    await page.waitForTimeout(1500);

    // Ambil semua elemen label dan input di sidebar
    const labels = await page.locator('.b-sidebar, [class*="sidebar"]').locator('label, div.text-big-button, .label, select, input').allTextContents();
    console.log('Labels di sidebar:', labels);

    // Cek tombol di sidebar
    const buttons = await page.locator('.b-sidebar, [class*="sidebar"]').locator('button, a').allTextContents();
    console.log('Buttons di sidebar:', buttons);

    await browser.close();
}

testFilter().catch(console.error);
