require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Script Perekam Aksi (Playwright Codegen)
 * Merekam setiap klik, input, dan navigasi di LMS Civitas,
 * lalu otomatis menyimpannya ke file scratch/recorded-steps.js.
 */

const targetUrl = process.argv[2] || process.env.LMS_URL || 'https://sttpu.operator.lms.civitas.id/';
const scratchDir = path.join(__dirname, '..', 'scratch');
if (!fs.existsSync(scratchDir)) {
    fs.mkdirSync(scratchDir, { recursive: true });
}

const outputFile = path.join(scratchDir, 'recorded-steps.js');

console.log('====================================================');
console.log('    PLAYWRIGHT CODEGEN RECORDER (LMS CIVITAS)       ');
console.log('====================================================');
console.log(`Target URL : ${targetUrl}`);
console.log(`Simpan ke  : scratch/recorded-steps.js`);
console.log('\nPetunjuk Penggunaan:');
console.log('1. Jendela browser Chromium dan jendela "Playwright Inspector" akan terbuka.');
console.log('2. Silakan login dan lakukan klik/centang presensi seperti yang biasa Anda lakukan.');
console.log('3. Setiap tombol yang Anda klik akan otomatis dicatat.');
console.log('4. Jika sudah selesai, cukup TUTUP jendela browser tersebut.');
console.log('5. Hasil rekaman kode akan otomatis tersimpan di: scratch/recorded-steps.js');
console.log('====================================================\n');

const codegen = spawn('npx', ['playwright', 'codegen', '-o', `"${outputFile}"`, targetUrl], {
    shell: true,
    stdio: 'inherit'
});

codegen.on('close', (code) => {
    console.log(`\n[RECORDER] Selesai! Kode rekaman tersimpan di: ${outputFile}`);
    console.log('Anda cukup memberi tahu saya "sudah direkam", nanti saya akan membaca file tersebut.');
});
