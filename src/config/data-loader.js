const fs = require('fs');
const xlsx = require('xlsx');
const config = require('./index');

/**
 * Membaca data link zoom per slot (1, 3, 5, 7a, 7b, 7c) dengan auto-sync XLSX <-> JSON
 */
function getZoomSlots() {
    const jsonFile = config.paths.zoomJson;
    const excelFile = config.paths.zoomExcel;

    const hasJson = fs.existsSync(jsonFile);
    const hasExcel = fs.existsSync(excelFile);

    if (!hasJson && !hasExcel) {
        throw new Error('Tidak ditemukan file jadwal_zoom.json maupun jadwal_zoom.xlsx di folder data!');
    }

    let activeSource = 'json';
    if (hasJson && hasExcel) {
        const jsonTime = fs.statSync(jsonFile).mtimeMs;
        const excelTime = fs.statSync(excelFile).mtimeMs;
        activeSource = excelTime > jsonTime ? 'excel' : 'json';
    } else if (hasExcel) {
        activeSource = 'excel';
    }

    let list = [];
    if (activeSource === 'excel') {
        console.log(`📄 [DATA] Menggunakan data dari: jadwal_zoom.xlsx`);
        const wb = xlsx.readFile(excelFile);
        list = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        try {
            fs.writeFileSync(jsonFile, JSON.stringify(list, null, 2), 'utf8');
        } catch (e) {
            console.warn('⚠️ Gagal auto-update jadwal_zoom.json:', e.message);
        }
    } else {
        console.log(`📄 [DATA] Menggunakan data dari: jadwal_zoom.json`);
        list = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
    }

    const slotMap = new Map();
    list.forEach(item => {
        const key = String(item.kode_slot || item.semester).toLowerCase().trim();
        slotMap.set(key, {
            kode_slot: key,
            keterangan: item.keterangan || '',
            link_zoom: (item.link_zoom || '').trim()
        });
    });

    return slotMap;
}

/**
 * Membaca daftar mata kuliah Semester 3, 5, 7 dari JSON
 */
function getCourses() {
    const matkulFile = config.paths.matkulJson;
    if (!fs.existsSync(matkulFile)) {
        throw new Error(`File daftar mata kuliah tidak ditemukan: ${matkulFile}`);
    }
    return JSON.parse(fs.readFileSync(matkulFile, 'utf8'));
}

/**
 * Filter daftar mata kuliah berdasarkan nama hari
 */
function getCoursesByDay(dayName) {
    const allCourses = getCourses();
    return allCourses.filter(c => c.hari && c.hari.toLowerCase() === dayName.toLowerCase());
}

module.exports = {
    getZoomSlots,
    getCourses,
    getCoursesByDay
};
