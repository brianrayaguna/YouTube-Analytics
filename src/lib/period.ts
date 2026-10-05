import { VideoItem } from '../types';

/** Periode statistik (berdasarkan tanggal upload video). */
export type PeriodId = '1d' | '3d' | '7d' | '14d' | '28d' | '1m' | '3m' | '6m' | '1y' | 'ytd' | 'all' | 'custom';

export interface PeriodRange {
  id: PeriodId;
  label: string;
  /** null = sejak awal (semua waktu) */
  start: Date | null;
  end: Date;
}

export interface CustomPeriod {
  /** yyyy-mm-dd (zona waktu lokal) */
  from: string;
  to: string;
}

type PeriodDef = { id: PeriodId; label: string; days?: number; months?: number };

export const PERIODS: PeriodDef[] = [
  { id: '1d', label: '24 jam terakhir', days: 1 },
  { id: '3d', label: '3 hari terakhir', days: 3 },
  { id: '7d', label: '7 hari terakhir', days: 7 },
  { id: '14d', label: '14 hari terakhir', days: 14 },
  { id: '28d', label: '28 hari terakhir', days: 28 },
  { id: '1m', label: '1 bulan terakhir', months: 1 },
  { id: '3m', label: '3 bulan terakhir', months: 3 },
  { id: '6m', label: '6 bulan terakhir', months: 6 },
  { id: '1y', label: '1 tahun terakhir', months: 12 },
  { id: 'ytd', label: 'Tahun ini' },
  { id: 'all', label: 'Semua waktu' },
  { id: 'custom', label: 'Kustom' },
];

const DAY = 86400000;

export const isPeriodId = (v: unknown): v is PeriodId => PERIODS.some(p => p.id === v);

/** yyyy-mm-dd lokal → Date pada awal/akhir hari lokal (null bila tidak valid). */
const parseLocalDate = (s: string, endOfDay: boolean): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? '');
  if (!m) return null;
  const d = endOfDay
    ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999)
    : new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
};

export const toDateInput = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Rentang kustom bawaan: 28 hari terakhir. */
export const defaultCustomPeriod = (now: Date = new Date()): CustomPeriod => ({
  from: toDateInput(new Date(now.getTime() - 27 * DAY)),
  to: toDateInput(now),
});

export const resolvePeriod = (id: PeriodId, now: Date = new Date(), custom?: CustomPeriod): PeriodRange => {
  const def = PERIODS.find(p => p.id === id) ?? PERIODS.find(p => p.id === 'all')!;
  const end = new Date(now);

  if (def.days) return { id: def.id, label: def.label, start: new Date(now.getTime() - def.days * DAY), end };
  if (def.months) {
    const start = new Date(now);
    start.setMonth(start.getMonth() - def.months);
    return { id: def.id, label: def.label, start, end };
  }
  if (def.id === 'ytd') return { id: def.id, label: def.label, start: new Date(now.getFullYear(), 0, 1), end };
  if (def.id === 'custom') {
    const c = custom ?? defaultCustomPeriod(now);
    let start = parseLocalDate(c.from, false);
    let stop = parseLocalDate(c.to, true);
    if (start && stop && start > stop) [start, stop] = [parseLocalDate(c.to, false), parseLocalDate(c.from, true)];
    return { id: 'custom', label: def.label, start, end: stop ?? end };
  }
  return { id: 'all', label: def.label, start: null, end };
};

export const isInPeriod = (v: Pick<VideoItem, 'publishedAt'>, r: Pick<PeriodRange, 'start' | 'end'>) => {
  const t = new Date(v.publishedAt).getTime();
  if (Number.isNaN(t)) return r.start === null;
  return (r.start === null || t >= r.start.getTime()) && t <= r.end.getTime();
};

export const filterByPeriod = <T extends Pick<VideoItem, 'publishedAt'>>(videos: T[], r: PeriodRange): T[] =>
  r.start === null ? videos : videos.filter(v => isInPeriod(v, r));

/** Periode sebelumnya dengan panjang yang sama (untuk perbandingan); null untuk "Semua waktu". */
export const previousPeriod = (r: PeriodRange): PeriodRange | null => {
  if (!r.start) return null;
  const len = r.end.getTime() - r.start.getTime();
  // Rentang kustom/hari penuh berakhir di 23:59:59.999 — mundur tepat satu milidetik sebelum awal
  const end = new Date(r.start.getTime() - 1);
  return { id: r.id, label: 'Periode sebelumnya', start: new Date(end.getTime() - len), end };
};

/** Panjang periode dalam hari (untuk upload/minggu); "Semua waktu" memakai rentang video. */
export const periodDays = (r: PeriodRange, videos: Pick<VideoItem, 'publishedAt'>[]): number => {
  if (r.start) return Math.max((r.end.getTime() - r.start.getTime()) / DAY, 1 / 24);
  const times = videos.map(v => new Date(v.publishedAt).getTime()).filter(t => !Number.isNaN(t));
  return times.length > 1 ? (Math.max(...times) - Math.min(...times)) / DAY : 0;
};

const fmt = (d: Date, withYear: boolean) =>
  d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) });

/** "28 Sep – 5 Okt 2026" */
export const formatPeriodRange = (r: Pick<PeriodRange, 'start' | 'end'>, videos: Pick<VideoItem, 'publishedAt'>[] = []): string => {
  let start = r.start;
  if (!start) {
    const times = videos.map(v => new Date(v.publishedAt).getTime()).filter(t => !Number.isNaN(t));
    if (!times.length) return 'Semua video';
    start = new Date(Math.min(...times));
  }
  const sameYear = start.getFullYear() === r.end.getFullYear();
  if (toDateInput(start) === toDateInput(r.end)) return fmt(r.end, true);
  return `${fmt(start, !sameYear)} – ${fmt(r.end, true)}`;
};

/**
 * Apakah data yang dimuat mencakup seluruh periode. Untuk channel, hanya N upload terbaru yang dimuat;
 * bila awal periode lebih tua dari video tertua yang dimuat (dan masih ada video lain), angka periode belum lengkap.
 */
export const periodCoverage = (
  r: Pick<PeriodRange, 'start'>,
  videos: Pick<VideoItem, 'publishedAt'>[],
  channelTotal?: number
): { complete: boolean; oldest: Date | null } => {
  const times = videos.map(v => new Date(v.publishedAt).getTime()).filter(t => !Number.isNaN(t));
  const oldest = times.length ? new Date(Math.min(...times)) : null;
  if (!channelTotal || videos.length >= channelTotal || !oldest) return { complete: true, oldest };
  return { complete: r.start !== null && r.start.getTime() >= oldest.getTime(), oldest };
};
