// Model data laporan — dipakai bersama oleh semua format ekspor (Excel, PDF, JSON, CSV, HTML, ZIP)

import { VideoItem, ChannelStats, AnalysisSource } from '../../types';
import { calculateAllVideoScores, getGradeDistribution, Grade, SCORE_MODEL, VideoWithScores } from '../performanceScoreService';
import { thumbnailUrl } from '../../lib/video';
import { median } from '../../lib/format';
import {
  analyzeSchedule,
  groupSchedule,
  scheduleRecommendation,
  daypartOf,
  DAYS,
  DAY_ORDER,
  formatHour,
  formatSlotTime,
  ScheduleGrouping,
  SlotConfidence,
  Slot,
} from '../../lib/schedule';

export const APP_NAME = 'YT Analyzer Pro';
export const REPORT_SCHEMA_VERSION = 1;

export interface ExportContext {
  title: string;
  source?: AnalysisSource | 'saved';
  query?: string;
  channelStats?: ChannelStats;
  /** Keterangan cakupan data, mis. "Filter aktif: Shorts, 30 hari terakhir" */
  scopeNote?: string;
  generatedAt: Date;
}

export interface ReportRow {
  no: number;
  id: string;
  title: string;
  url: string;
  type: 'Shorts' | 'Video';
  channelTitle: string;
  channelId: string;
  publishedAt: string;
  ageDays: number;
  durationSec: number;
  duration: string;
  views: number;
  likes: number | null;
  comments: number | null;
  engagementRate: number | null;
  viewsPerDay: number;
  reachRatio: number;
  isOutlier: boolean;
  titleScore: number;
  titleGrade: Grade;
  thumbnailScore: number;
  thumbnailGrade: Grade;
  scoreConfidence: string;
  scoreCohort: string;
  tags: string[];
  description: string;
  thumbnailHd: boolean | null;
  thumbnails: { default: string; medium: string; high: string; standard: string; maxres: string };
  /** Waktu upload dalam zona waktu lokal pembuat laporan */
  uploadDay: string;
  /** Slot jam, mis. "19.00" */
  uploadHour: string;
  /** Jam tepat, mis. "19.42" */
  uploadTime: string;
  /** Tanggal lokal yyyy-mm-dd */
  uploadDate: string;
  uploadDaypart: string;
  scored: VideoWithScores;
}

export interface ScheduleRow {
  label: string;
  uploads: number;
  /** Performa ter-shrink (1 = setara video seusia) */
  performance: number;
  medianViews: number;
  avgViews: number;
  confidence: SlotConfidence;
  /** Peringkat performa (null bila upload < 2) */
  rank: number | null;
}

export interface ScheduleSlotRow {
  day: string;
  time: string;
  uploads: number;
  performance: number;
  medianViews: number;
  confidence: SlotConfidence;
}

export interface ReportSchedule {
  timeZone: string;
  /** mis. "UTC+07:00" */
  utcOffset: string;
  totalVideos: number;
  bestDay: { day: string; performance: number; uploads: number } | null;
  bestHour: { hour: string; performance: number; uploads: number } | null;
  busiestDay: { day: string; uploads: number } | null;
  recommendation: string | null;
  bestSlots: ScheduleSlotRow[];
  worstSlots: ScheduleSlotRow[];
  /** Dalam urutan kronologis (Senin → Minggu, 00.00 → 23.00) */
  groups: Record<Exclude<ScheduleGrouping, 'dayhour'>, ScheduleRow[]>;
  /** Peta panas hari × jam; baris mengikuti `days`, kolom jam 0–23 */
  heatmap: { days: string[]; uploads: number[][]; performance: Array<Array<number | null>> };
}

export interface TagStat {
  tag: string;
  count: number;
  totalViews: number;
  avgViews: number;
}

export interface ReportSummary {
  totalVideos: number;
  shorts: number;
  long: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  avgViews: number;
  medianViews: number;
  avgEngagementRate: number;
  outliers: number;
  avgTitleScore: number;
  avgThumbnailScore: number;
  titleGrades: Record<Grade, number>;
  thumbnailGrades: Record<Grade, number>;
  firstPublished: string | null;
  lastPublished: string | null;
  uploadsPerWeek: number;
  topTags: TagStat[];
  formats: Array<{ type: 'Video' | 'Shorts'; count: number; avgViews: number; avgEngagementRate: number }>;
}

export interface Report {
  context: ExportContext;
  summary: ReportSummary;
  schedule: ReportSchedule;
  rows: ReportRow[];
}

const utcOffsetLabel = (d: Date) => {
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const abs = Math.abs(off);
  return `UTC${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
};

const slotRow = (s: Slot): ScheduleSlotRow => ({
  day: DAYS[s.day],
  time: formatSlotTime(s),
  uploads: s.count,
  performance: Math.round(s.performance * 100) / 100,
  medianViews: Math.round(s.medianViews),
  confidence: s.confidence,
});

/** Ringkasan jadwal upload (logika sama dengan halaman Jadwal Upload). */
export const buildScheduleSection = (videos: VideoItem[], generatedAt: Date): ReportSchedule => {
  const a = analyzeSchedule(videos, generatedAt.getTime());
  const group = (g: Exclude<ScheduleGrouping, 'dayhour'>): ScheduleRow[] => {
    const ranked = groupSchedule(a.points, g);
    let rank = 0;
    return ranked
      .map(r => ({
        order: r.order,
        label: r.label,
        uploads: r.count,
        performance: Math.round(r.performance * 100) / 100,
        medianViews: Math.round(r.medianViews),
        avgViews: Math.round(r.avgViews),
        confidence: r.confidence,
        rank: r.rankable ? ++rank : null,
      }))
      .sort((x, y) => x.order - y.order)
      .map(({ order: _order, ...row }) => row);
  };
  return {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'lokal',
    utcOffset: utcOffsetLabel(generatedAt),
    totalVideos: a.total,
    bestDay: a.bestDay ? { day: DAYS[a.bestDay.day], performance: Math.round(a.bestDay.performance * 100) / 100, uploads: a.bestDay.count } : null,
    bestHour: a.bestHour ? { hour: formatHour(a.bestHour.hour), performance: Math.round(a.bestHour.performance * 100) / 100, uploads: a.bestHour.count } : null,
    busiestDay: a.busiestDay ? { day: DAYS[a.busiestDay.day], uploads: a.busiestDay.count } : null,
    recommendation: scheduleRecommendation(a),
    bestSlots: a.best.map(slotRow),
    worstSlots: a.worst.map(slotRow),
    groups: { day: group('day'), daypart: group('daypart'), block: group('block'), hour: group('hour') },
    heatmap: {
      days: DAY_ORDER.map(d => DAYS[d]),
      uploads: DAY_ORDER.map(d => a.cells[d].map(c => c.count)),
      performance: DAY_ORDER.map(d => a.cells[d].map(c => (c.count ? Math.round(c.performance * 100) / 100 : null))),
    },
  };
};

const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const avg = (nums: number[]) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0);

export const buildReport = (videos: VideoItem[], context: ExportContext): Report => {
  const scored = calculateAllVideoScores(videos, context.generatedAt.getTime());

  const rows: ReportRow[] = scored.map((v, i) => ({
    no: i + 1,
    id: v.id,
    title: v.title,
    url: v.isShort ? `https://www.youtube.com/shorts/${v.id}` : `https://www.youtube.com/watch?v=${v.id}`,
    type: v.isShort ? 'Shorts' : 'Video',
    channelTitle: v.channelTitle,
    channelId: v.channelId,
    publishedAt: v.publishedAt,
    ageDays: Math.round(v.metrics.ageDays),
    durationSec: v.durationSec,
    duration: v.durationFormatted,
    views: v.viewCountRaw,
    likes: v.likesHidden ? null : v.likeCountRaw,
    comments: v.commentsDisabled ? null : v.commentCountRaw,
    engagementRate: v.likesHidden || !v.viewCountRaw ? null : round(((v.likeCountRaw + v.commentCountRaw) / v.viewCountRaw) * 100),
    viewsPerDay: Math.round(v.metrics.viewsPerDay),
    reachRatio: round(v.metrics.reachRatio),
    isOutlier: !!v.isOutlier,
    titleScore: v.titleScore.totalScore,
    titleGrade: v.titleScore.grade,
    thumbnailScore: v.thumbnailScore.totalScore,
    thumbnailGrade: v.thumbnailScore.grade,
    scoreConfidence: v.titleScore.confidence,
    scoreCohort: v.metrics.cohort,
    tags: v.tags,
    description: v.description,
    thumbnailHd: typeof v.thumbnailHd === 'boolean' ? v.thumbnailHd : null,
    thumbnails: {
      default: thumbnailUrl(v.id, 'default'),
      medium: thumbnailUrl(v.id, 'mq'),
      high: thumbnailUrl(v.id, 'hq'),
      standard: thumbnailUrl(v.id, 'sd'),
      maxres: thumbnailUrl(v.id, 'maxres'),
    },
    ...(() => {
      const d = new Date(v.publishedAt);
      const pad = (n: number) => String(n).padStart(2, '0');
      return Number.isNaN(d.getTime())
        ? { uploadDay: '-', uploadHour: '-', uploadTime: '-', uploadDate: '-', uploadDaypart: '-' }
        : {
            uploadDay: DAYS[d.getDay()],
            uploadHour: formatHour(d.getHours()),
            uploadTime: `${pad(d.getHours())}.${pad(d.getMinutes())}`,
            uploadDate: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
            uploadDaypart: daypartOf(d.getHours()),
          };
    })(),
    scored: v,
  }));

  // Tag
  const tagMap = new Map<string, TagStat>();
  rows.forEach(r =>
    r.tags.forEach(raw => {
      const key = raw.trim().toLowerCase();
      if (!key) return;
      const t = tagMap.get(key) ?? { tag: raw.trim(), count: 0, totalViews: 0, avgViews: 0 };
      t.count += 1;
      t.totalViews += r.views;
      tagMap.set(key, t);
    })
  );
  const topTags = Array.from(tagMap.values())
    .map(t => ({ ...t, avgViews: Math.round(t.totalViews / t.count) }))
    .sort((a, b) => b.count - a.count || b.avgViews - a.avgViews)
    .slice(0, 50);

  const times = rows.map(r => new Date(r.publishedAt).getTime()).filter(Boolean).sort((a, b) => a - b);
  const spanWeeks = times.length > 1 ? (times[times.length - 1] - times[0]) / (7 * 86400000) : 0;
  const ers = rows.map(r => r.engagementRate).filter((e): e is number => e !== null);
  const fmt = (type: 'Video' | 'Shorts') => {
    const list = rows.filter(r => r.type === type);
    return {
      type,
      count: list.length,
      avgViews: Math.round(avg(list.map(r => r.views))),
      avgEngagementRate: round(avg(list.map(r => r.engagementRate).filter((e): e is number => e !== null))),
    };
  };

  const summary: ReportSummary = {
    totalVideos: rows.length,
    shorts: rows.filter(r => r.type === 'Shorts').length,
    long: rows.filter(r => r.type === 'Video').length,
    totalViews: rows.reduce((s, r) => s + r.views, 0),
    totalLikes: rows.reduce((s, r) => s + (r.likes ?? 0), 0),
    totalComments: rows.reduce((s, r) => s + (r.comments ?? 0), 0),
    avgViews: Math.round(avg(rows.map(r => r.views))),
    medianViews: Math.round(median(rows.map(r => r.views))),
    avgEngagementRate: round(avg(ers)),
    outliers: rows.filter(r => r.isOutlier).length,
    avgTitleScore: Math.round(avg(rows.map(r => r.titleScore))),
    avgThumbnailScore: Math.round(avg(rows.map(r => r.thumbnailScore))),
    titleGrades: getGradeDistribution(scored.map(v => v.titleScore)),
    thumbnailGrades: getGradeDistribution(scored.map(v => v.thumbnailScore)),
    firstPublished: times.length ? new Date(times[0]).toISOString() : null,
    lastPublished: times.length ? new Date(times[times.length - 1]).toISOString() : null,
    uploadsPerWeek: spanWeeks >= 1 ? round(rows.length / spanWeeks, 1) : rows.length,
    topTags,
    formats: [fmt('Video'), fmt('Shorts')],
  };

  return { context, summary, schedule: buildScheduleSection(videos, context.generatedAt), rows };
};

export const METHODOLOGY: Array<[string, string]> = [
  ['Shorts', 'Video berdurasi 1 detik hingga 3 menit (batas YouTube Shorts sejak Oktober 2024).'],
  ['Engagement rate (ER)', '(likes + komentar) ÷ views × 100. Kosong bila kreator menyembunyikan jumlah like.'],
  ['Views/hari', 'Total views ÷ umur video (hari).'],
  ['Rasio jangkauan', 'Views aktual ÷ perkiraan views video seusia dalam kelompok yang sama (Shorts vs Shorts, Video vs Video). Perkiraan = median kelompok × t/(t+τ), τ = 7 hari (video) / 4 hari (Shorts). 1,0 = sesuai ekspektasi; 2,0 = dua kali lipat.'],
  ['Outlier', 'Views ≥ 3× median views daftar yang dianalisis.'],
  [
    'Skor judul',
    `${SCORE_MODEL.title.reach}% jangkauan (persentil vs video seusia) + ${SCORE_MODEL.title.engagement}% engagement (persentil, dihaluskan) + ${SCORE_MODEL.title.text}% kualitas teks judul (panjang, pemikat, kapitalisasi, kebersihan, kejelasan).`,
  ],
  [
    'Skor thumbnail',
    `${SCORE_MODEL.thumbnail.reach}% daya klik (jangkauan vs video seusia) + ${SCORE_MODEL.thumbnail.engagement}% kesesuaian isi (engagement) + ${SCORE_MODEL.thumbnail.technical}% kualitas teknis (thumbnail HD 1280×720; video panjang saja).`,
  ],
  ['Nilai', `A ≥ ${SCORE_MODEL.grades.A} • B ≥ ${SCORE_MODEL.grades.B} • C ≥ ${SCORE_MODEL.grades.C} (≈ rata-rata) • D ≥ ${SCORE_MODEL.grades.D} • F < ${SCORE_MODEL.grades.D}`],
  ['Keyakinan', 'Rendah bila video < 2 hari atau views < 100; sedang bila pembanding < 8 video.'],
  [
    'Jadwal upload',
    'Waktu upload memakai zona waktu perangkat pembuat laporan. Performa slot = rata-rata geometrik rasio jangkauan video di slot itu (dibatasi 0,2×–5× per video) yang ditarik ke 1,0× bila sampel sedikit. 1,0× = setara video seusia. Slot baru diperingkat bila ada ≥ 2 upload; keyakinan tinggi ≥ 5 upload, sedang ≥ 3.',
  ],
  ['Catatan', 'Skor bersifat relatif terhadap video lain dalam ekspor ini, bukan nilai absolut YouTube. CTR & retensi asli hanya tersedia di YouTube Studio.'],
];

/** Warna performa jadwal (RGB): biru bila > 1×, merah bila < 1×, makin pekat makin jauh dari rata-rata; abu-abu bila kosong. */
export const performanceRgb = (p: number | null): [number, number, number] => {
  if (p === null) return [242, 242, 242];
  const strength = Math.min(1, Math.abs(Math.log10(Math.max(p, 1e-3))) / 0.6);
  const alpha = p >= 1 ? 0.12 + strength * 0.88 : 0.12 + strength * 0.75;
  const base = p >= 1 ? [6, 95, 212] : [255, 0, 0];
  return base.map(c => Math.round(255 + (c - 255) * alpha)) as [number, number, number];
};

export const GRADE_COLORS: Record<Grade, string> = {
  A: '0B8043',
  B: '065FD4',
  C: 'F9AB00',
  D: 'E8710A',
  F: 'CC0000',
};

export const sourceLabel = (ctx: ExportContext) => {
  switch (ctx.source) {
    case 'channel':
      return 'Channel';
    case 'playlist':
      return 'Playlist';
    case 'search':
      return 'Pencarian kata kunci';
    case 'trending':
      return 'Trending';
    case 'saved':
      return 'Video tersimpan';
    default:
      return 'Analisis';
  }
};

export const formatDateId = (iso: string | Date | null, withTime = false) =>
  iso
    ? new Date(iso).toLocaleString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
      })
    : '-';
