require('dotenv').config();
const { chromium } = require('playwright');
const path = require('path');
const auth = require('./auth');

async function testSingleFull() {
    const browser = await chromium.launch({ headless: false, slowMo: 100 });
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });

    await auth.login(page, {
        url: process.env.LMS_URL,
        username: process.env.LMS_USERNAME,
        password: process.env.LMS_PASSWORD
    });

    console.log('[STEP 1] Membuka menu Kelas...');
    await page.getByRole('link', { name: 'Kelas' }).click();
    await page.waitForTimeout(2000);

    console.log('[STEP 2] Mencari "TS 3325" di kotak Cari ID kelas...');
    const searchInput = page.getByPlaceholder(/Cari ID kelas/i).first();
    await searchInput.fill('TS 3325');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    console.log('[STEP 3] Mencari baris "Kelas Sore"...');
    const soreRow = page.locator('table tr').filter({ hasText: 'Kelas Sore' }).filter({ hasText: 'TS 3325' }).first();
    await soreRow.waitFor({ state: 'visible', timeout: 5000 });

    console.log('[STEP 4] Mengklik tombol "Lihat"...');
    const lihatBtn = soreRow.locator('button:has-text("Lihat")').first();
    await lihatBtn.click();
    await page.waitForTimeout(3000);

    console.log('[STEP 5] Screenshot halaman detail kelas...');
    const scratchDir = path.join(__dirname, '..', 'scratch');
    await page.screenshot({ path: path.join(scratchDir, '3_detail_kelas.png') });
    console.log(`URL saat ini: ${page.url()}`);

    // Cek tab Vidcon
    console.log('[STEP 6] Mencari Tab Vidcon...');
    const vidconTab = page.locator('[id$="-label"]').filter({ hasText: /Vidcon/i })
        .or(page.getByText('Vidcon', { exact: true }))
        .or(page.locator('a, button, li, div').filter({ hasText: /^Vidcon$/i }))
        .first();

    if (await vidconTab.isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log('[STEP 6] Tab Vidcon ditemukan, mengklik...');
        await vidconTab.click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: path.join(scratchDir, '4_vidcon_tab.png') });
    } else {
        console.log('[STEP 6] Tab Vidcon tidak terdeteksi langsung.');
    }

    console.log('[STEP 7] Selesai uji coba navigasi!');
    await browser.close();
}

testSingleFull().catch(console.error);
