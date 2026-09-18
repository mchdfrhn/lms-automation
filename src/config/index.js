require('dotenv').config();
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const LOGS_DIR = path.join(ROOT_DIR, 'logs');

const HARI_MAP = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MONTH_NAMES = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

module.exports = {
    ROOT_DIR,
    DATA_DIR,
    LOGS_DIR,
    HARI_MAP,
    MONTH_NAMES,
    lms: {
        url: process.env.LMS_URL || 'https://sttpu.operator.lms.civitas.id/',
        username: process.env.LMS_USERNAME,
        password: process.env.LMS_PASSWORD,
        headless: process.env.HEADLESS === 'true'
    },
    telegram: {
        botToken: process.env.TELEGRAM_BOT_TOKEN,
        chatId: process.env.TELEGRAM_CHAT_ID
    },
    paths: {
        zoomJson: path.join(DATA_DIR, 'jadwal_zoom.json'),
        zoomExcel: path.join(DATA_DIR, 'jadwal_zoom.xlsx'),
        matkulJson: path.join(DATA_DIR, 'daftar_matkul.json'),
        logsDir: LOGS_DIR
    }
};
