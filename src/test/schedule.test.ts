import { describe, it, expect } from 'vitest';
import { analyzeSchedule, summarize, formatSlotTime, formatPerformance, confidenceOf } from '../lib/schedule';
import { VideoItem } from '../types';

const NOW = new Date(2026, 9, 5, 12, 0, 0);
const DAY = 86400000;

/** Tanggal lokal pada `weekday` (0 = Minggu) sekitar `daysAgo` hari lalu, pukul `hour`. */
const onWeekday = (weekday: number, daysAgo: number, hour: number) => {
  const d = new Date(NOW.getTime() - daysAgo * DAY);
  d.setDate(d.getDate() - ((d.getDay() - weekday + 7) % 7));
  d.setHours(hour, 15, 0, 0);
  return d;
};

let seq = 0;
const video = (date: Date, views: number, o: Partial<VideoItem> = {}): VideoItem => ({
  id: `v${seq++}`,
  title: 'Judul',
  description: '',
  thumbnail: '',
  views: '',
  viewCountRaw: views,
  likes: '',
  likeCountRaw: Math.round(views * 0.04),
  comments: '',
  commentCountRaw: Math.round(views * 0.004),
  engagementRate: 4.4,
  tags: [],
  publishedAt: date.toISOString(),
  publishedAtDate: date,
  publishedTimeAgo: '',
  durationSec: 600,
  durationFormatted: '10:00',
  channelTitle: 'Kanal',
  channelId: 'UCx',
  isShort: false,
  ...o,
});

describe('schedule analysis', () => {
  // Senin pagi: video lama dengan views mentah tinggi (sudah lama mengumpulkan views)
  const oldMonday = [300, 307, 314, 321, 328, 335].map(d => video(onWeekday(1, d, 9), 200_000));
  // Kamis malam: video baru, views mentah lebih rendah tapi jauh lebih cepat untuk umurnya
  const newThursday = [5, 12, 19].flatMap(d => [video(onWeekday(4, d, 19), 150_000), video(onWeekday(4, d, 20), 150_000)]);
  // Pengisi di hari lain
  const filler = [60, 90, 120, 150, 180, 210, 240, 270].map((d, i) => video(onWeekday([2, 3, 5, 6, 0, 2, 3, 5][i], d, 14), 20_000));
  // Satu video viral di slot sepi: tidak boleh langsung jadi "terbaik"
  const lonelyViral = video(onWeekday(6, 30, 3), 5_000_000);
  const all = [...oldMonday, ...newThursday, ...filler, lonelyViral];

  it('adjusts for video age instead of ranking by raw views', () => {
    const a = analyzeSchedule(all, NOW.getTime());
    expect(a.total).toBe(all.length);
    // Rata-rata views mentah memilih Senin, tetapi performa (disesuaikan umur) memilih Kamis 18.00–21.00
    expect(a.byDay[1].avgViews).toBeGreaterThan(a.byDay[4].avgViews);
    expect(a.best[0].day).toBe(4);
    expect(a.best[0].hour).toBe(18);
    expect(a.best[0].count).toBe(6);
    expect(a.bestDay?.day).toBe(4);
  });

  it('requires at least two uploads before a slot can be ranked', () => {
    const a = analyzeSchedule(all, NOW.getTime());
    expect([...a.best, ...a.worst].every(s => s.count >= 2)).toBe(true);
    expect(a.best.some(s => s.day === 6 && s.hour === 3)).toBe(false);
    expect(a.cells[6][3].count).toBe(1);
  });

  it('never lists the same slot as best and worst', () => {
    const few = [...newThursday, ...filler.slice(0, 2)];
    const a = analyzeSchedule(few, NOW.getTime());
    const keys = (l: typeof a.best) => l.map(s => `${s.day}-${s.hour}`);
    expect(keys(a.best).filter(k => keys(a.worst).includes(k))).toEqual([]);
    expect(a.best.every(s => s.performance >= 1)).toBe(true);
    expect(a.worst.every(s => s.performance < 1)).toBe(true);
    // Terendah diurutkan dari yang paling rendah
    expect(a.worst.map(s => s.performance)).toEqual([...a.worst.map(s => s.performance)].sort((x, y) => x - y));
  });

  it('shrinks small samples toward 1×', () => {
    const one = summarize([{ day: 0, hour: 0, logPerf: 1, views: 10 }]);
    expect(one.rawPerformance).toBeCloseTo(10);
    expect(one.performance).toBeCloseTo(10 ** (1 / 3));
    expect(summarize([]).performance).toBe(1);
    expect(confidenceOf(1)).toBe('rendah');
    expect(confidenceOf(3)).toBe('sedang');
    expect(confidenceOf(5)).toBe('tinggi');
  });

  it('formats slots and performance', () => {
    expect(formatSlotTime({ hour: 18, span: 3 })).toBe('18.00–21.00');
    expect(formatSlotTime({ hour: 21, span: 3 })).toBe('21.00–00.00');
    expect(formatSlotTime({ hour: 7, span: 1 })).toBe('07.00');
    expect(formatPerformance(1.84)).toBe('1,8×');
    expect(formatPerformance(12.4)).toBe('12×');
  });
});
