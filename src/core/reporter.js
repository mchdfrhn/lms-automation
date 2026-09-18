const config = require('../config');

/**
 * Mengirim notifikasi teks ke bot/channel Telegram via Bot API
 */
async function sendTelegramMessage(text, options = {}) {
    const token = options.botToken || config.telegram.botToken;
    const chatId = options.chatId || config.telegram.chatId;

    if (!token || !chatId) {
        console.log('ℹ️ [TELEGRAM] Notifikasi dilewati (TELEGRAM_BOT_TOKEN atau TELEGRAM_CHAT_ID belum diatur di .env).');
        return { success: false, reason: 'unconfigured' };
    }

    const url = `https://api.telegram.org/bot${token}/sendMessage`;

    try {
        let response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: text,
                parse_mode: options.parseMode || 'Markdown',
                disable_web_page_preview: true
            })
        });

        let data = await response.json();

        // Jika Telegram menolak karena formatting markdown, fallback ke teks biasa
        if (!data.ok && data.description && data.description.includes("can't parse entities")) {
            console.warn('⚠️ [TELEGRAM] Gagal parse Markdown, mencoba kirim ulang sebagai teks biasa...');
            response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: text,
                    disable_web_page_preview: true
                })
            });
            data = await response.json();
        }

        if (data.ok) {
            console.log(`📲 [TELEGRAM] Laporan berhasil dikirim ke Chat ID: ${chatId}`);
            return { success: true, messageId: data.result?.message_id };
        } else {
            console.warn(`⚠️ [TELEGRAM] Gagal mengirim pesan: ${data.description}`);
            return { success: false, reason: data.description };
        }
    } catch (err) {
        console.error(`❌ [TELEGRAM] Terjadi error koneksi: ${err.message}`);
        return { success: false, reason: err.message };
    }
}

/**
 * Format Laporan Automasi Zoom untuk WhatsApp / Telegram
 */
function formatZoomReport({ targetDay, targetDate, courses }) {
    const dateObj = targetDate || new Date();
    const tglStr = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const now = new Date();
    const jamStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';

    const createdList = courses.filter(c => c.status === 'created');
    const alreadyList = courses.filter(c => c.status === 'already_exists');
    const noSessionList = courses.filter(c => c.status === 'no_session_today');
    const emptyList = courses.filter(c => c.status === 'empty_dropdown');
    const failedList = courses.filter(c => !['created', 'already_exists', 'no_session_today', 'complete', 'empty_dropdown'].includes(c.status));

    let headerStatus = '✅ *STATUS: SEMUA JADWAL AMAN & SESUAI*';
    if (failedList.length > 0) {
        headerStatus = `⚠️ *STATUS: ${failedList.length} MATA KULIAH MEMERLUKAN PERHATIAN*`;
    }

    let report = `📋 *LAPORAN AUTOMASI ZOOM CIVITAS LMS*\n`;
    report += `🗓️ *Jadwal :* ${targetDay}, ${tglStr}\n`;
    report += `⏰ *Waktu  :* ${jamStr}\n`;
    report += `🎓 *Target :* S1 Teknik Sipil (Kelas Sore)\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    report += `${headerStatus}\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    const semNames = { '1': 'Semester 1', '3': 'Semester 3', '5': 'Semester 5', '7': 'Semester 7' };

    for (const sem of ['1', '3', '5', '7']) {
        const list = courses.filter(c => c.semester === sem);
        if (list.length === 0) continue;

        report += `📚 *${semNames[sem]}* (${list.length} Mata Kuliah)\n`;

        list.forEach((c, idx) => {
            let badge = '✅ *Baru Terinput*';
            if (c.status === 'created') {
                badge = '✅ *Baru Terinput*';
            } else if (c.status === 'already_exists') {
                badge = '🔹 *Sudah Siap (Aman)*';
            } else if (c.status === 'no_session_today') {
                badge = '⚪ *Tidak Ada Jadwal Hari Ini*';
            } else if (c.status === 'empty_dropdown') {
                badge = '⚠️ *Dilewati (Praktikum / Non-Teori)*';
            } else if (c.status === 'complete') {
                badge = '🏁 *Sesi Lengkap*';
            } else {
                badge = `❌ *Gagal:* ${c.reason || 'Error'}`;
            }

            report += `${idx + 1}. *${c.nama}*\n`;
            report += `   • Kode / Slot : \`${c.kode}\` | *Slot ${c.slot}*\n`;
            if (c.dosen && c.dosen !== '-') report += `   • Dosen       : ${c.dosen}\n`;
            report += `   • Sesi        : ${c.meetingTitle} (${c.jam} WIB)\n`;
            report += `   • Status      : ${badge}\n\n`;
        });
    }

    // Sorotan Khusus Matkul Gabungan Hari Rabu (Semester 1 & 7) jika ada
    const gabunganRabu = courses.filter(c => ['PU 1209', 'PU 1210', 'ST 7105', 'ST 7106'].includes(c.kode));
    if (gabunganRabu.length > 0) {
        report += `🔗 *Pengecekan Matkul Gabungan (Sem 1 & Sem 7 - Hari Rabu):*\n`;
        const iot1 = courses.find(c => c.kode === 'PU 1209');
        const iot7 = courses.find(c => c.kode === 'ST 7105');
        if (iot1 || iot7) {
            const sameIot = (iot1 && iot7) ? (iot1.zoomUrl === iot7.zoomUrl ? '✅ Link Sama' : '❌ Link Beda!') : '🔹 Terjadwal';
            const slotName = (iot1 || iot7).slot;
            report += `• *Logika / Tekno Digital* ➔ Slot *${slotName}* (${sameIot})\n`;
        }
        const etika1 = courses.find(c => c.kode === 'PU 1210');
        const etika7 = courses.find(c => c.kode === 'ST 7106');
        if (etika1 || etika7) {
            const sameEtika = (etika1 && etika7) ? (etika1.zoomUrl === etika7.zoomUrl ? '✅ Link Sama' : '❌ Link Beda!') : '🔹 Terjadwal';
            const slotName = (etika1 || etika7).slot;
            report += `• *Etika Profesi* ➔ Slot *${slotName}* (${sameEtika})\n`;
        }
        report += `\n`;
    }

    // Sorotan Khusus Matkul Pilihan Hari Kamis jika ada
    const pilihanSem7 = courses.filter(c => ['TS 7472', 'TS 7473', 'TS 7474'].includes(c.kode));
    if (pilihanSem7.length > 0) {
        report += `⭐ *Pengecekan Matkul Pilihan (Kamis 19:00 WIB):*\n`;
        pilihanSem7.forEach(p => {
            let st = p.status;
            if (p.status === 'already_exists') st = 'Sudah Ada';
            else if (p.status === 'created') st = 'Baru Terinput';
            else if (p.status === 'no_session_today') st = 'Tidak Ada Sesi';
            report += `• *${p.nama}* ➔ Slot *${p.slot}* (${st})\n`;
        });
        report += `\n`;
    }

    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    report += `📊 *RINGKASAN EKSEKUSI:*\n`;
    report += `• Total Terjadwal : ${courses.length} mata kuliah\n`;
    report += `• Baru Terinput   : ${createdList.length}\n`;
    report += `• Sudah Terdaftar : ${alreadyList.length}\n`;
    if (noSessionList.length > 0) report += `• Tidak Ada Sesi  : ${noSessionList.length}\n`;
    if (emptyList.length > 0) report += `• Dilewati (Lab)  : ${emptyList.length}\n`;
    if (failedList.length > 0) report += `• Gagal/Perhatian : ${failedList.length}\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    report += `_Automasi LMS Civitas Operator • Status Valid_`;

    return report;
}

/**
 * Format Laporan Automasi Presensi Mahasiswa untuk WhatsApp / Telegram
 */
function formatPresensiReport({ targetDay, targetDate, results }) {
    const dateObj = targetDate || new Date();
    const tglStr = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const now = new Date();
    const jamStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';

    let report = `📋 *LAPORAN PRESENSI MAHASISWA LMS CIVITAS*\n`;
    report += `🗓️ *Jadwal :* ${targetDay}, ${tglStr}\n`;
    report += `⏰ *Waktu  :* ${jamStr}\n`;
    report += `🎓 *Target :* S1 Teknik Sipil (Kelas Sore)\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    results.forEach((item, idx) => {
        report += `${idx + 1}. *${item.nama}* (${item.kode})\n`;
        report += `   • Sesi     : ${item.sessionTitle || '-'}\n`;
        report += `   • Hadir    : ${item.hadirCount || 0} mahasiswa\n`;
        report += `   • Status   : ${item.statusText || item.status}\n\n`;
    });

    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    report += `_Presensi Automatis LMS Civitas_`;

    return report;
}

module.exports = {
    sendTelegramMessage,
    formatZoomReport,
    formatPresensiReport
};
