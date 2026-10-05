import { VideoItem, ContentTypeFilter, SortOption, DurationRange, DateRangeFilter } from '../types';

export interface VideoFilters {
  contentType: ContentTypeFilter;
  sort: SortOption;
  duration: DurationRange;
  dateRange: DateRangeFilter;
  minViews: number;
  minLikes: number;
  minER: number;
  keyword: string;
  outliersOnly: boolean;
}

export const DEFAULT_FILTERS: VideoFilters = {
  contentType: 'all',
  sort: 'popular',
  duration: 'all',
  dateRange: 'all',
  minViews: 0,
  minLikes: 0,
  minER: 0,
  keyword: '',
  outliersOnly: false,
};

export const SORT_LABELS: Record<SortOption, string> = {
  popular: 'Terpopuler',
  newest: 'Terbaru',
  oldest: 'Terlama',
  most_liked: 'Paling disukai',
  most_commented: 'Komentar terbanyak',
  highest_er: 'ER tertinggi',
};

export const DURATION_LABELS: Record<DurationRange, string> = {
  all: 'Semua durasi',
  under_1: 'Di bawah 1 menit',
  '1_5': '1–5 menit',
  '5_20': '5–20 menit',
  over_20: 'Lebih dari 20 menit',
};

export const DATE_LABELS: Record<DateRangeFilter, string> = {
  all: 'Kapan saja',
  '7d': '7 hari terakhir',
  '30d': '30 hari terakhir',
  '90d': '90 hari terakhir',
  '1y': 'Tahun ini (365 hari)',
};

const DATE_DAYS: Record<Exclude<DateRangeFilter, 'all'>, number> = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };

/** Jumlah filter non-default (untuk badge tombol Filter). Urutan & jenis konten tidak dihitung. */
export const countActiveFilters = (f: VideoFilters): number =>
  [
    f.duration !== 'all',
    f.dateRange !== 'all',
    f.minViews > 0,
    f.minLikes > 0,
    f.minER > 0,
    f.keyword.trim() !== '',
    f.outliersOnly,
  ].filter(Boolean).length;

const matchDuration = (sec: number, range: DurationRange) => {
  switch (range) {
    case 'under_1': return sec < 60;
    case '1_5': return sec >= 60 && sec <= 300;
    case '5_20': return sec > 300 && sec <= 1200;
    case 'over_20': return sec > 1200;
    default: return true;
  }
};

const time = (v: VideoItem) => new Date(v.publishedAt).getTime() || 0;

export const applyFilters = (videos: VideoItem[], f: VideoFilters, now = Date.now()): VideoItem[] => {
  const keyword = f.keyword.trim().toLowerCase();
  const maxAgeMs = f.dateRange === 'all' ? Infinity : DATE_DAYS[f.dateRange] * 86400000;

  const result = videos.filter(v => {
    if (f.contentType === 'shorts' && !v.isShort) return false;
    if (f.contentType === 'long' && v.isShort) return false;
    if (v.viewCountRaw < f.minViews) return false;
    if (v.likeCountRaw < f.minLikes) return false;
    if (v.engagementRate < f.minER) return false;
    if (f.outliersOnly && !v.isOutlier) return false;
    if (!matchDuration(v.durationSec, f.duration)) return false;
    if (maxAgeMs !== Infinity && now - time(v) > maxAgeMs) return false;
    if (keyword && !v.title.toLowerCase().includes(keyword) && !v.tags.some(t => t.toLowerCase().includes(keyword))) {
      return false;
    }
    return true;
  });

  const comparators: Record<SortOption, (a: VideoItem, b: VideoItem) => number> = {
    popular: (a, b) => b.viewCountRaw - a.viewCountRaw,
    most_liked: (a, b) => b.likeCountRaw - a.likeCountRaw,
    most_commented: (a, b) => b.commentCountRaw - a.commentCountRaw,
    highest_er: (a, b) => b.engagementRate - a.engagementRate,
    newest: (a, b) => time(b) - time(a),
    oldest: (a, b) => time(a) - time(b),
  };
  return result.sort(comparators[f.sort] ?? comparators.popular);
};

/** Ringkasan filter aktif untuk ditulis di laporan ekspor (undefined bila tanpa filter). */
export const describeFilters = (f: VideoFilters): string | undefined => {
  const parts: string[] = [];
  if (f.contentType !== 'all') parts.push(f.contentType === 'shorts' ? 'Shorts' : 'Video panjang');
  if (f.dateRange !== 'all') parts.push(DATE_LABELS[f.dateRange]);
  if (f.duration !== 'all') parts.push(DURATION_LABELS[f.duration]);
  if (f.minViews > 0) parts.push(`views ≥ ${f.minViews.toLocaleString('id-ID')}`);
  if (f.minLikes > 0) parts.push(`likes ≥ ${f.minLikes.toLocaleString('id-ID')}`);
  if (f.minER > 0) parts.push(`ER ≥ ${f.minER}%`);
  if (f.keyword.trim()) parts.push(`kata "${f.keyword.trim()}"`);
  if (f.outliersOnly) parts.push('hanya outlier');
  return parts.length ? `${parts.join(', ')} • urut ${SORT_LABELS[f.sort].toLowerCase()}` : undefined;
};
