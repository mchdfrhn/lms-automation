# Panduan Lengkap Perintah Automasi Civitas LMS (STTPU)

Dokumen ini berisi panduan lengkap perintah (*command guide*), opsi eksekusi, manajemen data Zoom, dan konfigurasi automasi Civitas LMS untuk S1 Teknik Sipil Kelas Sore (Semester 1, 3, 5, dan 7).

---

## 📌 Ringkasan Cepat Perintah Utama

| Perintah | Deskripsi | Kapan Digunakan |
| :--- | :--- | :--- |
| `node scripts/input-zoom.js` | **Mode Otomatis Harian**: Mendeteksi hari & tanggal saat ini (Senin–Jumat) dan hanya memproses jadwal pada tanggal tersebut. | **Default untuk n8n / Cron Harian** |
| `node scripts/input-zoom.js --test` | Menguji penginputan pada **1 mata kuliah saja** lalu berhenti. | Uji coba cepat verifikasi selector / akun |
| `node scripts/input-zoom.js --day <Hari>` | Menjalankan khusus mata kuliah pada hari tertentu (misal: `--day Jumat`). | Simulasi atau input susulan hari tertentu |
| `node scripts/input-zoom.js --date <YYYY-MM-DD>` | Menjalankan dengan target tanggal spesifik (misal: `--date 2026-09-18`). | Pengujian tanggal kalender tertentu |
| `node scripts/input-zoom.js --all` | Menjalankan seluruh **37 mata kuliah** (Semua hari: Senin s/d Jumat). | Batch input awal semester untuk semua kelas |
| `node scripts/input-zoom.js --force` | Memaksa membuat pertemuan berikutnya meskipun sesi hari ini sudah ada di LMS. | Jika ingin menyiapkan pertemuan minggu depan |
| `node scripts/input-zoom.js --limit <N>` | Membatasi proses hanya sebanyak `N` mata kuliah (contoh: `--limit 3`). | Pengujian bertahap |
| `npm run telegram:check` | Memeriksa token bot Telegram, mendeteksi Chat ID akun Anda, dan mengirim pesan tes. | Setup & uji coba notifikasi Telegram |
| `npm run service:status` | Mengecek status Watchdog Daemon, server n8n, dan status autostart Windows. | Monitoring produksi lokal |
| `npm run service:start` | Menjalankan n8n di latar belakang tanpa jendela CMD (*silent background*). | Memulai layanan mandiri |
| `npm run service:stop` | Menghentikan Watchdog Daemon dan mematikan n8n secara bersih. | Maintenance / mematikan server |
| `npm run service:autostart` | Mengaktifkan autostart agar n8n otomatis menyala saat PC restart/boot. | Setup awal produksi |
| `npm run n8n` | Menjalankan n8n di jendela CMD interaktif biasa. | Debugging visual |

---

## 🚀 Panduan Penggunaan & Contoh Perintah

### 1. Eksekusi Harian Otomatis (Standar n8n)
Perintah ini membaca hari dan tanggal sistem secara otomatis:
```bash
node scripts/input-zoom.js
```
* **Senin**: Memproses 8 mata kuliah hari Senin.
* **Selasa**: Memproses 8 mata kuliah hari Selasa.
* **Rabu**: Memproses 9 mata kuliah hari Rabu (termasuk kelas gabungan Sem 1 & 7).
* **Kamis**: Memproses 8 mata kuliah hari Kamis (termasuk 3 matkul pilihan).
* **Jumat**: Memproses 4 mata kuliah hari Jumat.
* **Sabtu / Minggu**: Langsung selesai tanpa membuka browser.

> [!IMPORTANT]
> **Proteksi Ketat Tanggal Hari Ini (Anti-Lompat Minggu):**
> 1. Bot hanya mencari pertemuan di dropdown LMS yang tanggalnya **persis sama** dengan tanggal eksekusi (`targetDate`).
> 2. Jika pertemuan untuk tanggal hari ini sudah ada di tab Vidcon (misal `Kuliah 1`), bot mendeteksi `already_exists` dan **langsung melewatinya (skip)**.
> 3. Jika tidak ada sesi perkuliahan pada tanggal hari ini (misal libur/UTS), bot melewatinya (`no_session_today`) dan **TIDAK AKAN** melompat membuat sesi minggu/bulan berikutnya (kecuali menggunakan opsi `--force`).

---

### 2. Menjalankan Hari Tertentu (Simulasi / Susulan)
Gunakan argumen `--day` atau `-d` diikuti nama hari dalam Bahasa Indonesia:
```bash
# Menjalankan khusus mata kuliah hari Jumat
node scripts/input-zoom.js --day Jumat

# Menjalankan khusus mata kuliah hari Senin
node scripts/input-zoom.js --day Senin

# Menjalankan khusus hari Kamis dibatasi 2 mata kuliah saja
node scripts/input-zoom.js --day Kamis --limit 2
```

---

### 3. Menjalankan Seluruh Mata Kuliah Sekaligus
Jika Anda ingin memproses seluruh 37 mata kuliah (Semester 1, 3, 5, dan 7) tanpa memfilter hari:
```bash
node scripts/input-zoom.js --all
```
*(Bisa juga menggunakan shorthand: `npm run zoom -- --all`)*

---

### 4. Mode Pengujian Cepat (*Test Run*)
Untuk mengecek apakah portal LMS dapat diakses dan kredensial valid tanpa memproses banyak data:
```bash
# Cara 1: Menggunakan npm
npm run test-zoom

# Cara 2: Menggunakan node langsung
node scripts/input-zoom.js --test
```

---

### 5. Memaksa Buat Pertemuan Berikutnya (`--force`)
Secara bawaan, jika pertemuan hari ini sudah ada, skrip akan melewatinya. Jika Anda ingin memaksa skrip tetap membuat pertemuan minggu depannya lagi:
```bash
node scripts/input-zoom.js --force

# Atau dikombinasikan dengan hari tertentu
node scripts/input-zoom.js --day Jumat --force
```

---

## 🌐 Menjalankan Server n8n

Untuk menjalankan n8n di komputer Anda dengan node `Execute Command` yang sudah aktif:

```bash
# Dari Command Prompt / Terminal:
npm run n8n

# Atau klik langsung file launcher:
start-n8n.bat
```

Setelah server aktif:
1. Buka browser: **`http://localhost:5678`**
2. Workflow yang digunakan: [`n8n-workflows/lms-daily-workflow.json`](n8n-workflows/lms-daily-workflow.json)
3. Node `Execute Command` mengeksekusi: `node scripts/input-zoom.js` pada direktori `C:\lms-automation`.

---

## 📝 Mengubah Link Zoom Perkuliahan

Anda dapat mengganti link Zoom kapan saja melalui salah satu file berikut di folder `data/`:

1. **Via Excel (Direkomendasikan)**:
   Buka file [`data/jadwal_zoom.xlsx`](data/jadwal_zoom.xlsx) menggunakan Microsoft Excel.
2. **Via JSON**:
   Buka file [`data/jadwal_zoom.json`](data/jadwal_zoom.json) menggunakan text editor.

### Pemetaan Slot Zoom:
| Kode Slot | Digunakan Untuk | Keterangan Khusus |
| :--- | :--- | :--- |
| **`1`** | Semester 1 | Cadangan / Semester 1 |
| **`3`** | Semester 3 | Seluruh mata kuliah Semester 3 |
| **`5`** | Semester 5 | Seluruh mata kuliah Semester 5 |
| **`7a`** | Semester 7 Reguler & Pilihan Gedung | Digunakan untuk seluruh matkul Semester 7 & *Perencanaan Bangunan Gedung* |
| **`7b`** | Semester 7 Pilihan SDA | Khusus matkul *Perencanaan Bangunan SDA* (Kamis 19:00 WIB) |
| **`7c`** | Semester 7 Pilihan Jalan & Jembatan | Khusus matkul *Perencanaan Bangunan Jalan & Jembatan* (Kamis 19:00 WIB) |

> [!TIP]
> Sistem memiliki fitur **Sinkronisasi Otomatis**. Jika Anda menyimpan perubahan di file Excel, skrip akan otomatis memperbarui file JSON, dan sebaliknya!

---

## ⚙️ Konfigurasi Environment (`.env`)

File [`.env`](.env) mengatur kredensial dan mode tampilan browser:

```env
# URL Portal Operator Civitas LMS
LMS_URL=https://sttpu.operator.lms.civitas.id/

# Kredensial Akun Operator
LMS_USERNAME=farhan
LMS_PASSWORD=@Kucing001

# Mode Browser:
# false = Jendela Google Chrome terlihat di layar monitor
# true  = Berjalan hening di latar belakang (background) tanpa jendela
HEADLESS=false

# Lokasi File Jadwal
DATA_FILE=data/jadwal_zoom.xlsx

# Konfigurasi Node n8n
NODES_EXCLUDE=[]

# Notifikasi Telegram Bot (Laporan Harian Otomatis)
TELEGRAM_BOT_TOKEN=123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ
TELEGRAM_CHAT_ID=987654321
```

---

## 🤖 Panduan Setup Notifikasi Telegram Bot

Laporan hasil eksekusi harian akan dikirim otomatis ke aplikasi Telegram Anda setiap kali automasi selesai berjalan.

### Langkah 1: Buat Bot di Telegram
1. Buka Telegram dan cari **`@BotFather`**.
2. Kirim pesan: `/newbot`
3. Beri nama bot Anda (contoh: `LMS Civitas Notifier`).
4. Beri username bot yang berakhiran `bot` (contoh: `farhan_lms_notif_bot`).
5. BotFather akan memberikan **Token HTTP API** (contoh: `7654321980:AAH...`).
6. Masukkan token tersebut ke file [`.env`](.env):
   ```env
   TELEGRAM_BOT_TOKEN=7654321980:AAH...
   ```

### Langkah 2: Dapatkan Chat ID Akun Anda
1. Buka Telegram dan cari bot yang baru Anda buat (misal `@farhan_lms_notif_bot`).
2. Klik tombol **`START`** atau kirim pesan apa saja (misal: "halo").
3. Jalankan perintah pendeteksi otomatis di terminal:
   ```bash
   npm run telegram:check
   ```
4. Terminal akan otomatis mendeteksi nama dan **Chat ID** Anda, lalu mengirimkan pesan tes.
5. Salin Chat ID ke file [`.env`](.env):
   ```env
   TELEGRAM_CHAT_ID=123456789
   ```

Setelah kedua konfigurasi diisi, setiap kali `node scripts/input-zoom.js` atau cron n8n berjalan, laporan lengkap akan otomatis terkirim ke Telegram Anda!

---

## 📅 Distribusi Jadwal Mata Kuliah Per Hari (Kelas Sore)

### 🔹 Senin (8 Mata Kuliah)
* **Semester 3**: Mekanika Bahan (`TS 3328`), Struktur Bangunan (`TS 3333`)
* **Semester 5**: Rekayasa Struktur Bangunan Beton (`TS 5347`), Manajemen Konstruksi (`TS 5351`)
* **Semester 7**: Prasarana & Sarana PU Terpadu (`ST 7107`), Kerja Praktek (`TS 7364`), Manajemen Pemeliharaan Bangunan (`TS 7476`)

### 🔹 Selasa (8 Mata Kuliah)
* **Semester 1**: Matematika I (`PU 1206`) $\rightarrow$ Slot `1`
* **Semester 3**: Fisika II (`TS 3326`), Pengelolaan Sumber Daya Air (`TS 3330`)
* **Semester 5**: Rekayasa Struktur Bangunan Baja (`TS 5348`), Rekayasa Sungai dan Pantai (`TS 5355`)
* **Semester 7**: Sistem Penjamin Mutu Teknik Sipil (`ST 7109`), Perencanaan Jembatan (`TS 7365`)

### 🔹 Rabu (9 Mata Kuliah - Termasuk 2 Pasang Kelas Gabungan Sem 1 & Sem 7)
* **Semester 1 & 7 (Kelas Gabungan $\rightarrow$ Wajib Link Zoom Sama di Slot `7a`):**
  * *Pkl 19:00 WIB*: Logika Teknologi dan Transformasi Digital (`PU 1209`) & Teknologi dan Transformasi Digital (`ST 7105`) $\rightarrow$ Pengajar: MUHAMMAD FAIZ SYAIFUL ISLAM, M.Si.
  * *Pkl 20:30 WIB*: Etika Profesi dan Pendidikan Anti Korupsi (`PU 1210`) & Etika Profesi (`ST 7106`) $\rightarrow$ Pengajar: Drs. GUNAWAN WIBISONO, M.T.
* **Semester 3**: Kimia Dasar (`TS 3327`), Transportasi & Rekayasa Lalu Lintas (`TS 3332`)
* **Semester 5**: Pemodelan Struktur (`TS 5345`), Praktik Pemodelan Struktur (`TS 5346`), Rekayasa Perkerasan & Preservasi Jalan (`TS 5350`)

### 🔹 Kamis (8 Mata Kuliah - Termasuk 3 Matkul Pilihan)
* **Semester 3**: Mekanika Tanah I (`TS 3329`), Hidrologi Terapan (`TS 3331`)
* **Semester 5**: Desain Fondasi I (`TS 5349`), Rekayasa Irigasi dan Rawa (`TS 5356`)
* **Semester 7**:
  * Rekayasa Sosial (`ST 7108`) $\rightarrow$ Slot `7a`
  * **Perencanaan Bangunan Gedung** (`TS 7472`) $\rightarrow$ Slot `7a`
  * **Perencanaan Bangunan SDA** (`TS 7473`) $\rightarrow$ Slot `7b`
  * **Perencanaan Bangunan Jalan & Jembatan** (`TS 7474`) $\rightarrow$ Slot `7c`

### 🔹 Jumat (4 Mata Kuliah)
* **Semester 3**: Matematika III (`TS 3325`), Surveying dan SIG (`TS 3334`)
* **Semester 5**: Ekonomi Rekayasa dan Analisis Finansial (`TS 5352`)
* **Semester 7**: Kewirausahaan Teknik Sipil (`TS 7363`)
