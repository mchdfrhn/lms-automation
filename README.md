# 🎓 LMS Civitas Operator Automation (STTPU)
> **Automasi Input Link Vidcon / Zoom Civitas LMS S1 Teknik Sipil (Kelas Sore) dengan Notifikasi Bot Telegram & Integrasi Penjadwalan n8n.**

[![Playwright](https://img.shields.io/badge/Playwright-Automated_Browser-45ba4b.svg)](https://playwright.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-v24+-339933.svg)](https://nodejs.org/)
[![Telegram](https://img.shields.io/badge/Telegram-Bot_Notification-0088cc.svg)](https://telegram.org/)
[![n8n](https://img.shields.io/badge/n8n-Workflow_Automation-ea4b71.svg)](https://n8n.io/)

---

## 🌟 Fitur Utama Sistem

* 📅 **Eksekusi Harian Cerdas (*Smart Daily Filter*)**:
  Mendeteksi hari sistem secara otomatis (Senin s/d Jumat) dan hanya mengeksekusi mata kuliah yang terjadwal pada hari tersebut. Akhir pekan (Sabtu/Minggu) otomatis libur tanpa membuka browser.
* 🛡️ **Proteksi Sesi Ganda (*Idempotent & Anti-Lompat Minggu*)**:
  Sistem mengecek apakah vidcon pertemuan hari ini sudah pernah dibuat sebelumnya. Jika sudah ada, sistem melewatinya (*skip*) dengan status aman dan tidak akan membuat pertemuan minggu depan lebih awal secara tidak sengaja.
* 🎓 **Cakupan 37 Mata Kuliah Lengkap**:
  Mencakup seluruh perkuliahan Kelas Sore S1 Teknik Sipil: Semester 1 (3 matkul), Semester 3 (10 matkul), Semester 5 (12 matkul), dan Semester 7 (12 matkul).
* 🔗 **Penyelarasan Kelas Gabungan (Semester 1 & 7)**:
  Mata kuliah *Logika Teknologi / Transformasi Digital* dan *Etika Profesi* pada hari Rabu malam otomatis diselaraskan menggunakan link Zoom yang sama (**Slot `7a`**) disertai validasi integritas otomatis sebelum eksekusi.
* ⭐ **Dukungan Mata Kuliah Pilihan**:
  Mata kuliah pilihan hari Kamis 19:00 WIB otomatis dipisahkan ke 3 slot Zoom independen:
  * *Perencanaan Bangunan Gedung* $\rightarrow$ **Slot `7a`**
  * *Perencanaan Bangunan SDA* $\rightarrow$ **Slot `7b`**
  * *Perencanaan Bangunan Jalan dan Jembatan* $\rightarrow$ **Slot `7c`**
* 🤖 **Laporan Otomatis ke Bot Telegram**:
  Setiap kali automasi selesai berjalan, rekapan hasil eksekusi langsung dikirimkan ke aplikasi Telegram Anda dengan format ringkas, rapi, dan mudah dibaca.
* 🔄 **Penanganan Sesi Logout Otomatis (*5-Minute Session Timeout*)**:
  Jika sesi operator di portal LMS terputus atau logout di tengah jalan, sistem otomatis melakukan re-login secara mandiri tanpa membatalkan proses yang sedang berjalan.
* 📊 **Manajemen Data Ganda (Excel & JSON)**:
  Link Zoom dan slot dapat diedit kapan saja melalui Microsoft Excel (`data/jadwal_zoom.xlsx`) maupun JSON (`data/jadwal_zoom.json`).

---

## 📁 Struktur Folder

```text
c:\lms-automation\
├── .env                      # Kredensial LMS, mode browser, dan token bot Telegram
├── .env.example              # Template konfigurasi environment
├── COMMANDS.md               # Buku panduan lengkap perintah CLI & jadwal kuliah
├── package.json              # Daftar dependensi dan script npm
├── start-n8n.bat             # Runner n8n lokal dengan bypass Execute Command
├── data/
│   ├── daftar_matkul.json    # Database jadwal 37 mata kuliah (Sem 1, 3, 5, 7)
│   ├── jadwal_zoom.json      # Konfigurasi link Zoom per kode slot
│   ├── jadwal_zoom.xlsx      # Spreadsheet Excel jadwal dan link Zoom
│   ├── last_report_wa.txt    # Salinan teks laporan eksekusi terakhir
│   └── last_report.json      # Metadata laporan terakhir dalam format JSON
├── scripts/
│   ├── input-zoom.js         # Engine utama automasi penginputan link Zoom
│   ├── auth.js               # Handler login & auto-relogin sesi 5 menit
│   ├── telegram.js           # Modul pengirim notifikasi ke Telegram Bot
│   ├── get-chat-id.js        # Utilitas pendeteksi Chat ID Telegram otomatis
│   ├── sync-excel.js         # Generator sinkronisasi JSON ke jadwal_zoom.xlsx
│   └── record.js             # Recorder interaktif Playwright Codegen
└── n8n-workflows/
    └── lms-daily-workflow.json # Workflow template n8n cron harian
```

---

## 🚀 Panduan Memulai Cepat (*Quick Start*)

### 1. Salin & Sesuaikan Konfigurasi `.env`
Buka file [`.env`](.env) dan sesuaikan kredensial Anda:
```env
# URL Portal Operator LMS
LMS_URL=https://sttpu.operator.lms.civitas.id/

# Kredensial Akun Operator
LMS_USERNAME=farhan
LMS_PASSWORD=password_anda

# Mode Tampilan: false = jendela browser terlihat; true = berjalan di latar belakang
HEADLESS=true

# Notifikasi Telegram Bot
TELEGRAM_BOT_TOKEN=123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ
TELEGRAM_CHAT_ID=987654321
```

### 2. Hubungkan Bot Telegram
1. Buat bot melalui **`@BotFather`** di Telegram (`/newbot`), lalu salin HTTP API Token ke `TELEGRAM_BOT_TOKEN`.
2. Buka bot baru Anda di Telegram, klik **`START`** atau kirim pesan "halo".
3. Jalankan perintah deteksi Chat ID otomatis:
   ```bash
   npm run telegram:check
   ```
4. Masukkan Chat ID yang ditampilkan ke baris `TELEGRAM_CHAT_ID` di file `.env`.

### 3. Uji Coba Penginputan
Jalankan uji coba cepat pada 1 mata kuliah:
```bash
node scripts/input-zoom.js --test
```
Periksa aplikasi Telegram Anda untuk memastikan laporan eksekusi masuk dengan status sukses.

---

## 📌 Ringkasan Perintah Penting (*CLI Cheat Sheet*)

| Perintah | Fungsi | Keterangan |
| :--- | :--- | :--- |
| `node scripts/input-zoom.js` | **Mode Harian Otomatis** | Menjalankan jadwal hari ini sesuai kalender (Default n8n) |
| `node scripts/input-zoom.js --test` | **Test Run (1 Matkul)** | Menguji coba 1 mata kuliah saja untuk verifikasi |
| `node scripts/input-zoom.js --day <Hari>` | **Jadwal Hari Tertentu** | Contoh: `--day Selasa` atau `--day Jumat` |
| `node scripts/input-zoom.js --all` | **Semua Mata Kuliah** | Menjalankan seluruh 37 mata kuliah (Senin s/d Jumat) |
| `node scripts/input-zoom.js --limit <N>` | **Batasi Jumlah Run** | Membatasi proses sebanyak `N` mata kuliah (contoh: `--limit 2`) |
| `node scripts/input-zoom.js --force` | **Paksa Buat Sesi Baru** | Membuat pertemuan berikutnya meski sesi hari ini sudah ada |
| `npm run telegram:check` | **Pengecekan Bot Telegram** | Mendeteksi Chat ID dan mengirimkan pesan tes ke Telegram |
| `npm run sync-excel` | **Sinkronisasi Excel** | Memperbarui file `jadwal_zoom.xlsx` dari database JSON |
| `npm run n8n` | **Jalankan n8n Lokal** | Memulai server n8n dengan izin node *Execute Command* |

> 📖 **Panduan Detail**: Buka [`COMMANDS.md`](COMMANDS.md) untuk dokumentasi parameter dan panduan troubleshooting lengkap.

---

## 📅 Distribusi Jadwal Mata Kuliah (Kelas Sore)

Total terdaftar: **37 Mata Kuliah**

```text
┌───────────────┬───────────────────┬──────────────────────────────────────────────────────────┐
│ Hari          │ Jumlah Matkul     │ Catatan Khusus                                           │
├───────────────┼───────────────────┼──────────────────────────────────────────────────────────┤
│ 🔹 Senin      │ 8 Mata Kuliah     │ Sem 3 (2), Sem 5 (2), Sem 7 (4)                          │
│ 🔹 Selasa     │ 8 Mata Kuliah     │ Sem 1 (1: Mat 1), Sem 3 (2), Sem 5 (2), Sem 7 (3)        │
│ 🔹 Rabu       │ 9 Mata Kuliah     │ Termasuk 2 pasang kelas gabungan Sem 1 & 7 (Slot 7a)     │
│ 🔹 Kamis      │ 8 Mata Kuliah     │ Termasuk 3 matkul pilihan Sem 7 (Slot 7a, 7b, 7c)        │
│ 🔹 Jumat      │ 4 Mata Kuliah     │ Sem 3 (2), Sem 5 (1), Sem 7 (1)                          │
└───────────────┴───────────────────┴──────────────────────────────────────────────────────────┘
```

---

## ⏰ Menjalankan Otomatis dengan n8n

1. Jalankan server n8n lokal:
   ```bash
   npm run n8n
   ```
2. Buka browser di `http://localhost:5678`.
3. Pilih **Import from File**, lalu pilih file [`n8n-workflows/lms-daily-workflow.json`](n8n-workflows/lms-daily-workflow.json).
4. Atur jadwal cron (misal: Setiap hari Senin - Jumat pukul 07:00 WIB).
5. Aktifkan workflow (*Active: ON*). n8n akan menjalankan script setiap pagi dan bot Telegram akan otomatis mengirimkan laporan eksekusi ke ponsel Anda.

---

## 🔒 Keamanan Kredensial

* File `.env` yang memuat password akun operator LMS dan token bot Telegram telah diproteksi di `.gitignore` sehingga **tidak akan pernah terunggah** ke repository publik GitHub.
* Selalu gunakan file `.env.example` saat membagikan konfigurasi ke komputer lain.
