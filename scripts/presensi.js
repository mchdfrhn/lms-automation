require('dotenv').config();
const config = require('../src/config');
const { runPresensiAutomation } = require('../src/modules/presensi/service');

/**
 * =========================================================================
 * CLI ENTRYPOINT: AUTOMASI PRESENSI MAHASISWA CIVITAS LMS
 * =========================================================================
 * Penggunaan:
 *   node scripts/presensi.js
 *   node scripts/presensi.js --dry-run
 *   node scripts/presensi.js --matkul "TS 3329"
 *   node scripts/presensi.js --session 1
 *   node scripts/presensi.js --day Senin
 *   node scripts/presensi.js --notify
 */

async function main() {
    const args = process.argv.slice(2);

    if (args.includes('--help') || args.includes('-h')) {
        console.log(`
Penggunaan CLI Presensi Mahasiswa LMS:
  node scripts/presensi.js [options]

Opsi:
  --today                 Presensi untuk jadwal hari ini (default)
  --day <nama_hari>       Presensi untuk nama hari tertentu (e.g. Senin, Selasa)
  --session <nomor>       Nomor pertemuan (default: 1)
  --matkul <kode/nama>    Target spesifik mata kuliah tertentu (e.g. "TS 3329")
  --dry-run               Mode pratinjau (tidak menyimpan perubahan)
  --notify                Kirim laporan hasil ke Telegram
  --limit <jumlah>        Batasi jumlah mata kuliah yang diproses
  --help, -h              Tampilkan panduan ini
`);
        return;
    }

    const dayIdx = args.findIndex(a => a === '--day' || a === '-d');
    const sessionIdx = args.findIndex(a => a === '--session' || a === '-s');
    const matkulIdx = args.findIndex(a => a === '--matkul' || a === '-m');
    const limitIdx = args.findIndex(a => a === '--limit' || a === '-l');

    const day = dayIdx !== -1 ? args[dayIdx + 1] : null;
    const session = sessionIdx !== -1 ? parseInt(args[sessionIdx + 1], 10) : 1;
    const courseCode = matkulIdx !== -1 ? args[matkulIdx + 1] : null;
    const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : null;
    const dryRun = args.includes('--dry-run');
    const notify = args.includes('--notify');

    await runPresensiAutomation({
        day,
        session,
        courseCode,
        limit,
        dryRun,
        notify
    });
}

if (require.main === module) {
    main().catch(err => {
        console.error('Fatal unhandled error:', err);
        process.exit(1);
    });
}

module.exports = {
    main,
    runPresensiAutomation
};
