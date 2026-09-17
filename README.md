# LMS Operator Automation (Playwright + n8n)

Automasi browser untuk input link Zoom perkuliahan daring per mata kuliah & dosen di portal operator LMS Civitas (STTPU). Dilengkapi penanganan auto-relogin jika sesi terputus (5 menit timeout) dan filter eksekusi harian otomatis.

> 📖 **Panduan Perintah Lengkap**: Lihat [`COMMANDS.md`](COMMANDS.md) untuk daftar perintah CLI, filter hari, opsi pengujian, dan manajemen link Zoom.

---

## 📁 Struktur Folder

```text
c:\lms-automation\
├── .env                      # URL LMS, username, password, dan pengaturan
├── data/
│   ├── jadwal_zoom.xlsx      # File Excel daftar mata kuliah & link Zoom
│   └── jadwal_zoom.json      # File JSON (alternatif)
├── scripts/
│   ├── auth.js               # Handler login & deteksi session timeout (5 menit)
│   ├── input-zoom.js         # Skrip eksekusi utama pengisian link Zoom
│   ├── record.js             # Perekam aksi / selector visual (Playwright Codegen)
│   └── create-sample-data.js # Generator data contoh
└── n8n-workflows/
    └── lms-daily-workflow.json # Template alur kerja untuk n8n
```

---

## 🚀 Panduan Penggunaan Cepat

### Langkah 1: Atur File `.env`
Buka file `.env` di text editor, lalu masukkan kredensial portal operator Anda:
```env
LMS_URL=https://lms.kampus-anda.ac.id/login
LMS_USERNAME=username_operator_anda
LMS_PASSWORD=password_anda
HEADLESS=false
DATA_FILE=data/jadwal_zoom.xlsx
```
*(Gunakan `HEADLESS=false` agar Anda bisa melihat proses pengisian di layar monitor)*

### Langkah 2: Siapkan Jadwal di Excel
Buka `data/jadwal_zoom.xlsx`. Sesuaikan kolom:
- `kode_matkul` / `mata_kuliah`
- `dosen`
- `pertemuan`
- `link_zoom`
- `passcode`

### Langkah 3 (Penting): Rekam Selector LMS Anda
Setiap portal LMS memiliki susunan tombol dan form yang berbeda. Jalankan:
```bash
npm run record
```
Browser Chromium dan panel perekam Playwright akan terbuka otomatis.  
Lakukan pengisian 1 link Zoom secara manual:
- Playwright akan mencatat selector yang tepat (misal ID kolom input link Zoom, tombol submit).
- Anda tinggal menyalin selector tersebut ke fungsi `processCourseZoom` di file `scripts/input-zoom.js`.

### Langkah 4: Jalankan Automasi
Setelah selector disesuaikan, jalankan automasi:
```bash
npm run zoom
```
Skrip akan:
1. Login ke LMS.
2. Membaca daftar perkuliahan dari Excel.
3. Otomatis mengisi link Zoom tiap mata kuliah.
4. Jika sesi ter-logout (5 menit timeout), skrip otomatis login kembali tanpa gagal.
5. Memperbarui kolom `status` di file Excel menjadi `SUKSES` atau `GAGAL`.

---

## ⏰ Integrasi Penjadwalan dengan n8n

Untuk menjalankan skrip ini secara otomatis setiap pagi (misal jam 07:00):
1. Jalankan n8n di komputer Anda:
   ```bash
   npm run n8n
   ```
2. Buka `http://localhost:5678` di browser Anda.
3. Buat workflow baru dan pilih **Import from File**, lalu pilih file:
   `c:\lms-automation\n8n-workflows\lms-daily-workflow.json`
4. Aktifkan workflow tersebut. n8n akan otomatis memicu Playwright setiap hari sesuai jadwal cron!
