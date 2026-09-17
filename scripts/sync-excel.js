const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const dataDir = path.join(__dirname, '..', 'data');
const jsonPath = path.join(dataDir, 'jadwal_zoom.json');
const matkulJsonPath = path.join(dataDir, 'daftar_matkul.json');

const zoomData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const matkulData = JSON.parse(fs.readFileSync(matkulJsonPath, 'utf8'));

// Simpan Excel dengan 2 Sheet
const workbook = xlsx.utils.book_new();

// Sheet 1: Link Zoom
const wsZoom = xlsx.utils.json_to_sheet(zoomData);
xlsx.utils.book_append_sheet(workbook, wsZoom, 'LinkZoom');

// Sheet 2: Daftar Mata Kuliah
const flatMatkul = [];
for (const [sem, list] of Object.entries(matkulData)) {
    list.forEach(m => {
        flatMatkul.push({
            semester: sem,
            kode_slot: m.kode_slot,
            kode_matkul: m.kode,
            mata_kuliah: m.nama,
            pengajar: m.pengajar
        });
    });
}
const wsMatkul = xlsx.utils.json_to_sheet(flatMatkul);
xlsx.utils.book_append_sheet(workbook, wsMatkul, 'DaftarMatkul');

const excelPath = path.join(dataDir, 'jadwal_zoom.xlsx');
try {
    xlsx.writeFile(workbook, excelPath);
    console.log(`[EXCEL] Berhasil memperbarui: ${excelPath}`);
} catch (e) {
    console.warn(`[EXCEL] Gagal update file Excel: ${e.message}`);
}
