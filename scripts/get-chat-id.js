require('dotenv').config();
const { sendTelegramMessage } = require('./telegram');

async function main() {
    const token = process.env.TELEGRAM_BOT_TOKEN;

    console.log('===========================================================');
    console.log('       SETUP & PENGECEKAN BOT TELEGRAM LMS CIVITAS         ');
    console.log('===========================================================');

    if (!token) {
        console.error('❌ Error: TELEGRAM_BOT_TOKEN belum diisi di file .env!');
        console.log('\nLangkah-langkah pembuatan bot:');
        console.log('1. Buka aplikasi Telegram dan cari @BotFather');
        console.log('2. Kirim pesan: /newbot');
        console.log('3. Beri nama bot (contoh: LMS Operator Notifier)');
        console.log('4. Beri username bot yang berakhiran "bot" (contoh: farhan_lms_bot)');
        console.log('5. Salin token HTTP API yang diberikan BotFather ke file .env:');
        console.log('   TELEGRAM_BOT_TOKEN=123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ');
        console.log('===========================================================');
        process.exit(1);
    }

    try {
        // 1. Cek validitas token bot
        console.log('[1/3] Menghubungkan ke server Telegram API...');
        const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
        const meData = await meRes.json();

        if (!meData.ok) {
            console.error(`❌ Token tidak valid: ${meData.description}`);
            console.log('Pastikan token yang disalin dari @BotFather sudah benar.');
            process.exit(1);
        }

        console.log(`✅ Bot terdeteksi: @${meData.result.username} (${meData.result.first_name})`);

        // 2. Cek Chat ID dari pesan terbaru
        console.log('[2/3] Memeriksa interaksi pengguna dengan bot...');
        const updRes = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
        const updData = await updRes.json();

        let foundChat = null;
        if (updData.ok && updData.result && updData.result.length > 0) {
            // Ambil update terakhir yang memiliki message
            for (let i = updData.result.length - 1; i >= 0; i--) {
                const item = updData.result[i];
                if (item.message && item.message.chat) {
                    foundChat = item.message.chat;
                    break;
                }
            }
        }

        const currentEnvChatId = process.env.TELEGRAM_CHAT_ID;

        if (!foundChat && !currentEnvChatId) {
            console.log('\n⚠️ Belum terdeteksi pesan masuk ke bot!');
            console.log('👉 Silakan buka Telegram, cari bot Anda: @' + meData.result.username);
            console.log('👉 Klik tombol "START" atau kirim pesan apa saja (misal: "halo").');
            console.log('👉 Setelah itu, jalankan kembali perintah ini:');
            console.log('   npm run telegram:check\n');
            process.exit(0);
        }

        const targetChatId = currentEnvChatId || (foundChat ? foundChat.id : null);

        if (foundChat && !currentEnvChatId) {
            console.log('\n🎉 Berhasil mendeteksi akun Telegram Anda!');
            console.log(`   Nama     : ${foundChat.first_name || ''} ${foundChat.last_name || ''} (${foundChat.username ? '@' + foundChat.username : 'User'})`);
            console.log(`   Chat ID  : ${foundChat.id}`);
            console.log('\n👉 Silakan tambahkan Chat ID ini ke file .env Anda:');
            console.log(`   TELEGRAM_CHAT_ID=${foundChat.id}\n`);
        } else {
            console.log(`✅ Chat ID saat ini dari .env: ${currentEnvChatId}`);
        }

        // 3. Tes kirim pesan jika Chat ID sudah tersedia
        if (targetChatId) {
            console.log('[3/3] Mengirimkan pesan uji coba...');
            process.env.TELEGRAM_CHAT_ID = String(targetChatId);
            const testMsg = `🚀 *Tes Notifikasi Automasi LMS Berhasil!*\n\nBot *@${meData.result.username}* siap mengirimkan laporan eksekusi harian ke sini.\n\n🗓️ Waktu: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`;
            const sendRes = await sendTelegramMessage(testMsg);

            if (sendRes.success) {
                console.log('\n✨ PENGUJIAN SELESAI & SUKSES!');
                console.log('Pesan tes telah terkirim ke aplikasi Telegram Anda.');
            }
        }
        console.log('===========================================================');
    } catch (err) {
        console.error(`❌ Terjadi kesalahan: ${err.message}`);
    }
}

main();
