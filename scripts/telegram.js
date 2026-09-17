/**
 * Telegram Notification Module
 * Mengirimkan laporan automasi harian ke bot / channel Telegram menggunakan native fetch.
 */

async function sendTelegramMessage(text, options = {}) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
        console.log('ℹ️ [TELEGRAM] Notifikasi dilewati (TELEGRAM_BOT_TOKEN atau TELEGRAM_CHAT_ID belum diatur di .env).');
        return { success: false, reason: 'unconfigured' };
    }

    const url = `https://api.telegram.org/bot${token}/sendMessage`;

    try {
        // Coba kirim dengan format Markdown
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

        // Jika gagal karena karakter parsing markdown Telegram, fallback ke plain text
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

module.exports = {
    sendTelegramMessage
};
