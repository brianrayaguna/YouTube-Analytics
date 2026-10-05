# YT Analyzer Pro

Aplikasi web untuk menganalisis channel, playlist, video, dan hasil pencarian YouTube — dengan tampilan yang mengikuti bahasa desain YouTube (header + kolom pencarian di tengah, sidebar penuh/mini, chip filter, grid video & rak Shorts, halaman analitik ala YouTube Studio, tema terang/gelap).

## Fitur

| Halaman | Isi |
| --- | --- |
| **Beranda** | Analisis `@handle`, URL channel/playlist/video/Shorts, channel ID, atau kata kunci. Header channel (banner, avatar, subscriber), chip jenis konten & urutan, dialog filter lengkap, infinite scroll, rak Shorts, pratinjau video ala halaman tonton. |
| **Trending** | Video trending per wilayah (14 negara). |
| **Statistik Channel** | Pilih periode (24 jam, 3/7/14/28 hari, 1/3/6 bulan, 1 tahun, tahun ini, semua waktu, atau rentang kustom) berdasarkan tanggal upload, dengan perbandingan ke periode sebelumnya. KPI, grafik views & ER per video, format Video vs Shorts, konten teratas, analisis tag. |
| **Skor Konten** | Skor 0–100 & nilai A–F untuk judul dan thumbnail (model v2: jangkauan vs video seusia, engagement, kualitas teks/HD), tingkat keyakinan, dan saran perbaikan judul. |
| **Jadwal Upload** | Pilih periode (3/7 hari, 1/3 bulan, 1 tahun, kustom, dll.), format (Video/Shorts), dan jumlah video terbaru. Peta panas hari × jam (zona waktu lokal) dengan **performa disesuaikan umur video** (views ÷ perkiraan views video seusia, dibatasi 0,2×–5× per video, sampel kecil ditarik ke 1,0×), hari/jam terbaik, slot 3 jam terbaik & terendah dengan tingkat keyakinan, tabel peringkat yang bisa dikelompokkan per hari / jam / blok 3 jam / bagian hari / hari × jam, tombol ambil lebih banyak video. |
| **Content Gap** | Topik trending yang belum dibahas channel. |
| **Benchmark Kompetitor** | Bandingkan dua channel (subscriber, views, ER, frekuensi upload, tag). |
| **Video Downloader** | **Perangkat ini**: unduh MP4 (hingga 4K) / MP3 langsung ke komputer memakai yt-dlp + ffmpeg lewat *Local Downloader*. **Layanan online**: Cobalt, Y2Mate, SaveFrom, SSYouTube (tab baru). |
| **Tersimpan / Riwayat** | Disimpan di `localStorage` browser. |

Shorts = video berdurasi **1 detik – 3 menit** (batas YouTube Shorts sejak Oktober 2024).

### Ekspor

Tombol **Ekspor** membuka dialog untuk memilih format, cakupan data (sesuai filter / semua / video terpilih),
thumbnail, dan nama file.

| Format | Isi |
| --- | --- |
| **Excel (.xlsx)** | Sheet *Ringkasan* (channel, KPI, format, distribusi nilai, 10 teratas, tag), *Video* (thumbnail di dalam sel, hyperlink, angka terformat, warna nilai, filter, freeze pane, siap cetak), *Tag*, *Metodologi* |
| **PDF** | Sampul + KPI, distribusi nilai, 10 teratas dengan thumbnail, daftar lengkap (landscape), metodologi |
| **HTML** | Laporan satu file (thumbnail tersemat, Unicode penuh, mode gelap, siap dicetak ke PDF) |
| **JSON** | Data terstruktur berversi (`yt-analyzer-report` v1): channel, ringkasan, skor & komponen per video, URL thumbnail semua ukuran (opsional base64) |
| **CSV** | Tabel universal UTF-8 (BOM) untuk Excel/Sheets/BI |
| **Paket lengkap (.zip)** | Semua format di atas + folder `thumbnails/` resolusi HD bernomor |

Lainnya: salin semua link, ZIP thumbnail, mode **Pilih** untuk aksi massal.

### Mesin skor (v2)

- **Jangkauan** = views ÷ perkiraan views video seusia di kelompoknya (Shorts vs Shorts, Video vs Video).
  Perkiraan = median kelompok × t/(t+τ), τ = 7 hari (video) / 4 hari (Shorts); dinilai sebagai persentil mid-rank.
- **Engagement** = (likes + komentar) ÷ views, dihaluskan (Bayesian, 1.000 views semu); dilewati bila like disembunyikan.
- **Skor judul** = 45% jangkauan + 15% engagement + 40% kualitas teks (panjang tanpa tagar, pemikat, kapitalisasi, kebersihan, kejelasan).
- **Skor thumbnail** = 70% daya klik (jangkauan) + 15% engagement + 15% thumbnail HD 1280×720 (video panjang).
- Nilai: A ≥ 80, B ≥ 65, C ≥ 50 (≈ rata-rata), D ≥ 35, F < 35. Keyakinan rendah bila video < 2 hari atau views < 100.

Pintasan: `/` atau `Ctrl/⌘ K` cari · `D` tema · `Esc` tutup · `← →` navigasi pratinjau · `S` simpan.

## Menjalankan

```sh
npm ci
npm run dev      # http://localhost:8080
npm test         # unit test (vitest)
npm run lint
npm run build
```

## YouTube API Key

Aplikasi memakai **YouTube Data API v3** dengan key milik pengguna (disimpan hanya di browser).

1. Buka [Google Cloud Console](https://console.cloud.google.com/apis/library/youtube.googleapis.com) dan aktifkan *YouTube Data API v3*.
2. Buat *API key* di menu *Credentials*.
3. Tempel di **Pengaturan** (ikon roda gigi / tombol *Atur API Key*). Key divalidasi sebelum disimpan.

Kuota gratis 10.000 unit/hari (reset tengah malam waktu Pasifik). Analisis channel/playlist ±2 unit per 50 video; pencarian kata kunci 100 unit per 50 hasil (maks. 500 hasil).

## Local Downloader (unduh lewat yt-dlp di perangkat sendiri)

Browser tidak boleh menjalankan program di komputer, jadi aplikasi memakai server penghubung kecil
(`local-downloader/server.mjs`, Node.js tanpa dependensi) yang menjalankan **yt-dlp** (dan **ffmpeg**) di perangkat Anda.

1. Pasang mesin unduh:
   - Windows: `winget install yt-dlp.yt-dlp Gyan.FFmpeg OpenJS.NodeJS.LTS`
   - macOS: `brew install yt-dlp ffmpeg node`
   - Linux: `sudo apt install ffmpeg nodejs && pipx install yt-dlp`
2. Jalankan server: `npm run downloader` dari folder repo, atau unduh `yt-analyzer-downloader.mjs`
   dari halaman **Video Downloader → Perangkat ini** lalu `node yt-analyzer-downloader.mjs`.
3. Buka **Video Downloader** — status berubah menjadi *Mesin lokal terhubung*. Menu ⋮ di kartu video
   dan tombol *Unduh* di pratinjau kini menyimpan langsung ke perangkat.

File tersimpan di `~/Downloads/YT Analyzer` (tidak pernah menimpa file yang sudah ada).

**MP4 selalu bisa diputar.** YouTube menyajikan video terbaik dalam AV1/VP9 + Opus yang tidak bisa dibuka di banyak
pemutar (Windows Media Player/Film & TV, QuickTime, TV, editor video). Server memilih **H.264 + AAC** (tersedia hingga
1080p) dan memeriksa hasil dengan `ffprobe`; bila codec belum kompatibel (mis. 1440p/4K yang hanya ada dalam VP9/AV1),
file otomatis dikonversi ke H.264/AAC dengan ffmpeg. Pengguna server v1.0.0 akan diminta memperbarui ke v1.1.0.

| Variabel | Default | Keterangan |
| --- | --- | --- |
| `PORT` | `17890` | Port lokal (ubah juga di *Pengaturan lanjutan* halaman Downloader) |
| `DOWNLOAD_DIR` | `~/Downloads/YT Analyzer` | Folder tujuan |
| `YTDLP_PATH` / `FFMPEG_PATH` | dari `PATH` | Lokasi mesin bila tidak ada di `PATH` |
| `ALLOWED_ORIGINS` | domain Vercel proyek + localhost | Origin tambahan (dipisah koma) bila aplikasi di-host di domain lain |
| `MAX_CONCURRENT` | `2` | Unduhan paralel |

Keamanan: server hanya mendengarkan di `127.0.0.1`, menolak origin & Host yang tidak dikenal, hanya menerima
URL `http(s)`, dan menjalankan yt-dlp tanpa shell. Chrome/Edge dapat meminta izin *akses jaringan lokal* — pilih
Izinkan. Safari memblokir akses ke `http://127.0.0.1` dari situs HTTPS; gunakan browser lain atau jalankan aplikasi
secara lokal (`npm run dev`).

## Struktur

```
src/
  pages/YouTubeAnalyzer.tsx   # shell aplikasi, state, navigasi
  components/                 # header, sidebar, kartu video, halaman analisis
  config/navigation.ts        # satu sumber item navigasi (sidebar, drawer, bottom nav)
  lib/filters.ts, format.ts   # logika filter/urut & format angka
  services/                   # YouTube API, skor, content gap, riwayat, local downloader
  services/export/            # model laporan + Excel, PDF, HTML, JSON, CSV, paket ZIP
  test/                       # unit test (vitest)
local-downloader/server.mjs   # jembatan lokal ke yt-dlp/ffmpeg (npm run downloader)
```
