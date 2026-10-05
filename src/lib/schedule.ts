import { VideoItem } from '../types';
import { calculateAllVideoScores } from '../services/performanceScoreService';

/**
 * Analisis jadwal upload.
 *
 * Views mentah tidak adil untuk membandingkan slot: video lama sudah mengumpulkan views lebih lama, dan satu video viral
 * membuat rata-rata melonjak. Karena itu tiap video dinilai dengan "performa" = views ÷ perkiraan views video seusia di
 * kelompoknya (mesin skor v2), dibatasi 0,2×–5× per video, lalu rata-rata geometrik per slot ditarik ke 1,0× bila
 * sampelnya sedikit (shrinkage).
 */

export const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
export const DAYS_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
/** Senin di atas, seperti kalender Indonesia */
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
/** Lebar blok jam untuk rekomendasi (8 blok per hari) */
export const BLOCK_HOURS = 3;
/** Kekuatan prior (jumlah upload "semu" dengan performa 1,0×) */
export const SHRINK_K = 2;
/** Minimal upload agar slot boleh masuk peringkat terbaik/terendah */
export const MIN_SLOT_UPLOADS = 2;
/** Batas pengaruh satu video (5× / 0,2×) agar satu video viral tidak menentukan slot sendirian */
export const MAX_VIDEO_EFFECT = 5;
const LOG_CLIP = Math.log10(MAX_VIDEO_EFFECT);

export type SlotConfidence = 'tinggi' | 'sedang' | 'rendah';

export interface SlotStats {
  count: number;
  /** Performa ter-shrink (1 = setara video seusia) */
  performance: number;
  /** Rata-rata geometrik performa tanpa shrinkage */
  rawPerformance: number;
  medianViews: number;
  avgViews: number;
  confidence: SlotConfidence;
}

export interface Slot extends SlotStats {
  day: number;
  /** Jam awal (0–23) */
  hour: number;
  /** Jumlah jam yang dicakup (1 untuk sel peta panas, BLOCK_HOURS untuk blok) */
  span: number;
}

export type SchedulePoint = {
  day: number;
  hour: number;
  logPerf: number;
  views: number;
  /** Video asal (tidak ada di data uji sintetis) */
  id?: string;
  /** Rasio jangkauan asli (tanpa batas 0,2×–5×) */
  reach?: number;
};

/** Rentang waktu yang dicakup sebuah slot/kelompok (untuk memfilter daftar video). */
export interface SlotMatch {
  day?: number;
  /** Jam awal (inklusif) dan akhir (eksklusif); 0–24 */
  from: number;
  to: number;
}

export const matchesSlot = (m: SlotMatch, day: number, hour: number) =>
  (m.day === undefined || m.day === day) && hour >= m.from && hour < m.to;

export interface ScheduleAnalysis {
  total: number;
  points: SchedulePoint[];
  cells: Slot[][];
  blocks: Slot[];
  byDay: Array<SlotStats & { day: number }>;
  byHour: Array<SlotStats & { hour: number }>;
  best: Slot[];
  worst: Slot[];
  bestDay: (SlotStats & { day: number }) | null;
  bestHour: (SlotStats & { hour: number }) | null;
  busiestDay: (SlotStats & { day: number }) | null;
  maxCount: number;
  maxAvgViews: number;
}

type Point = SchedulePoint;

const median = (nums: number[]) => {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export const confidenceOf = (n: number): SlotConfidence => (n >= 5 ? 'tinggi' : n >= 3 ? 'sedang' : 'rendah');

export const summarize = (points: Point[]): SlotStats => {
  const n = points.length;
  const sumLog = points.reduce((s, p) => s + p.logPerf, 0);
  const views = points.map(p => p.views);
  return {
    count: n,
    performance: 10 ** (sumLog / (n + SHRINK_K)),
    rawPerformance: n ? 10 ** (sumLog / n) : 1,
    medianViews: median(views),
    avgViews: n ? views.reduce((a, b) => a + b, 0) / n : 0,
    confidence: confidenceOf(n),
  };
};

export const formatHour = (h: number) => `${String(h % 24).padStart(2, '0')}.00`;
export const formatSlotTime = (s: Pick<Slot, 'hour' | 'span'>) =>
  s.span > 1 ? `${formatHour(s.hour)}–${formatHour(s.hour + s.span)}` : formatHour(s.hour);

/** "1,8×" / "0,6×" */
export const formatPerformance = (p: number) => `${p.toLocaleString('id-ID', { maximumFractionDigits: p >= 10 ? 0 : 1, minimumFractionDigits: p >= 10 ? 0 : 1 })}×`;

const rankable = <T extends SlotStats>(list: T[]) => list.filter(s => s.count >= MIN_SLOT_UPLOADS);

export const analyzeSchedule = (videos: VideoItem[], now = Date.now()): ScheduleAnalysis => {
  const scored = calculateAllVideoScores(videos, now);
  const points: Point[] = [];
  scored.forEach(v => {
    const date = new Date(v.publishedAt);
    if (Number.isNaN(date.getTime())) return;
    points.push({
      id: v.id,
      reach: v.metrics.reachRatio,
      day: date.getDay(),
      hour: date.getHours(),
      logPerf: Math.max(-LOG_CLIP, Math.min(LOG_CLIP, Math.log10(Math.max(v.metrics.reachRatio, 1e-6)))),
      views: v.viewCountRaw,
    });
  });

  const cells: Slot[][] = Array.from({ length: 7 }, (_, day) =>
    Array.from({ length: 24 }, (_, hour) => ({
      day,
      hour,
      span: 1,
      ...summarize(points.filter(p => p.day === day && p.hour === hour)),
    }))
  );

  const blocks: Slot[] = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour += BLOCK_HOURS) {
      const pts = points.filter(p => p.day === day && p.hour >= hour && p.hour < hour + BLOCK_HOURS);
      blocks.push({ day, hour, span: BLOCK_HOURS, ...summarize(pts) });
    }
  }

  const byDay = Array.from({ length: 7 }, (_, day) => ({ day, ...summarize(points.filter(p => p.day === day)) }));
  const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, ...summarize(points.filter(p => p.hour === hour)) }));

  const byPerfDesc = <T extends SlotStats>(a: T, b: T) => b.performance - a.performance || b.count - a.count;
  const rankedBlocks = rankable(blocks).sort(byPerfDesc);
  // Terbaik = di atas rata-rata (≥ 1×), terendah = di bawah rata-rata — tidak pernah tumpang tindih
  const best = rankedBlocks.filter(s => s.performance >= 1).slice(0, 3);
  const worst = rankedBlocks.filter(s => s.performance < 1).reverse().slice(0, 3);

  const flatCells = cells.flat();
  return {
    total: points.length,
    points,
    cells,
    blocks,
    byDay,
    byHour,
    best,
    worst,
    bestDay: rankable(byDay).sort(byPerfDesc)[0] ?? null,
    bestHour: rankable(byHour).sort(byPerfDesc)[0] ?? null,
    busiestDay: [...byDay].sort((a, b) => b.count - a.count)[0]?.count ? [...byDay].sort((a, b) => b.count - a.count)[0] : null,
    maxCount: Math.max(1, ...flatCells.map(c => c.count)),
    maxAvgViews: Math.max(1, ...flatCells.map(c => c.avgViews)),
  };
};

/** Cara mengelompokkan waktu upload pada tabel peringkat. */
export type ScheduleGrouping = 'day' | 'hour' | 'block' | 'daypart' | 'dayhour';

export const GROUPING_LABELS: Record<ScheduleGrouping, string> = {
  day: 'Hari',
  hour: 'Jam',
  block: 'Blok 3 jam',
  daypart: 'Bagian hari',
  dayhour: 'Hari × jam',
};

/** Bagian hari (jam lokal): [label, jam mulai, jam selesai) */
export const DAYPARTS: Array<[string, number, number]> = [
  ['Dini hari', 0, 5],
  ['Pagi', 5, 11],
  ['Siang', 11, 15],
  ['Sore', 15, 18],
  ['Malam', 18, 24],
];

export interface GroupRow extends SlotStats {
  key: string;
  label: string;
  /** Boleh diperingkat (≥ MIN_SLOT_UPLOADS upload) */
  rankable: boolean;
  /** Urutan kronologis (Senin → Minggu, 00.00 → 23.00) */
  order: number;
  /** Rentang waktu kelompok ini */
  match: SlotMatch;
}

const dayIndex = (d: number) => DAY_ORDER.indexOf(d);

/** Nama bagian hari untuk jam lokal tertentu */
export const daypartOf = (hour: number) => (DAYPARTS.find(([, from, to]) => hour >= from && hour < to) ?? DAYPARTS[0])[0];

/** Kalimat rekomendasi dari slot terbaik (null bila belum ada slot yang bisa diperingkat). */
export const scheduleRecommendation = (a: Pick<ScheduleAnalysis, 'best'>): string | null => {
  const b = a.best[0];
  if (!b) return null;
  return `Upload hari ${DAYS[b.day]} pukul ${formatSlotTime(b)} rata-rata mendapat ${formatPerformance(b.performance)} views video seusia (${b.count} upload, keyakinan ${b.confidence}).${
    b.confidence === 'rendah'
      ? ' Sampelnya masih sedikit - uji jadwal ini beberapa kali sebelum menjadikannya patokan.'
      : ' Topik dan judul tetap berpengaruh besar, jadi gunakan sebagai patokan awal lalu uji.'
  }`;
};

/**
 * Kelompokkan upload sesuai pilihan, urutkan dari performa tertinggi. Kelompok tanpa upload dibuang; kelompok dengan
 * sampel terlalu sedikit ditaruh di bawah.
 */
export const groupSchedule = (points: SchedulePoint[], grouping: ScheduleGrouping): GroupRow[] => {
  const groups = new Map<string, { label: string; order: number; match: SlotMatch; pts: SchedulePoint[] }>();
  const add = (key: string, label: string, order: number, p: SchedulePoint, match: SlotMatch) => {
    const g = groups.get(key) ?? { label, order, match, pts: [] };
    g.pts.push(p);
    groups.set(key, g);
  };
  points.forEach(p => {
    if (grouping === 'day') add(`d${p.day}`, DAYS[p.day], dayIndex(p.day), p, { day: p.day, from: 0, to: 24 });
    else if (grouping === 'hour') add(`h${p.hour}`, `${formatHour(p.hour)}–${formatHour(p.hour + 1)}`, p.hour, p, { from: p.hour, to: p.hour + 1 });
    else if (grouping === 'block') {
      const start = p.hour - (p.hour % BLOCK_HOURS);
      add(`b${start}`, formatSlotTime({ hour: start, span: BLOCK_HOURS }), start, p, { from: start, to: start + BLOCK_HOURS });
    } else if (grouping === 'daypart') {
      const i = DAYPARTS.findIndex(([, from, to]) => p.hour >= from && p.hour < to);
      const [label, from, to] = DAYPARTS[i];
      add(`p${i}`, `${label} (${formatHour(from)}–${formatHour(to)})`, i, p, { from, to });
    } else {
      add(`d${p.day}h${p.hour}`, `${DAYS[p.day]}, ${formatHour(p.hour)}`, dayIndex(p.day) * 24 + p.hour, p, { day: p.day, from: p.hour, to: p.hour + 1 });
    }
  });

  return Array.from(groups.entries())
    .map(([key, g]) => {
      const stats = summarize(g.pts);
      return { key, label: g.label, order: g.order, match: g.match, rankable: stats.count >= MIN_SLOT_UPLOADS, ...stats };
    })
    .sort((a, b) => Number(b.rankable) - Number(a.rankable) || b.performance - a.performance || a.order - b.order);
};
