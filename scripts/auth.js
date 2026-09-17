const path = require('path');
const fs = require('fs');

/**
 * Otomatisasi Login & Penanganan Sesi Civitas LMS
 * Khusus: sttpu.operator.lms.civitas.id
 */

async function isLoginPage(page) {
    const currentUrl = page.url().toLowerCase();
    if (currentUrl.includes('login') || currentUrl.includes('signin') || currentUrl.includes('auth')) {
        return true;
    }

    const passwordInput = page.getByRole('textbox', { name: 'Password' }).first();
    if (await passwordInput.isVisible().catch(() => false)) {
        return true;
    }

    return false;
}

async function login(page, { url, username, password }) {
    console.log(`[AUTH] Membuka Civitas LMS: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });

    // Tunggu input username atau password muncul
    const userInput = page.getByRole('textbox', { name: 'Username' }).first().or(page.locator('input[type="text"]').first());
    const passInput = page.getByRole('textbox', { name: 'Password' }).first().or(page.locator('input[type="password"]').first());

    await userInput.waitFor({ state: 'visible', timeout: 20000 });

    console.log(`[AUTH] Mengisi username: ${username}`);
    await userInput.fill(username);

    console.log('[AUTH] Mengisi password...');
    await passInput.fill(password);

    console.log('[AUTH] Mengklik Login Civitas LMS...');
    const loginButton = page.getByRole('button', { name: 'Login Civitas LMS' }).first().or(page.locator('button[type="submit"]').first());

    await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
        loginButton.click(),
    ]);

    await page.waitForTimeout(2000);
    console.log(`[AUTH] Berhasil masuk! URL sekarang: ${page.url()}`);
}

async function ensureLoggedIn(page, credentials) {
    if (await isLoginPage(page)) {
        console.warn('⚠️ [AUTH] Sesi terputus (logout otomatis 5 menit). Melakukan auto-relogin...');
        await login(page, credentials);
        return true;
    }
    return false;
}

module.exports = {
    isLoginPage,
    login,
    ensureLoggedIn,
};
