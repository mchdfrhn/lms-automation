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

    const checkedList = results.filter(r => r.status === 'checked');
    const alreadyList = results.filter(r => r.status === 'already_checked');
    const previewList = results.filter(r => r.status === 'preview');
    const failedList = results.filter(r => !['checked', 'already_checked', 'preview'].includes(r.status));

    let headerStatus = '✅ *STATUS: SEMUA PRESENSI VIDCON TERPASANG*';
    if (previewList.length > 0 && failedList.length === 0) {
        headerStatus = '🔍 *STATUS: PRATINJAU (DRY RUN) SELESAI*';
    } else if (failedList.length > 0) {
        headerStatus = `⚠️ *STATUS: ${failedList.length} KELAS MEMERLUKAN PERHATIAN*`;
    }

    let report = `📋 *LAPORAN AUTOMASI PRESENSI LMS CIVITAS*\n`;
    report += `🗓️ *Jadwal :* ${targetDay}, ${tglStr}\n`;
    report += `⏰ *Waktu  :* ${jamStr}\n`;
    report += `🎓 *Target :* Aktivasi Presensi Vidcon (Kelas Sore)\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    report += `${headerStatus}\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    results.forEach((item, idx) => {
        let badge = '✅ *Baru Dicentang*';
        if (item.status === 'already_checked') {
            badge = '🔹 *Sudah Aktif (Aman)*';
        } else if (item.status === 'checked') {
            badge = '✅ *Baru Diaktifkan*';
        } else if (item.status === 'preview') {
            badge = '🔍 *Pratinjau (Siap Dicentang)*';
        } else {
            badge = `❌ *Gagal:* ${item.reason || 'Error'}`;
        }

        report += `${idx + 1}. *${item.nama}* (\`${item.kode}\`)\n`;
        report += `   • Dosen  : ${item.pengajar || '-'}\n`;
        report += `   • Sesi   : ${item.sessionTitle || 'Pertemuan 1'}\n`;
        report += `   • Status : ${badge}\n\n`;
    });

    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    report += `📊 *RINGKASAN EKSEKUSI PRESENSI:*\n`;
    report += `• Total Target   : ${results.length} mata kuliah\n`;
    if (checkedList.length > 0) report += `• Baru Diaktifkan: ${checkedList.length}\n`;
    if (alreadyList.length > 0) report += `• Sudah Aktif    : ${alreadyList.length}\n`;
    if (previewList.length > 0) report += `• Pratinjau (Dry): ${previewList.length}\n`;
    if (failedList.length > 0) report += `• Gagal/Perhatian: ${failedList.length}\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    report += `_Automasi Presensi Civitas LMS Operator_`;

    return report;
}

/**
 * Format Laporan Gabungan Terpadu (Zoom + Presensi) untuk WhatsApp / Telegram
 */
function formatUnifiedReport({ targetDay, targetDate, courses = [], presensiResults = [] }) {
    const dateObj = targetDate || new Date();
    const tglStr = dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const now = new Date();
    const jamStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';

    // Map hasil presensi berdasarkan kode mata kuliah
    const presensiMap = new Map();
    (presensiResults || []).forEach(p => {
        if (p && p.kode) presensiMap.set(p.kode.trim().toUpperCase(), p);
    });

    const semNames = { '1': 'Semester 1', '3': 'Semester 3', '5': 'Semester 5', '7': 'Semester 7' };

    // Evaluasi status kesehatan sistem secara keseluruhan
    const failedZoom = courses.filter(c => !['created', 'already_exists', 'no_session_today', 'complete', 'empty_dropdown'].includes(c.status));
    const failedPresensi = presensiResults.filter(p => !['checked', 'already_checked', 'preview'].includes(p.status));

    let headerStatus = '✅ *STATUS: SEMUA JADWAL & PRESENSI AMAN*';
    if (failedZoom.length > 0 || failedPresensi.length > 0) {
        const totalIssues = failedZoom.length + failedPresensi.length;
        headerStatus = `⚠️ *STATUS: ${totalIssues} PERHATIAN TERDETEKSI*`;
    }

    let report = `📋 *LAPORAN HARIAN TERPADU LMS CIVITAS*\n`;
    report += `🗓️ *Jadwal :* ${targetDay}, ${tglStr}\n`;
    report += `⏰ *Waktu  :* ${jamStr}\n`;
    report += `🎓 *Target :* S1 Teknik Sipil (Kelas Sore)\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    report += `${headerStatus}\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    let totalPresensiActive = 0;
    let totalZoomActive = 0;

    for (const sem of ['1', '3', '5', '7']) {
        const list = courses.filter(c => c.semester === sem);
        if (list.length === 0) continue;

        report += `📚 *${semNames[sem]}* (${list.length} Mata Kuliah)\n`;

        list.forEach((c, idx) => {
            const presensiItem = presensiMap.get(c.kode.trim().toUpperCase());

            // Badge status Zoom
            let zoomBadge = '';
            if (c.status === 'created') {
                zoomBadge = `✅ *Baru Terinput* (Slot ${c.slot || '-'})`;
                totalZoomActive++;
            } else if (c.status === 'already_exists') {
                zoomBadge = `🔹 *Sudah Siap* (Slot ${c.slot || '-'})`;
                totalZoomActive++;
            } else if (c.status === 'no_session_today') {
                zoomBadge = `⚪ *Tidak Ada Jadwal Hari Ini*`;
            } else if (c.status === 'empty_dropdown') {
                zoomBadge = `⚠️ *Dilewati (Praktikum / Non-Teori)*`;
            } else if (c.status === 'complete') {
                zoomBadge = `🏁 *Sesi Lengkap*`;
                totalZoomActive++;
            } else {
                zoomBadge = `❌ *Gagal:* ${c.reason || 'Error'}`;
            }

            // Badge status Presensi Mahasiswa
            let presensiBadge = '';
            if (presensiItem) {
                if (presensiItem.status === 'already_checked') {
                    presensiBadge = `🔹 *Sudah Aktif (Ikut Vidcon)*`;
                    totalPresensiActive++;
                } else if (presensiItem.status === 'checked') {
                    presensiBadge = `✅ *Baru Diaktifkan (Ikut Vidcon)*`;
                    totalPresensiActive++;
                } else if (presensiItem.status === 'preview') {
                    presensiBadge = `🔍 *Pratinjau (Siap Dicentang)*`;
                } else {
                    presensiBadge = `❌ *Gagal:* ${presensiItem.reason || presensiItem.status}`;
                }
            } else {
                if (c.status === 'no_session_today') {
                    presensiBadge = `⚪ *Dilewati (Tidak Ada Zoom)*`;
                } else if (c.status === 'empty_dropdown') {
                    presensiBadge = `⚪ *Dilewati (Praktikum)*`;
                } else {
                    presensiBadge = `⚪ *Belum Diproses*`;
                }
            }

            report += `${idx + 1}. *${c.nama}* (\`${c.kode}\`)\n`;
            if (c.dosen && c.dosen !== '-') report += `   • Dosen    : ${c.dosen}\n`;
            const sesiStr = c.meetingTitle && c.meetingTitle !== '-' ? `${c.meetingTitle} (${c.jam} WIB)` : `${c.jam} WIB`;
            report += `   • Sesi     : ${sesiStr}\n`;
            report += `   • Link Zoom: ${zoomBadge}\n`;
            report += `   • Presensi : ${presensiBadge}\n\n`;
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
    report += `📊 *RINGKASAN EKSEKUSI TERPADU:*\n`;
    report += `• Total Terjadwal : ${courses.length} mata kuliah\n`;
    report += `• Zoom Siap / Ada : ${totalZoomActive} mata kuliah\n`;
    report += `• Presensi Aktif  : ${totalPresensiActive} mata kuliah\n`;
    const noSessionCount = courses.filter(c => c.status === 'no_session_today').length;
    if (noSessionCount > 0) report += `• Tanpa Jadwal    : ${noSessionCount} mata kuliah\n`;
    const emptyCount = courses.filter(c => c.status === 'empty_dropdown').length;
    if (emptyCount > 0) report += `• Dilewati (Lab)  : ${emptyCount} mata kuliah\n`;
    if (failedZoom.length > 0 || failedPresensi.length > 0) {
        report += `• Gagal/Perhatian : ${failedZoom.length + failedPresensi.length} mata kuliah\n`;
    }
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    report += `_Automasi Terpadu Civitas LMS Operator_`;

    return report;
}

module.exports = {
    sendTelegramMessage,
    formatZoomReport,
    formatPresensiReport,
    formatUnifiedReport
};
