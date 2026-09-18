/**
 * Parser Data Kehadiran Mahasiswa pada Civitas LMS
 */

/**
 * Ekstraksi baris tabel presensi mahasiswa
 * @param {import('playwright').Page} page
 */
async function parseAttendanceTable(page) {
    const rows = page.locator('table tbody tr');
    const rowCount = await rows.count();
    const students = [];

    for (let i = 0; i < rowCount; i++) {
        const row = rows.nth(i);
        const text = await row.innerText();
        const cells = await row.locator('td').allInnerTexts();

        if (cells.length >= 4) {
            students.push({
                index: i + 1,
                no: cells[0]?.trim(),
                mahasiswa: cells[1]?.trim(),
                progres: cells[2]?.trim(),
                kehadiran: cells[3]?.trim(),
                updated: cells[4]?.trim() || '-'
            });
        }
    }

    return students;
}

module.exports = {
    parseAttendanceTable
};
