# YT Analyzer Pro

Aplikasi web untuk menganalisis channel, playlist, video, dan hasil pencarian YouTube — dengan tampilan yang mengikuti bahasa desain YouTube (header + kolom pencarian di tengah, sidebar penuh/mini, chip filter, grid video & rak Shorts, halaman analitik ala YouTube Studio, tema terang/gelap).

## Fitur

| Halaman | Isi |
| --- | --- |
| **Beranda** | Analisis `@handle`, URL channel/playlist/video/Shorts, channel ID, atau kata kunci. Header channel (banner, avatar, subscriber), chip jenis konten & urutan, dialog filter lengkap, infinite scroll, rak Shorts, pratinjau video ala halaman tonton. |
| **Trending** | Video trending per wilayah (14 negara). |
| **Statistik Channel** | KPI, grafik views & ER per video, format Video vs Shorts, konten teratas, analisis tag. |
| **Skor Konten** | Skor 0–100 & nilai A–F untuk judul dan thumbnail berdasarkan performa nyata, plus saran perbaikan judul. |
| **Jadwal Upload** | Peta panas hari × jam (zona waktu lokal), hari/jam terbaik. |
| **Content Gap** | Topik trending yang belum dibahas channel. |
| **Benchmark Kompetitor** | Bandingkan dua channel (subscriber, views, ER, frekuensi upload, tag). |
| **Video Downloader** | **Perangkat ini**: unduh MP4 (hingga 4K) / MP3 langsung ke komputer memakai yt-dlp + ffmpeg lewat *Local Downloader*. **Layanan online**: Cobalt, Y2Mate, SaveFrom, SSYouTube (tab baru). |
| **Tersimpan / Riwayat** | Disimpan di `localStorage` browser. |

Ekspor: salin semua link, ZIP thumbnail, CSV ringkas, CSV lengkap + skor, Excel, dan laporan PDF. Mode **Pilih** untuk aksi massal.

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
  services/                   # YouTube API, ekspor, ZIP, PDF, skor, content gap, riwayat, local downloader
  test/                       # unit test (vitest)
local-downloader/server.mjs   # jembatan lokal ke yt-dlp/ffmpeg (npm run downloader)
```
