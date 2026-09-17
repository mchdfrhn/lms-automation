require('dotenv').config();
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const auth = require('./auth');

async function dumpSidebar() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });

    await auth.login(page, {
        url: process.env.LMS_URL,
        username: process.env.LMS_USERNAME,
        password: process.env.LMS_PASSWORD
    });

    await page.getByRole('link', { name: 'Kelas' }).click();
    await page.waitForTimeout(2000);

    await page.getByRole('button', { name: /Filter/i }).click();
    await page.waitForTimeout(1500);

    const sidebarContent = page.locator('.sidebar-content').first();
    const html = await sidebarContent.innerHTML();

    const scratchDir = path.join(__dirname, '..', 'scratch');
    fs.writeFileSync(path.join(scratchDir, 'sidebar_full.html'), html, 'utf8');
    console.log('[DUMP] Berhasil menyimpan sidebar_full.html (panjang:', html.length, 'karakter)');

    await browser.close();
}

dumpSidebar().catch(console.error);
