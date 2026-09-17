const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'scratch', 'sidebar_full.html'), 'utf8');

// Cari bagian-bagian label
const sections = html.split('text-big-button is-black');
sections.forEach((sec, idx) => {
    if (idx === 0) return;
    const labelMatch = sec.match(/^[^>]*>([^<]+)<\/div>/);
    const label = labelMatch ? labelMatch[1] : 'Unknown';
    console.log(`\n=== Section [${label}] ===`);

    // Cari input atau select atau button di dalam section ini (ambil 800 karakter pertama)
    const snippet = sec.slice(0, 800);
    const inputs = snippet.match(/<(input|select|button|a)[^>]*>/gi) || [];
    console.log('Inputs/controls:', inputs);
});

// Cek tombol Terapkan
const btnMatches = html.match(/<button[^>]*>[^<]*Terapkan[^<]*<\/button>/gi);
console.log('\nTombol Terapkan:', btnMatches);
