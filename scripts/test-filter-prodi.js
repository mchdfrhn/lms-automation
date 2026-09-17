require('dotenv').config();
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const auth = require('./auth');

async function testFilterProdi() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });

    await auth.login(page, {
        url: process.env.LMS_URL,
        username: process.env.LMS_USERNAME,
        password: process.env.LMS_PASSWORD
    });

    await page.getByRole('link', { name: 'Kelas' }).click();
    await page.waitForTimeout(2000);

    // Buka Filter
    await page.getByRole('button', { name: /Filter/i }).click();
    await page.waitForTimeout(1000);

    // Ambil setiap field container di sidebar
    const sidebar = page.locator('.b-sidebar, [class*="sidebar"]').first();
    
    // Dump HTML field-field di dalam sidebar agar tahu selector pastinya
    const fields = await sidebar.locator('> div, .sidebar-content > div, .b-sidebar-content > div').evaluateAll(els => {
        return els.map(e => ({
            tag: e.tagName,
            className: e.className,
            text: e.innerText.trim().slice(0, 100),
            html: e.outerHTML.slice(0, 200)
        }));
    });

    console.log('Structure of sidebar children:', fields);

    await browser.close();
}

testFilterProdi().catch(console.error);
