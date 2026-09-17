require('dotenv').config();
const { spawn } = require('child_process');

/**
 * Script Perekam Aksi (Playwright Codegen)
 * Gunakan skrip ini untuk merekam alur kerja di portal operator LMS Anda.
 * 
 * Jalankan:
 * npm run record
 */

const targetUrl = process.argv[2] || process.env.LMS_URL || 'https://google.com';

console.log('====================================================');
console.log('  PLAYWRIGHT CODEGEN RECORDER (LMS OPERATOR)');
console.log('====================================================');
console.log(`Membuka URL target: ${targetUrl}`);
console.log('Petunjuk:');
console.log('1. Jendela browser dan jendela Playwright Inspector akan terbuka.');
console.log('2. Lakukan login dan aksi pengisian link Zoom seperti biasa.');
console.log('3. Playwright akan otomatis mencatat nama tombol, form input, dan link.');
console.log('4. Tutup jendela browser jika sudah selesai merekam.');
console.log('====================================================\n');

const codegen = spawn('npx', ['playwright', 'codegen', targetUrl], {
    shell: true,
    stdio: 'inherit'
});

codegen.on('close', (code) => {
    console.log(`[RECORDER] Perekam selesai dengan kode exit: ${code}`);
});
