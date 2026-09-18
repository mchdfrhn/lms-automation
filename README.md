# 🎓 LMS Civitas Operator Automation (STTPU)
> **Automasi Input Link Vidcon / Zoom Civitas LMS S1 Teknik Sipil (Kelas Sore) dengan Notifikasi Bot Telegram & Integrasi Penjadwalan n8n.**

[![Playwright](https://img.shields.io/badge/Playwright-Automated_Browser-45ba4b.svg)](https://playwright.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-v24+-339933.svg)](https://nodejs.org/)
[![Telegram](https://img.shields.io/badge/Telegram-Bot_Notification-0088cc.svg)](https://telegram.org/)
[![n8n](https://img.shields.io/badge/n8n-Workflow_Automation-ea4b71.svg)](https://n8n.io/)

---

## 🌟 Fitur Utama Sistem

* 📅 **Eksekusi Harian Ketat Tanggal (*Strict Daily Date Execution*)**:
  Bot dieksekusi secara harian, mendeteksi tanggal kalender saat ini (`targetDate`), dan **hanya memproses jadwal yang persis ada pada tanggal tersebut**. Penamaan link vidcon terstandarisasi rapi: `Kuliah 1` untuk Pertemuan 1, `Kuliah 2` untuk Pertemuan 2, dst. Akhir pekan (Sabtu/Minggu) otomatis libur tanpa membuka browser.
* 🛡️ **Proteksi Idempoten & Anti-Lompat Minggu (*Strict Idempotency*)**:
  - Jika sesi pertemuan pada tanggal hari ini sudah pernah dibuat sebelumnya di tab Vidcon LMS, bot mendeteksi status `already_exists` dan **langsung melewatinya (skip)**.
  - Jika pada tanggal hari ini tidak ada sesi di LMS (misal libur/UTS), bot melewatinya (`no_session_today`) dan **TIDAK AKAN PERNAH** melompat membuat sesi minggu atau bulan berikutnya secara prematur (kecuali opsi `--force` disertakan secara sengaja).
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

## 📁 Struktur Folder (Modular Architecture)

```text
c:\lms-automation\
├── .env                      # Kredensial LMS, mode browser, dan token bot Telegram
├── .env.example              # Template konfigurasi environment
├── COMMANDS.md               # Buku panduan lengkap perintah CLI & jadwal kuliah
├── package.json              # Daftar dependensi dan script npm
├── start-n8n.bat             # Runner n8n lokal dengan bypass Execute Command
├── src/                      # Source code modular terstruktur
│   ├── config/               # Konfigurasi terpusat & data loader
│   │   ├── index.js          # Pengaturan env, path, konstanta hari & bulan
│   │   └── data-loader.js    # Auto-sync Excel/JSON jadwal_zoom & daftar_matkul
│   ├── core/                 # Shared LMS engine
│   │   ├── auth.js           # Login & auto-relogin sesi 5 menit
│   │   ├── browser.js        # Playwright browser lifecycle manager
│   │   ├── navigation.js     # Helper reusable navigasi kelas, tab & sesi LMS
│   │   └── reporter.js       # Formatter & dispatcher Telegram & WhatsApp
│   ├── modules/              # Fitur automasi independen
│   │   ├── zoom/             # Modul automasi input link Vidcon/Zoom
│   │   │   ├── parser.js     # Parser dropdown pertemuan Civitas LMS
│   │   │   └── service.js    # Engine pembuatan vidcon harian & batch
│   │   └── presensi/         # Modul automasi presensi mahasiswa
│   │       ├── parser.js     # Parser data tabel & status kehadiran mahasiswa
│   │       └── service.js    # Runner presensi & template aksi interaktif
│   └── service/              # Background daemon & service manager
│       ├── daemon.js         # Watchdog daemon penjaga kestabilan n8n lokal
│       └── manager.js        # Service CLI manager (status, start, stop, autostart)
├── scripts/                  # CLI Entry-points (Backwards Compatible)
│   ├── input-zoom.js         # CLI entry-point input Zoom (wrapper ke src/modules/zoom)
│   ├── presensi.js           # CLI entry-point presensi mahasiswa (wrapper ke src/modules/presensi)
│   ├── manage-service.js     # CLI entry-point manajemen service background
│   ├── n8n-daemon.js         # Entry-point watchdog daemon
│   ├── get-chat-id.js        # Utilitas pendeteksi Chat ID Telegram
│   ├── sync-excel.js         # Sinkronisasi jadwal_zoom JSON <-> Excel
│   ├── create-sample-data.js # Generator sample data mata kuliah
│   └── record.js             # Codegen interaktif Playwright
├── data/
│   ├── daftar_matkul.json    # Database jadwal 37 mata kuliah (Sem 1, 3, 5, 7)
│   ├── jadwal_zoom.json      # Konfigurasi link Zoom per kode slot
│   ├── jadwal_zoom.xlsx      # Spreadsheet Excel jadwal dan link Zoom
│   ├── last_report_wa.txt    # Salinan teks laporan eksekusi terakhir
│   └── last_report.json      # Metadata laporan terakhir format JSON
├── logs/
│   └── n8n.log               # Log aktivitas server background n8n
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
LMS_USERNAME=username_anda
LMS_PASSWORD=password_anda

# Mode Tampilan: false = jendela browser terlihat; true = berjalan di latar belakang
HEADLESS=true

# Notifikasi Telegram Bot
TELEGRAM_BOT_TOKEN=token_bot_anda
TELEGRAM_CHAT_ID=chat_id_anda
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
| `node scripts/input-zoom.js` | **Mode Harian Otomatis** | Menjalankan jadwal hari ini & tanggal hari ini (Default n8n) |
| `node scripts/input-zoom.js --test` | **Test Run (1 Matkul)** | Menguji coba 1 mata kuliah saja untuk verifikasi |
| `node scripts/input-zoom.js --day <Hari>` | **Jadwal Hari Tertentu** | Contoh: `--day Selasa` atau `--day Jumat` |
| `node scripts/input-zoom.js --date <YYYY-MM-DD>` | **Target Tanggal Kalender** | Contoh: `--date 2026-09-18` |
| `node scripts/input-zoom.js --all` | **Semua Mata Kuliah** | Menjalankan seluruh 37 mata kuliah (Senin s/d Jumat) |
| `node scripts/input-zoom.js --limit <N>` | **Batasi Jumlah Run** | Membatasi proses sebanyak `N` mata kuliah (contoh: `--limit 2`) |
| `node scripts/input-zoom.js --force` | **Paksa Buat Sesi Baru** | Membuat pertemuan berikutnya meski sesi hari ini sudah ada |
| `node scripts/presensi.js` | **Presensi Mahasiswa (Hari Ini)** | Menjalankan pipeline presensi mahasiswa |
| `node scripts/presensi.js --dry-run` | **Pratinjau Presensi** | Cek data kehadiran tanpa mengubah status |
| `node scripts/presensi.js --matkul <ID>` | **Presensi Matkul Tertentu** | Contoh: `--matkul "TS 3325"` |
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

---

## 🖥️ Mode Produksi Lokal (24/7 & Autostart Windows)

Sistem ini didesain untuk berjalan secara mandiri di komputer lokal tanpa server eksternal, dilengkapi **Watchdog Daemon** agar stabil tidak pernah mati, dan **Windows Autostart** saat PC menyala/restart:

### 1. Manajemen Layanan Latar Belakang (Tanpa Jendela CMD)

| Perintah | Deskripsi |
| :--- | :--- |
| `npm run service:status` | Memeriksa apakah Watchdog Daemon dan server n8n sedang berjalan (*Online/Offline*). |
| `npm run service:start` | Memulai Watchdog Daemon & n8n secara hening di latar belakang (*silent background*). |
| `npm run service:stop` | Menghentikan Watchdog Daemon dan mematikan n8n secara bersih. |
| `npm run service:logs` | Melihat catatan log aktivitas terbaru n8n dan watchdog (`logs/n8n.log`). |

### 2. Autostart Saat PC Menyala / Restart
Layanan telah dikonfigurasi untuk menyala otomatis setiap kali komputer di-boot atau di-restart:
* **Aktifkan Autostart**:
  ```bash
  npm run service:autostart
  ```
  *(Menambahkan shortcut launcher `Start-LMS-Civitas.vbs` ke Windows Startup Folder).*
* **Matikan Autostart** (Jika diperlukan):
  ```bash
  npm run service:autostart-off
  ```

### 3. Ketahanan Terhadap Crash (*Crash-Proof & Self-Healing*)
Jika proses server n8n mengalami error tak terduga atau tertutup, **Watchdog Daemon** akan otomatis mendeteksi matinya proses dan meluncurkan ulang server n8n dalam **3 detik**.

---

## ⏰ Konfigurasi Jadwal Alur Kerja di n8n

1. Buka browser di `http://localhost:5678`.
2. Pilih **Import from File**, lalu pilih file [`n8n-workflows/lms-daily-workflow.json`](n8n-workflows/lms-daily-workflow.json).
3. Atur jadwal cron (misal: Setiap hari Senin - Jumat pukul 07:00 WIB).
4. Aktifkan workflow (*Active: ON*). n8n akan mengeksekusi automasi setiap pagi dan bot Telegram otomatis mengirimkan laporan eksekusi ke ponsel Anda.

---

## 🔒 Keamanan Kredensial

* File `.env` yang memuat password akun operator LMS dan token bot Telegram telah diproteksi di `.gitignore` sehingga **tidak akan pernah terunggah** ke repository publik GitHub.
* Selalu gunakan file `.env.example` saat membagikan konfigurasi ke komputer lain.
