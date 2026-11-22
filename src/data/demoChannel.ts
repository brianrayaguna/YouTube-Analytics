import { AnalyzedData, VideoItem } from '../types';
import { formatDuration, formatNumber, timeAgo } from '../lib/format';
import { markOutliers } from '../services/youtubeService';

const encodeSvg = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

const makeAvatar = () =>
  encodeSvg(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0F172A"/>
          <stop offset="100%" stop-color="#1E3A5F"/>
        </linearGradient>
      </defs>
      <rect width="160" height="160" rx="80" fill="url(#bg)"/>
      <rect x="42" y="92" width="18" height="32" rx="6" fill="#3DA5FF"/>
      <rect x="71" y="66" width="18" height="58" rx="6" fill="#2DD4BF"/>
      <rect x="100" y="40" width="18" height="84" rx="6" fill="#FF4D4D"/>
    </svg>`
  );

const makeThumbnail = (
  bgA: string,
  bgB: string,
  accent: string,
  tag: string,
  metric: string,
  isShort: boolean
) => {
  const w = isShort ? 360 : 640;
  const h = isShort ? 640 : 360;
  const escapeXml = (str: string) =>
    str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const safeTag = escapeXml(tag);
  const safeMetric = escapeXml(metric);
  return encodeSvg(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${bgA}"/>
          <stop offset="100%" stop-color="${bgB}"/>
        </linearGradient>
      </defs>
      <rect width="${w}" height="${h}" fill="url(#g)"/>
      <circle cx="${Math.round(w * 0.84)}" cy="${Math.round(h * 0.22)}" r="${Math.round(Math.min(w, h) * 0.34)}" fill="${accent}" fill-opacity="0.16"/>
      <rect x="28" y="28" width="${Math.min(w - 56, safeTag.length * 10 + 36)}" height="32" rx="16" fill="#0B1120" fill-opacity="0.65"/>
      <text x="46" y="49" fill="#F8FAFC" font-family="system-ui,sans-serif" font-size="14" font-weight="600">${safeTag}</text>
      <g opacity="0.92">
        <rect x="28" y="${h - 118}" width="16" height="44" rx="4" fill="#3DA5FF"/>
        <rect x="52" y="${h - 138}" width="16" height="64" rx="4" fill="${accent}"/>
        <rect x="76" y="${h - 158}" width="16" height="84" rx="4" fill="#F8FAFC" fill-opacity="0.88"/>
      </g>
      <text x="28" y="${h - 32}" fill="#E2E8F0" font-family="system-ui,sans-serif" font-size="20" font-weight="700">${safeMetric}</text>
    </svg>`
  );
};

interface SeedVideo {
  id: string;
  title: string;
  description: string;
  daysAgo: number;
  weekday: number;
  hour: number;
  views: number;
  likes: number;
  comments: number;
  durationSec: number;
  tags: string[];
  topicLabel: string;
  metricBadge: string;
  palette: [string, string, string];
  thumbnailHd?: boolean;
  likesHidden?: boolean;
}

const SEEDS: SeedVideo[] = [
  {
    id: 'demo_v01',
    title: '7 Pengaturan Audio Murah yang Membuat Suara Video Terdengar Seperti Studio',
    description: 'Panduan lengkap mengatur mikrofon dinamis, noise gate, dan kompresor untuk kreator rumahan.\n\nBab:\n00:00 Masalah audio ruangan\n03:12 Posisi mikrofon ideal\n08:40 EQ dan kompresor dasar',
    daysAgo: 4,
    weekday: 4,
    hour: 19,
    views: 412000,
    likes: 25400,
    comments: 1420,
    durationSec: 842,
    tags: ['audio', 'mikrofon', 'tips kreator', 'editing video', 'studio'],
    topicLabel: 'AUDIO LAB',
    metricBadge: 'Hemat < 1 Juta',
    palette: ['#0F172A', '#1E293B', '#2DD4BF'],
    thumbnailHd: true,
  },
  {
    id: 'demo_v02',
    title: 'Perbandingan 5 Laptop Editing Video 2026: Tes Render 4K 10-Bit Nyata',
    description: 'Uji benchmark ekspor 4K timeline 15 menit dengan color grading dan noise reduction di lima laptop populer.',
    daysAgo: 9,
    weekday: 2,
    hour: 20,
    views: 318000,
    likes: 17900,
    comments: 1180,
    durationSec: 1165,
    tags: ['laptop', 'editing video', 'benchmark', 'review gadget', '4k'],
    topicLabel: 'BENCHMARK 4K',
    metricBadge: 'Tes 5 Laptop',
    palette: ['#111827', '#1E3A5F', '#3DA5FF'],
    thumbnailHd: true,
  },
  {
    id: 'demo_v03',
    title: 'Cara Membaca Grafik Retensi Penonton agar Video Tidak Ditinggal di 30 Detik Pertama',
    description: 'Bedah 3 pola hook pembuka berdasarkan data retensi nyata dari 50 video berdurasi 10 menit.',
    daysAgo: 12,
    weekday: 4,
    hour: 20,
    views: 528000,
    likes: 34200,
    comments: 2140,
    durationSec: 734,
    tags: ['analitik', 'retensi', 'tips kreator', 'youtube studio', 'strategi konten'],
    topicLabel: 'RETENSI 30 DETIK',
    metricBadge: '+68% Bertahan',
    palette: ['#091521', '#133B3A', '#2DD4BF'],
    thumbnailHd: true,
  },
  {
    id: 'demo_v04',
    title: 'Trik Pencahayaan 1 Lampu untuk Ruang Sempit [30 Detik]',
    description: 'Letakkan key light 45 derajat di samping jendela untuk dimensi wajah yang rapi.',
    daysAgo: 6,
    weekday: 4,
    hour: 19,
    views: 289000,
    likes: 21500,
    comments: 620,
    durationSec: 42,
    tags: ['lighting', 'pencahayaan', 'tips kreator', 'kamera'],
    topicLabel: 'SHORTS LIGHTING',
    metricBadge: '1 Lampu Saja',
    palette: ['#1E1B4B', '#312E81', '#60A5FA'],
    thumbnailHd: true,
  },
  {
    id: 'demo_v05',
    title: 'Setup Meja Kerja Minimalis Kreator 2026: Rapi Tanpa Kabel Berantakan',
    description: 'Tur meja kerja 140 cm lengkap dengan manajemen kabel, monitor kalibrasi warna, dan arm mikrofon.',
    daysAgo: 15,
    weekday: 2,
    hour: 19,
    views: 146000,
    likes: 8800,
    comments: 540,
    durationSec: 695,
    tags: ['setup meja', 'produktivitas', 'minimalis', 'monitor', 'desk tour'],
    topicLabel: 'DESK TOUR',
    metricBadge: 'Zero Kabel',
    palette: ['#172033', '#273549', '#38BDF8'],
    thumbnailHd: true,
  },
  {
    id: 'demo_v06',
    title: 'Kenapa Warna Video Berubah Setelah Upload? Ini Solusi Color Space Rec.709',
    description: 'Penjelasan sederhana tentang gamma shift dan pengaturan ekspor yang konsisten di semua layar.',
    daysAgo: 18,
    weekday: 4,
    hour: 18,
    views: 118000,
    likes: 7600,
    comments: 430,
    durationSec: 612,
    tags: ['color grading', 'editing video', 'rec709', 'tutorial'],
    topicLabel: 'COLOR SPACE',
    metricBadge: 'Rec.709 Fix',
    palette: ['#18181B', '#2E1065', '#A78BFA'],
    thumbnailHd: true,
  },
  {
    id: 'demo_v07',
    title: '5 Alur Kerja AI untuk Riset Topik & Skrip Video Lebih Cepat',
    description: 'Cara memisahkan riset data, penyusunan kerangka, dan pengecekan fakta tanpa kehilangan gaya bahasa pribadi.',
    daysAgo: 21,
    weekday: 2,
    hour: 20,
    views: 214000,
    likes: 13200,
    comments: 890,
    durationSec: 890,
    tags: ['ai', 'produktivitas', 'skrip video', 'tips kreator', 'workflow'],
    topicLabel: 'WORKFLOW AI',
    metricBadge: '3× Lebih Cepat',
    palette: ['#0F172A', '#0C4A6E', '#2DD4BF'],
    thumbnailHd: true,
  },
  {
    id: 'demo_v08',
    title: 'Uji Mikrofon Clip-On 300 Ribu vs 3 Juta di Luar Ruangan',
    description: 'Rekaman mentah tanpa edit di pinggir jalan ramai untuk mendengar perbedaan wind noise dan kejernihan vokal.',
    daysAgo: 23,
    weekday: 5,
    hour: 19,
    views: 96000,
    likes: 5100,
    comments: 390,
    durationSec: 540,
    tags: ['audio', 'mikrofon', 'review gadget', 'perbandingan'],
    topicLabel: 'UJI AUDIO',
    metricBadge: '300rb vs 3jt',
    palette: ['#1C1917', '#44403C', '#F59E0B'],
    thumbnailHd: true,
  },
  {
    id: 'demo_v09',
    title: 'Shortcut Keyboard Editing yang Menghemat 2 Jam Setiap Minggu',
    description: 'Empat pintasan ripple delete, J-K-L scrubbing, dan marker cepat untuk memotong footage.',
    daysAgo: 25,
    weekday: 2,
    hour: 19,
    views: 174000,
    likes: 14100,
    comments: 310,
    durationSec: 49,
    tags: ['editing video', 'shortcut', 'produktivitas', 'tutorial'],
    topicLabel: 'SHORTS EDITING',
    metricBadge: 'Hemat 2 Jam',
    palette: ['#0F172A', '#1E3A8A', '#3DA5FF'],
    thumbnailHd: true,
  },
  {
    id: 'demo_v10',
    title: 'Kamera Mirrorless Pemula 2026: Pilih Lensa Kit atau Lensa Prime 35mm?',
    description: 'Perbandingan ketajaman, bokeh, dan fleksibilitas focal length untuk ruang kerja kecil.',
    daysAgo: 28,
    weekday: 3,
    hour: 16,
    views: 74000,
    likes: 3400,
    comments: 265,
    durationSec: 785,
    tags: ['kamera', 'lensa', 'review gadget', 'fotografi'],
    topicLabel: 'LENSA 35MM',
    metricBadge: 'Kit vs Prime',
    palette: ['#111827', '#1F2937', '#38BDF8'],
    thumbnailHd: true,
  },
  {
    id: 'demo_v11',
    title: 'Cara Mendesain Thumbnail Kontras Tinggi dalam 10 Menit (Tanpa Terlihat Ramai)',
    description: 'Tiga prinsip komposisi: satu subjek utama, maksimal 3 kata, dan uji keterbacaan di ukuran layar ponsel.',
    daysAgo: 31,
    weekday: 4,
    hour: 20,
    views: 364000,
    likes: 23900,
    comments: 1310,
    durationSec: 648,
    tags: ['thumbnail', 'desain', 'tips kreator', 'ctr', 'tutorial'],
    topicLabel: 'THUMBNAIL LAB',
    metricBadge: 'CTR +3,4%',
    palette: ['#0D1B2A', '#1B4332', '#34D399'],
    thumbnailHd: true,
  },
  {
    id: 'demo_v12',
    title: 'Backup Footage 4K Aman dengan SSD NVMe + NAS Rumahan',
    description: 'Menerapkan aturan 3-2-1 agar file proyek klien dan rekaman utama tidak hilang saat drive rusak.',
    daysAgo: 34,
    weekday: 1,
    hour: 10,
    views: 42000,
    likes: 1850,
    comments: 140,
    durationSec: 920,
    tags: ['storage', 'ssd', 'backup', 'workflow', 'produksi'],
    topicLabel: 'STORAGE 3-2-1',
    metricBadge: 'NVMe + NAS',
    palette: ['#18181B', '#27272A', '#60A5FA'],
    thumbnailHd: true,
  },
  {
    id: 'demo_v13',
    title: 'Jangan Salah Pilih Kabel USB-C untuk Transfer Video 4K',
    description: 'Beda kabel pengisian daya USB 2.0 dan kabel data 10Gbps saat memindahkan file dari kamera.',
    daysAgo: 36,
    weekday: 4,
    hour: 19,
    views: 138000,
    likes: 9400,
    comments: 290,
    durationSec: 38,
    tags: ['gadget', 'usb-c', 'kamera', 'tips kreator'],
    topicLabel: 'SHORTS TECH',
    metricBadge: '480Mb vs 10Gb',
    palette: ['#111827', '#0F4C5C', '#2DD4BF'],
    thumbnailHd: true,
  },
  {
    id: 'demo_v14',
    title: 'UNBOXING CEPAT PAKET BARU DATANG HARI INI 🔥🔥🔥 #viral #fyp #gadget',
    description: 'Buka paket kiriman aksesoris meja yang baru datang minggu ini.',
    daysAgo: 39,
    weekday: 0,
    hour: 8,
    views: 19500,
    likes: 490,
    comments: 62,
    durationSec: 410,
    tags: ['unboxing', 'gadget'],
    topicLabel: 'UNBOXING',
    metricBadge: 'Paket Baru',
    palette: ['#27272A', '#3F3F46', '#F87171'],
    thumbnailHd: false,
  },
  {
    id: 'demo_v15',
    title: 'Membuat Sistem Catatan Ide Konten dengan Database Sederhana',
    description: 'Template pelacakan ide, riset kompetitor, dan jadwal produksi mingguan untuk tim kecil.',
    daysAgo: 42,
    weekday: 2,
    hour: 19,
    views: 112000,
    likes: 6400,
    comments: 370,
    durationSec: 715,
    tags: ['produktivitas', 'strategi konten', 'workflow', 'tutorial'],
    topicLabel: 'SISTEM IDE',
    metricBadge: 'Jadwal Rapi',
    palette: ['#0F172A', '#1E293B', '#38BDF8'],
    thumbnailHd: true,
  },
  {
    id: 'demo_v16',
    title: 'Tes Daya Tahan Baterai 3 Power Bank Laptop 100W di Perjalanan',
    description: 'Mengisi MacBook, kamera, dan ponsel sekaligus selama perjalanan kerja 12 jam.',
    daysAgo: 46,
    weekday: 6,
    hour: 11,
    views: 58000,
    likes: 2300,
    comments: 195,
    durationSec: 630,
    tags: ['review gadget', 'laptop', 'aksesoris', 'travel'],
    topicLabel: 'POWER 100W',
    metricBadge: 'Uji 12 Jam',
    palette: ['#171717', '#262626', '#FBBF24'],
    thumbnailHd: true,
  },
  {
    id: 'demo_v17',
    title: 'Cara Menghilangkan Gema Ruangan Tanpa Panel Akustik Mahal',
    description: 'Tiga benda di kamar tidur yang efektif meredam pantulan suara sebelum rekam voiceover.',
    daysAgo: 48,
    weekday: 2,
    hour: 20,
    views: 162000,
    likes: 11800,
    comments: 340,
    durationSec: 52,
    tags: ['audio', 'akustik', 'tips kreator', 'tutorial'],
    topicLabel: 'SHORTS AUDIO',
    metricBadge: 'Anti Gema',
    palette: ['#0F172A', '#164E63', '#2DD4BF'],
    thumbnailHd: true,
  },
  {
    id: 'demo_v18',
    title: 'Update Peralatan Studio Bulan Ini & Rencana Seri Berikutnya',
    description: 'Ringkasan peralatan yang diganti bulan lalu serta jadwal seri tutorial kuartal mendatang.',
    daysAgo: 52,
    weekday: 1,
    hour: 9,
    views: 28400,
    likes: 0,
    comments: 115,
    durationSec: 465,
    tags: ['studio', 'update', 'peralatan'],
    topicLabel: 'STUDIO LOG',
    metricBadge: 'Update Gear',
    palette: ['#1F2937', '#374151', '#94A3B8'],
    thumbnailHd: false,
    likesHidden: true,
  },
  {
    id: 'demo_v19',
    title: 'Monitor 4K IPS vs OLED untuk Editing Video: Masalah Burn-In Setelah 1 Tahun',
    description: 'Evaluasi jujur pemakaian 2.500 jam untuk timeline editing, akurasi warna Delta E, dan ketajaman teks.',
    daysAgo: 55,
    weekday: 4,
    hour: 19,
    views: 198000,
    likes: 11200,
    comments: 910,
    durationSec: 1020,
    tags: ['monitor', 'editing video', 'review gadget', 'setup meja'],
    topicLabel: 'IPS VS OLED',
    metricBadge: 'Tes 1 Tahun',
    palette: ['#090D16', '#1D4ED8', '#60A5FA'],
    thumbnailHd: true,
  },
  {
    id: 'demo_v20',
    title: '3 Kesalahan Framing Kamera yang Membuat Video Terlihat Amatir',
    description: 'Atur ketinggian lensa sejajar mata dan beri ruang napas di atas kepala.',
    daysAgo: 58,
    weekday: 5,
    hour: 18,
    views: 92000,
    likes: 6100,
    comments: 185,
    durationSec: 44,
    tags: ['kamera', 'framing', 'tips kreator'],
    topicLabel: 'SHORTS KAMERA',
    metricBadge: 'Eye Level',
    palette: ['#1E293B', '#334155', '#38BDF8'],
    thumbnailHd: true,
  },
  {
    id: 'demo_v21',
    title: 'Panduan Lengkap Export Video Tajam untuk YouTube (Bitrate & Codec H.264/HEVC)',
    description: 'Mengapa bitrate standar sering terlihat pecah pada adegan cepat dan setelan ekspor yang disarankan.',
    daysAgo: 62,
    weekday: 3,
    hour: 19,
    views: 129000,
    likes: 7900,
    comments: 470,
    durationSec: 760,
    tags: ['editing video', 'codec', 'tutorial', 'export'],
    topicLabel: 'EXPORT GUIDE',
    metricBadge: 'Tajam 4K',
    palette: ['#0F172A', '#1E3A5F', '#2DD4BF'],
    thumbnailHd: true,
  },
  {
    id: 'demo_v22',
    title: 'Review Keyboard Mechanical Low-Profile Setelah 6 Bulan Mengetik Skrip',
    description: 'Kenyamanan switch taktil, daya tahan baterai nirkabel, dan suara ketikan saat merekam dekat mikrofon.',
    daysAgo: 66,
    weekday: 6,
    hour: 14,
    views: 51000,
    likes: 2150,
    comments: 178,
    durationSec: 590,
    tags: ['keyboard', 'setup meja', 'review gadget', 'produktivitas'],
    topicLabel: 'KEYBOARD TEST',
    metricBadge: '6 Bulan Pakai',
    palette: ['#18181B', '#312E81', '#818CF8'],
    thumbnailHd: true,
  },
  {
    id: 'demo_v23',
    title: 'Cek Akurasi Warna Layar Ponsel Sebelum Publish Thumbnail',
    description: 'Pastikan teks tetap terbaca di mode kecerahan rendah dan layar kecil.',
    daysAgo: 69,
    weekday: 4,
    hour: 20,
    views: 108000,
    likes: 7300,
    comments: 210,
    durationSec: 36,
    tags: ['thumbnail', 'desain', 'tips kreator'],
    topicLabel: 'SHORTS DESAIN',
    metricBadge: 'Uji Layar HP',
    palette: ['#0F172A', '#134E4A', '#2DD4BF'],
    thumbnailHd: true,
  },
  {
    id: 'demo_v24',
    title: 'Membangun Alur Produksi 2 Video per Minggu Tanpa Burnout',
    description: 'Pembagian jadwal batching riset hari Senin, syuting Rabu, dan penyuntingan Jumat.',
    daysAgo: 73,
    weekday: 2,
    hour: 19,
    views: 134000,
    likes: 8500,
    comments: 615,
    durationSec: 815,
    tags: ['produktivitas', 'workflow', 'tips kreator', 'strategi konten'],
    topicLabel: 'BATCHING PLAN',
    metricBadge: '2 Video / Mgg',
    palette: ['#111827', '#1E293B', '#3DA5FF'],
    thumbnailHd: true,
  },
  {
    id: 'demo_v25',
    title: 'Apakah Capture Card 4K60 Wajib untuk Tutorial Software & Coding?',
    description: 'Perbandingan beban CPU rekaman layar langsung dengan OBS versus perangkat capture eksternal.',
    daysAgo: 76,
    weekday: 0,
    hour: 10,
    views: 34500,
    likes: 1290,
    comments: 104,
    durationSec: 675,
    tags: ['obs', 'tutorial', 'hardware', 'streaming'],
    topicLabel: 'CAPTURE TEST',
    metricBadge: 'OBS vs Card',
    palette: ['#1E293B', '#0F172A', '#94A3B8'],
    thumbnailHd: true,
  },
  {
    id: 'demo_v26',
    title: 'Cara Menentukan Panjang Judul Optimal agar Tidak Terpotong di Beranda Mobile',
    description: 'Batas aman 50–60 karakter dengan kata kunci paling kuat di 4 kata pertama.',
    daysAgo: 79,
    weekday: 3,
    hour: 19,
    views: 87000,
    likes: 5600,
    comments: 190,
    durationSec: 47,
    tags: ['judul', 'ctr', 'tips kreator', 'analitik'],
    topicLabel: 'SHORTS JUDUL',
    metricBadge: '50–60 Karakter',
    palette: ['#0F172A', '#1E3A8A', '#60A5FA'],
    thumbnailHd: true,
  },
  {
    id: 'demo_v27',
    title: 'Rekap Q&A: Menjawab 12 Pertanyaan Paling Sering tentang Peralatan Video',
    description: 'Jawaban ringkas soal budget pemula, upgrade prioritas pertama, dan perawatan lensa.',
    daysAgo: 82,
    weekday: 5,
    hour: 15,
    views: 47500,
    likes: 2050,
    comments: 280,
    durationSec: 1290,
    tags: ['qna', 'kamera', 'audio', 'tips kreator'],
    topicLabel: 'Q&A STUDIO',
    metricBadge: '12 Jawaban',
    palette: ['#18181B', '#27272A', '#38BDF8'],
    thumbnailHd: false,
  },
  {
    id: 'demo_v28',
    title: 'Trik Transisi J-Cut dan L-Cut agar Alur Bicara Terasa Natural',
    description: 'Geser klip audio 0,5 detik sebelum perpindahan gambar untuk ritme penyuntingan lebih halus.',
    daysAgo: 85,
    weekday: 1,
    hour: 19,
    views: 79000,
    likes: 5200,
    comments: 165,
    durationSec: 55,
    tags: ['editing video', 'audio', 'tutorial'],
    topicLabel: 'SHORTS CUT',
    metricBadge: 'J-Cut / L-Cut',
    palette: ['#0F172A', '#1E293B', '#2DD4BF'],
    thumbnailHd: true,
  },
];

const dateOnWeekday = (now: number, daysAgo: number, weekday: number, hour: number): Date => {
  const d = new Date(now - daysAgo * 86400000);
  const diff = (d.getDay() - weekday + 7) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(hour, 15, 0, 0);
  return d;
};

/** Dataset contoh luring lengkap untuk mencoba seluruh modul analitik tanpa API key. */
export const createDemoChannelData = (now = Date.now()): AnalyzedData => {
  const channelId = 'UCdemoNusaTechLab00001';
  const channelTitle = 'Nusa Tech Lab';

  const rawVideos: VideoItem[] = SEEDS.map(s => {
    const publishedDate = dateOnWeekday(now, s.daysAgo, s.weekday, s.hour);
    const publishedAt = publishedDate.toISOString();
    const isShort = s.durationSec > 0 && s.durationSec <= 180;
    const er = s.views > 0 && !s.likesHidden ? ((s.likes + s.comments) / s.views) * 100 : 0;

    return {
      id: s.id,
      title: s.title,
      description: s.description,
      thumbnail: makeThumbnail(s.palette[0], s.palette[1], s.palette[2], s.topicLabel, s.metricBadge, isShort),
      views: formatNumber(s.views),
      viewCountRaw: s.views,
      likes: formatNumber(s.likes),
      likeCountRaw: s.likes,
      comments: formatNumber(s.comments),
      commentCountRaw: s.comments,
      engagementRate: parseFloat(er.toFixed(2)),
      tags: s.tags,
      publishedAt,
      publishedAtDate: publishedDate,
      publishedTimeAgo: timeAgo(publishedAt),
      durationSec: s.durationSec,
      durationFormatted: formatDuration(s.durationSec),
      channelTitle,
      channelId,
      isShort,
      likesHidden: s.likesHidden,
      thumbnailHd: s.thumbnailHd ?? true,
    };
  });

  const videos = markOutliers(rawVideos);

  return {
    videos,
    channelTitle,
    channelId,
    channelStats: {
      channelId,
      title: channelTitle,
      subscriberCount: formatNumber(486000),
      subCountRaw: 486000,
      viewCount: formatNumber(42800000),
      viewCountRaw: 42800000,
      videoCount: formatNumber(286),
      videoCountRaw: 286,
      customUrl: '@nusatechlab',
      description:
        'Eksperimen audio, kamera, alur editing, dan strategi pertumbuhan berbasis data untuk kreator video Indonesia. Jadwal rutin setiap Selasa dan Kamis malam.',
      avatar: makeAvatar(),
      banner: '',
    },
    totalFound: videos.length,
    source: 'channel',
    query: '@nusatechlab',
    notice: 'Mode data contoh aktif — semua metrik, skor A–F, peta panas jadwal, dan ekspor berjalan langsung di browser tanpa kuota API.',
    requestedLimit: 50,
  };
};
