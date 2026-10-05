// Model data laporan — dipakai bersama oleh semua format ekspor (Excel, PDF, JSON, CSV, HTML, ZIP)

import { VideoItem, ChannelStats, AnalysisSource } from '../../types';
import { calculateAllVideoScores, getGradeDistribution, Grade, SCORE_MODEL, VideoWithScores } from '../performanceScoreService';
import { thumbnailUrl } from '../../lib/video';
import { median } from '../../lib/format';

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
  scored: VideoWithScores;
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
  rows: ReportRow[];
}

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

  return { context, summary, rows };
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
  ['Catatan', 'Skor bersifat relatif terhadap video lain dalam ekspor ini, bukan nilai absolut YouTube. CTR & retensi asli hanya tersedia di YouTube Studio.'],
];

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
