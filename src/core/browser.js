const { chromium } = require('playwright');
const config = require('../config');

/**
 * Launch Chromium browser and return context & page
 */
async function createBrowserSession(options = {}) {
    const headless = options.headless !== undefined ? options.headless : config.lms.headless;

    const browser = await chromium.launch({
        headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const context = await browser.newContext({
        viewport: { width: 1366, height: 768 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();

    return {
        browser,
        context,
        page,
        async close() {
            try {
                await context.close();
                await browser.close();
            } catch (err) {
                // Ignore errors during closing
            }
        }
    };
}

module.exports = {
    createBrowserSession
};
