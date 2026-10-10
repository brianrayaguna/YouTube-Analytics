import { describe, it, expect } from 'vitest';
import { parseYouTubeQuery, classifyQuery, markOutliers } from '../services/youtubeService';
import { applyFilters, DEFAULT_FILTERS, countActiveFilters } from '../lib/filters';
import { formatNumber, formatDuration, timeAgo, safeFileName } from '../lib/format';
import { extractYouTubeVideoId, DOWNLOADER_SERVICES } from '../constants/downloaders';
import { calculateAllVideoScores } from '../services/performanceScoreService';
import { analyzeContentGap } from '../services/contentGapService';
import { VideoItem } from '../types';

const video = (over: Partial<VideoItem> & { id: string }): VideoItem => ({
  title: 'Judul',
  description: '',
  thumbnail: '',
  views: '0',
  viewCountRaw: 1000,
  likes: '0',
  likeCountRaw: 10,
  comments: '0',
  commentCountRaw: 1,
  engagementRate: 1.1,
  tags: [],
  publishedAt: new Date().toISOString(),
  publishedAtDate: new Date(),
  publishedTimeAgo: '',
  durationSec: 600,
  durationFormatted: '10:00',
  channelTitle: 'Ch',
  channelId: 'UC',
  isShort: false,
  ...over,
});

describe('parseYouTubeQuery', () => {
  it.each([
    ['@MrBeast', { kind: 'handle', handle: 'MrBeast' }],
    ['https://www.youtube.com/@windahbasudara/videos', { kind: 'handle', handle: 'windahbasudara' }],
    ['UCX6OQ3DkcsbYNE6H8uQQuVA', { kind: 'channelId', id: 'UCX6OQ3DkcsbYNE6H8uQQuVA' }],
    ['https://youtube.com/channel/UCX6OQ3DkcsbYNE6H8uQQuVA', { kind: 'channelId', id: 'UCX6OQ3DkcsbYNE6H8uQQuVA' }],
    ['https://www.youtube.com/user/pewdiepie', { kind: 'username', name: 'pewdiepie' }],
    ['https://www.youtube.com/c/Kurzgesagt', { kind: 'customUrl', name: 'Kurzgesagt' }],
    ['https://youtu.be/dQw4w9WgXcQ?t=10', { kind: 'video', id: 'dQw4w9WgXcQ' }],
    ['https://www.youtube.com/shorts/abcdefghijk', { kind: 'video', id: 'abcdefghijk' }],
    ['https://m.youtube.com/watch?v=dQw4w9WgXcQ', { kind: 'video', id: 'dQw4w9WgXcQ' }],
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLabc123', { kind: 'playlist', id: 'PLabc123' }],
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=RDdQw4w9WgXcQ', { kind: 'video', id: 'dQw4w9WgXcQ' }],
    ['youtube.com/playlist?list=PLxyz', { kind: 'playlist', id: 'PLxyz' }],
    ['tutorial excel pemula', { kind: 'search', q: 'tutorial excel pemula' }],
  ])('%s', (input, expected) => {
    expect(parseYouTubeQuery(input)).toEqual(expected);
  });

  it('classifies queries for history', () => {
    expect(classifyQuery('@abc')).toBe('channel');
    expect(classifyQuery('youtube.com/playlist?list=PL1')).toBe('playlist');
    expect(classifyQuery('resep')).toBe('keyword');
  });
});

describe('format helpers', () => {
  it('formats compact numbers including billions', () => {
    expect(formatNumber(999)).toBe('999');
    expect(formatNumber(1500)).toBe('1.5K');
    expect(formatNumber(12_300_000)).toBe('12M');
    expect(formatNumber(2_400_000_000)).toBe('2.4B');
  });
  it('formats durations', () => {
    expect(formatDuration(59)).toBe('0:59');
    expect(formatDuration(3725)).toBe('1:02:05');
  });
  it('renders relative time in Indonesian', () => {
    expect(timeAgo(Date.now() - 3 * 86400000)).toBe('3 hari yang lalu');
    expect(timeAgo(Date.now() - 14 * 86400000)).toBe('2 minggu yang lalu');
  });
  it('produces Windows-safe file names', () => {
    expect(safeFileName('a/b:c*d?e"f<g>h|i')).toBe('a_b_c_d_e_f_g_h_i');
    expect(safeFileName('judul...')).toBe('judul');
    expect(safeFileName('CON')).toBe('_CON');
    expect(safeFileName('nul.mp4')).toBe('_nul.mp4');
    expect(safeFileName('   ')).toBe('file');
    expect(safeFileName('x\u0000y\u001fz')).toBe('x_y_z');
    expect(safeFileName('Normal 123')).toBe('Normal 123');
  });
});

describe('applyFilters', () => {
  const now = Date.now();
  const list = [
    video({ id: 'a', viewCountRaw: 500, isShort: true, durationSec: 30, publishedAt: new Date(now - 2 * 86400000).toISOString() }),
    video({ id: 'b', viewCountRaw: 5000, engagementRate: 6, publishedAt: new Date(now - 40 * 86400000).toISOString(), tags: ['Tutorial'] }),
    video({ id: 'c', viewCountRaw: 2000, durationSec: 1500, likeCountRaw: 900, isOutlier: true }),
  ];

  it('sorts by popularity by default', () => {
    expect(applyFilters(list, DEFAULT_FILTERS, now).map(v => v.id)).toEqual(['b', 'c', 'a']);
  });
  it('filters content type, duration, date, ER, keyword and outliers', () => {
    expect(applyFilters(list, { ...DEFAULT_FILTERS, contentType: 'shorts' }, now).map(v => v.id)).toEqual(['a']);
    expect(applyFilters(list, { ...DEFAULT_FILTERS, duration: 'over_20' }, now).map(v => v.id)).toEqual(['c']);
    expect(applyFilters(list, { ...DEFAULT_FILTERS, dateRange: '30d' }, now).map(v => v.id)).toEqual(['c', 'a']);
    expect(applyFilters(list, { ...DEFAULT_FILTERS, minER: 5 }, now).map(v => v.id)).toEqual(['b']);
    expect(applyFilters(list, { ...DEFAULT_FILTERS, keyword: 'tutorial' }, now).map(v => v.id)).toEqual(['b']);
    expect(applyFilters(list, { ...DEFAULT_FILTERS, outliersOnly: true }, now).map(v => v.id)).toEqual(['c']);
  });
  it('counts active filters', () => {
    expect(countActiveFilters(DEFAULT_FILTERS)).toBe(0);
    expect(countActiveFilters({ ...DEFAULT_FILTERS, minViews: 1000, keyword: 'x' })).toBe(2);
  });
});

describe('markOutliers', () => {
  it('flags videos with ≥3× median views', () => {
    const vids = [100, 110, 120, 130, 1000].map((v, i) => video({ id: String(i), viewCountRaw: v }));
    expect(markOutliers(vids).map(v => v.isOutlier)).toEqual([false, false, false, false, true]);
  });
  it('does not flag small samples', () => {
    expect(markOutliers([video({ id: 'x', viewCountRaw: 1e9 })])[0].isOutlier).toBe(false);
  });
});

describe('downloaders', () => {
  it('extracts video ids from common URLs', () => {
    expect(extractYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(extractYouTubeVideoId('https://youtube.com/shorts/abcdefghijk?feature=share')).toBe('abcdefghijk');
  });
  it('builds a cobalt link with the "u" parameter', () => {
    const cobalt = DOWNLOADER_SERVICES.find(s => s.id === 'cobalt')!;
    expect(cobalt.getUrl('https://youtu.be/dQw4w9WgXcQ')).toBe('https://cobalt.tools/?u=https%3A%2F%2Fyoutu.be%2FdQw4w9WgXcQ');
  });
});

describe('scoring & content gap', () => {
  it('scores large lists quickly and within 0–100', () => {
    const many = Array.from({ length: 5000 }, (_, i) => video({ id: String(i), viewCountRaw: i * 13, likeCountRaw: i, engagementRate: (i % 50) / 5 }));
    const start = performance.now();
    const scored = calculateAllVideoScores(many);
    expect(performance.now() - start).toBeLessThan(2000);
    scored.forEach(v => {
      expect(v.titleScore.totalScore).toBeGreaterThanOrEqual(0);
      expect(v.titleScore.totalScore).toBeLessThanOrEqual(100);
    });
  });
  it('handles empty trending data without NaN', () => {
    const res = analyzeContentGap([video({ id: 'a', title: 'Resep nasi goreng spesial' })], []);
    expect(res.overlapPercentage).toBe(0);
  });
  it('finds trending topics missing from the channel (unicode-safe)', () => {
    const trending = ['Ramalan cuaca ekstrem minggu ini', 'Cuaca ekstrem landa Jakarta', 'Ramalan cuaca ekstrem besok'].map((t, i) =>
      video({ id: `t${i}`, title: t, viewCountRaw: 100000 })
    );
    const res = analyzeContentGap([video({ id: 'c', title: 'Tutorial memasak rendang' })], trending);
    expect(res.missingTopics.map(t => t.topic)).toContain('cuaca ekstrem');
  });
});
