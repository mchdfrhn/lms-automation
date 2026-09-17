require('dotenv').config();
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const auth = require('./auth');

async function inspectFilter() {
    const browser = await chromium.launch({ headless: true }); // headless for quick screenshot
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });

    const lmsUrl = process.env.LMS_URL;
    const username = process.env.LMS_USERNAME;
    const password = process.env.LMS_PASSWORD;

    await auth.login(page, { url: lmsUrl, username, password });
    console.log('[INSPECT] Berhasil login. Menuju /kelas...');

    await page.getByRole('link', { name: 'Kelas' }).click();
    await page.waitForTimeout(3000);

    const scratchDir = path.join(__dirname, '..', 'scratch');
    if (!fs.existsSync(scratchDir)) fs.mkdirSync(scratchDir, { recursive: true });

    await page.screenshot({ path: path.join(scratchDir, '1_menu_kelas.png') });
    console.log('[INSPECT] Screenshot menu Kelas disimpan.');

    const filterBtn = page.getByRole('button', { name: /Filter/i });
    if (await filterBtn.isVisible()) {
        await filterBtn.click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: path.join(scratchDir, '2_filter_opened.png') });
        console.log('[INSPECT] Screenshot Filter sidebar disimpan.');

        // Dump HTML sidebar
        const sidebar = page.locator('.b-sidebar, .sidebar, form').first();
        if (await sidebar.isVisible().catch(() => false)) {
            const html = await sidebar.innerHTML();
            fs.writeFileSync(path.join(scratchDir, 'sidebar.html'), html, 'utf8');
            console.log('[INSPECT] HTML sidebar disimpan di scratch/sidebar.html');
        }
    }

    await browser.close();
    console.log('[INSPECT] Selesai!');
}

inspectFilter().catch(console.error);
