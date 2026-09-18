/**
 * Reusable Navigation Helpers for Civitas LMS
 */

async function goToKelas(page) {
    const kelasLink = page.getByRole('link', { name: 'Kelas' }).first();
    await kelasLink.click();
    await page.waitForTimeout(2000);
}

async function searchAndOpenCourse(page, course, options = {}) {
    const classType = options.classType || 'Kelas Sore';
    const courseCode = typeof course === 'string' ? course : course.kode;
    const courseName = typeof course === 'string' ? course : course.nama;

    await goToKelas(page);

    const searchInput = page.getByPlaceholder(/Cari ID kelas/i).first();
    await searchInput.fill(courseCode);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    let targetRow = page.locator('table tr')
        .filter({ hasText: classType })
        .filter({ hasText: courseCode })
        .first();

    if (!await targetRow.isVisible().catch(() => false)) {
        targetRow = page.locator('table tr')
            .filter({ hasText: classType })
            .filter({ hasText: courseName })
            .first();
    }

    if (!await targetRow.isVisible({ timeout: 4000 }).catch(() => false)) {
        return { success: false, reason: `Baris ${classType} untuk '${courseName}' (${courseCode}) tidak ditemukan di tabel.` };
    }

    const lihatBtn = targetRow.locator('button:has-text("Lihat")').first();
    await lihatBtn.click();
    await page.waitForTimeout(2500);

    return { success: true };
}

async function openCourseTab(page, tabName) {
    const tab = page.getByText(tabName, { exact: true }).first();
    if (!await tab.isVisible({ timeout: 5000 }).catch(() => false)) {
        return false;
    }
    await tab.click();
    await page.waitForTimeout(2000);
    return true;
}

async function openSessionDetail(page, sessionIndexOrNumber = 1) {
    // Di tab Pertemuan, klik tombol Lihat pada sesi yang dituju
    const lihatBtns = page.locator('.tab-content button:has-text("Lihat")');
    const count = await lihatBtns.count();
    if (count === 0) return false;

    const idx = Math.max(0, Math.min(sessionIndexOrNumber - 1, count - 1));
    await lihatBtns.nth(idx).click();
    await page.waitForTimeout(2500);
    return true;
}

module.exports = {
    goToKelas,
    searchAndOpenCourse,
    openCourseTab,
    openSessionDetail
};
