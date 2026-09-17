const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// 1. Data Sederhana: Hanya Semester, Link Zoom, & Passcode
const sampleZoomData = [
    {
        semester: 1,
        link_zoom: 'https://us04web.zoom.us/j/1111111111?pwd=samplepassword1',
        passcode: '123456',
        status: 'PENDING',
        catatan: ''
    },
    {
        semester: 2,
        link_zoom: 'https://us04web.zoom.us/j/2222222222?pwd=samplepassword2',
        passcode: '123456',
        status: 'PENDING',
        catatan: ''
    },
    {
        semester: 3,
        link_zoom: 'https://us04web.zoom.us/j/3333333333?pwd=samplepassword3',
        passcode: '123456',
        status: 'PENDING',
        catatan: ''
    },
    {
        semester: 4,
        link_zoom: 'https://us04web.zoom.us/j/4444444444?pwd=samplepassword4',
        passcode: '123456',
        status: 'PENDING',
        catatan: ''
    },
    {
        semester: 5,
        link_zoom: 'https://us04web.zoom.us/j/5555555555?pwd=samplepassword5',
        passcode: '123456',
        status: 'PENDING',
        catatan: ''
    },
    {
        semester: 6,
        link_zoom: 'https://us04web.zoom.us/j/6666666666?pwd=samplepassword6',
        passcode: '123456',
        status: 'PENDING',
        catatan: ''
    },
    {
        semester: 7,
        link_zoom: 'https://us04web.zoom.us/j/7777777777?pwd=samplepassword7',
        passcode: '123456',
        status: 'PENDING',
        catatan: ''
    },
    {
        semester: 8,
        link_zoom: 'https://us04web.zoom.us/j/8888888888?pwd=samplepassword8',
        passcode: '123456',
        status: 'PENDING',
        catatan: ''
    }
];

// 2. Daftar Pemetaan Mata Kuliah per Semester (Placeholder untuk diisi oleh user)
const sampleMatkulPerSemester = {
    "1": [
        "Algoritma dan Pemrograman",
        "Pengantar Teknologi Informasi",
        "Matematika Diskrit",
        "Pendidikan Pancasila"
    ],
    "2": [
        "Struktur Data",
        "Arsitektur Komputer",
        "Kalkulus"
    ],
    "3": [
        "Sistem Basis Data",
        "Sistem Operasi",
        "Pemrograman Berorientasi Objek"
    ],
    "4": [
        "Jaringan Komputer",
        "Analisis Desain Sistem",
        "Statistika dan Probabilitas"
    ],
    "5": [
        "Rekayasa Perangkat Lunak",
        "Kecerdasan Buatan",
        "Pemrograman Web"
    ],
    "6": [
        "Keamanan Siber",
        "Cloud Computing",
        "Mobile Programming"
    ],
    "7": [
        "Metodologi Penelitian",
        "Data Science",
        "Kerja Praktik"
    ],
    "8": [
        "Skripsi / Tugas Akhir"
    ]
};

// Buat File JSON
const jsonPath = path.join(dataDir, 'jadwal_zoom.json');
fs.writeFileSync(jsonPath, JSON.stringify(sampleZoomData, null, 2), 'utf8');

const matkulJsonPath = path.join(dataDir, 'daftar_matkul.json');
fs.writeFileSync(matkulJsonPath, JSON.stringify(sampleMatkulPerSemester, null, 2), 'utf8');

// Buat File Excel dengan 2 Sheet:
// Sheet 1: JadwalZoom (semester & link)
// Sheet 2: DaftarMatkul (mata kuliah & semester)
const workbook = xlsx.utils.book_new();

const wsZoom = xlsx.utils.json_to_sheet(sampleZoomData);
xlsx.utils.book_append_sheet(workbook, wsZoom, 'JadwalZoom');

// Flatten matkul untuk Sheet 2 agar mudah dibaca di Excel
const flatMatkul = [];
for (const [sem, list] of Object.entries(sampleMatkulPerSemester)) {
    list.forEach((matkul, idx) => {
        flatMatkul.push({
            semester: Number(sem),
            mata_kuliah: matkul
        });
    });
}
const wsMatkul = xlsx.utils.json_to_sheet(flatMatkul);
xlsx.utils.book_append_sheet(workbook, wsMatkul, 'DaftarMatkul');

try {
    const excelPath = path.join(dataDir, 'jadwal_zoom.xlsx');
    xlsx.writeFile(workbook, excelPath);
    console.log(`[DATA] File Excel dibuat: ${excelPath}`);
} catch (e) {
    if (e.code === 'EBUSY') {
        const altPath = path.join(dataDir, 'jadwal_zoom_template.xlsx');
        xlsx.writeFile(workbook, altPath);
        console.warn(`[PERHATIAN] File jadwal_zoom.xlsx sedang dibuka di Microsoft Excel.`);
        console.log(`[DATA] Template alternatif disimpan di: ${altPath}`);
    } else {
        throw e;
    }
}
console.log(`[DATA] File JSON jadwal dibuat: ${jsonPath}`);
console.log(`[DATA] File JSON pemetaan matkul dibuat: ${matkulJsonPath}`);
