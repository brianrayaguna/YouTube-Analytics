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
| **Video Downloader** | Tautan ke Cobalt, Y2Mate, SaveFrom, SSYouTube (tab baru). |
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

## Struktur

```
src/
  pages/YouTubeAnalyzer.tsx   # shell aplikasi, state, navigasi
  components/                 # header, sidebar, kartu video, halaman analisis
  config/navigation.ts        # satu sumber item navigasi (sidebar, drawer, bottom nav)
  lib/filters.ts, format.ts   # logika filter/urut & format angka
  services/                   # YouTube API, ekspor, ZIP, PDF, skor, content gap, riwayat
  test/core.test.ts           # unit test
```
