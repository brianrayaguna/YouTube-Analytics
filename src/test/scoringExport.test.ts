// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { isShortDuration, withShortsClassification } from '../lib/video';
import { calculateAllVideoScores, midRankPercentile, gradeFromScore } from '../services/performanceScoreService';
import { analyzeTitleScore } from '../services/titleScoreService';
import { buildReport } from '../services/export/reportModel';
import { buildCsv, buildJson } from '../services/export/dataFormats';
import { buildHtml } from '../services/export/html';
import { buildExcel } from '../services/export/excel';
import { buildPdf, pdfText } from '../services/export/pdf';
import { VideoItem } from '../types';

const DAY = 86400000;
const NOW = Date.UTC(2026, 9, 5);

const video = (id: string, o: Partial<VideoItem> = {}): VideoItem => ({
  id,
  title: 'Cara Membuat Website Lengkap untuk Pemula 2026',
  description: '',
  thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  views: '',
  viewCountRaw: 10000,
  likes: '',
  likeCountRaw: 400,
  comments: '',
  commentCountRaw: 40,
  engagementRate: 4.4,
  tags: ['tutorial', 'website'],
  publishedAt: new Date(NOW - 30 * DAY).toISOString(),
  publishedAtDate: new Date(NOW - 30 * DAY),
  publishedTimeAgo: '',
  durationSec: 600,
  durationFormatted: '10:00',
  channelTitle: 'Kanal',
  channelId: 'UCx',
  isShort: false,
  thumbnailHd: true,
  ...o,
});

describe('Shorts classification (0–3 minutes)', () => {
  it('uses the 3-minute boundary', () => {
    expect(isShortDuration(0)).toBe(false); // live/premiere
    expect(isShortDuration(1)).toBe(true);
    expect(isShortDuration(61)).toBe(true);
    expect(isShortDuration(180)).toBe(true);
    expect(isShortDuration(181)).toBe(false);
  });
  it('reclassifies data saved with the old rule', () => {
    expect(withShortsClassification({ durationSec: 150, isShort: false }).isShort).toBe(true);
    expect(withShortsClassification({ durationSec: 300, isShort: true }).isShort).toBe(false);
  });
});

describe('score engine v2', () => {
  it('uses mid-rank percentiles for ties', () => {
    expect(midRankPercentile(5, [5, 5, 5, 5])).toBe(50);
    expect(midRankPercentile(10, [1, 2, 3, 10])).toBe(88);
  });

  it('maps grades', () => {
    expect([90, 70, 55, 40, 10].map(gradeFromScore)).toEqual(['A', 'B', 'C', 'D', 'F']);
  });

  it('adjusts reach for video age (fast new video is not punished)', () => {
    const list = [
      video('new', { viewCountRaw: 3 * 5000, publishedAt: new Date(NOW - 3 * DAY).toISOString() }),
      ...Array.from({ length: 9 }, (_, i) =>
        video(`old${i}`, { viewCountRaw: 20000 + i * 500, publishedAt: new Date(NOW - (200 + i * 40) * DAY).toISOString() })
      ),
    ];
    const scored = calculateAllVideoScores(list, NOW);
    const fresh = scored.find(v => v.id === 'new')!;
    expect(fresh.metrics.reachRatio).toBeGreaterThan(1);
    expect(fresh.metrics.reachPercentile).toBeGreaterThanOrEqual(80);
  });

  it('compares Shorts with Shorts and Videos with Videos', () => {
    const list = [
      ...Array.from({ length: 6 }, (_, i) => video(`s${i}`, { isShort: true, durationSec: 40, viewCountRaw: 500000 + i * 1000 })),
      ...Array.from({ length: 6 }, (_, i) => video(`v${i}`, { viewCountRaw: 5000 + i * 100 })),
    ];
    const scored = calculateAllVideoScores(list, NOW);
    const bestLong = scored.find(v => v.id === 'v5')!;
    expect(bestLong.metrics.cohort).toBe('Video');
    expect(bestLong.metrics.reachPercentile).toBeGreaterThan(80); // tidak kalah karena views Shorts
  });

  it('skips engagement when likes are hidden instead of scoring it as zero', () => {
    const list = Array.from({ length: 8 }, (_, i) => video(`v${i}`, { viewCountRaw: 10000 + i * 1000 }));
    list.push(video('hidden', { likesHidden: true, likeCountRaw: 0, engagementRate: 0.1 }));
    const hidden = calculateAllVideoScores(list, NOW).find(v => v.id === 'hidden')!;
    expect(hidden.titleScore.components.map(c => c.key)).toEqual(['reach', 'text']);
    expect(hidden.titleScore.components.reduce((s, c) => s + c.weight, 0)).toBeGreaterThanOrEqual(99);
  });

  it('flags low-confidence scores for very new videos', () => {
    const list = Array.from({ length: 8 }, (_, i) => video(`v${i}`));
    list.push(video('today', { publishedAt: new Date(NOW - 0.5 * DAY).toISOString() }));
    expect(calculateAllVideoScores(list, NOW).find(v => v.id === 'today')!.titleScore.confidence).toBe('rendah');
  });
});

describe('title text analysis v2', () => {
  it('ranks spammy titles below clean ones', () => {
    const spam = analyzeTitleScore('Cara Masak Rendang 🔥🔥🔥🔥 #shorts #viral #fyp #masak');
    const clean = analyzeTitleScore('5 Cara Masak Rendang Empuk untuk Pemula [Resep 2026]');
    expect(clean.totalScore).toBeGreaterThan(spam.totalScore + 20);
  });
  it('does not count digits as capital letters', () => {
    const r = analyzeTitleScore('Review iPhone 17 Pro 2026 vs 2025');
    expect(r.checks.find(c => c.key === 'caps')!.score).toBe(20);
  });
  it('penalizes ALL CAPS titles', () => {
    const r = analyzeTitleScore('TUTORIAL LENGKAP EXCEL UNTUK PEMULA SAMPAI MAHIR');
    expect(r.checks.find(c => c.key === 'caps')!.score).toBe(0);
    expect(r.grade).not.toBe('A');
  });
  it('measures length without hashtags', () => {
    expect(analyzeTitleScore('Tips singkat #shorts #viral').stats.length).toBe('Tips singkat'.length);
  });
});

describe('exports', () => {
  const videos = [
    video('aaaaaaaaaaa', { title: 'Video "pertama", dengan koma' }),
    video('bbbbbbbbbbb', { isShort: true, durationSec: 45, durationFormatted: '0:45', title: 'Shorts 🔥 lucu' }),
    video('ccccccccccc', { likesHidden: true }),
  ];
  const report = buildReport(videos, {
    title: 'Kanal Uji',
    source: 'channel',
    generatedAt: new Date(NOW),
    channelStats: { title: 'Kanal Uji', subscriberCount: '1K', subCountRaw: 1000, viewCount: '1M', viewCountRaw: 1e6, videoCount: '3', videoCountRaw: 3, customUrl: '@uji', description: '', avatar: '' },
  });

  it('builds a consistent report model', () => {
    expect(report.summary.totalVideos).toBe(3);
    expect(report.summary.shorts).toBe(1);
    expect(report.rows[1].url).toBe('https://www.youtube.com/shorts/bbbbbbbbbbb');
    expect(report.rows[2].likes).toBeNull();
    expect(report.rows[2].engagementRate).toBeNull();
  });

  it('CSV: BOM, header and escaped cells', async () => {
    const bytes = new Uint8Array(await buildCsv(report).arrayBuffer());
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    const lines = new TextDecoder().decode(bytes).split('\r\n');
    expect(lines).toHaveLength(4);
    expect(lines[1]).toContain('"Video ""pertama"", dengan koma"');
  });

  it('JSON: schema, summary and per-video scores', async () => {
    const json = JSON.parse(await buildJson(report, null).text());
    expect(json.$schema).toBe('yt-analyzer-report');
    expect(json.videos).toHaveLength(3);
    expect(json.videos[0].scores.title.components.length).toBeGreaterThan(0);
    expect(json.videos[0].thumbnails.maxres).toContain('maxresdefault.jpg');
    expect(json.channel.handle).toBe('@uji');
  });

  it('HTML: escapes content and lists all videos', async () => {
    const html = await buildHtml(report, null).text();
    expect(html).toContain('Video &quot;pertama&quot;, dengan koma');
    expect(html.match(/class="thumb"/g)).toHaveLength(3);
  });

  it('Excel: sheets, rows and hyperlinks', async () => {
    const blob = await buildExcel(report, null);
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await blob.arrayBuffer());
    expect(wb.worksheets.map(w => w.name)).toEqual(['Ringkasan', 'Video', 'Tag', 'Metodologi']);
    const ws = wb.getWorksheet('Video')!;
    expect(ws.rowCount).toBe(4);
    expect((ws.getCell('C2').value as { hyperlink: string }).hyperlink).toBe('https://www.youtube.com/watch?v=aaaaaaaaaaa');
    expect(ws.getCell('I4').value).toBe('Disembunyikan');
  });

  it('PDF: valid document', async () => {
    const blob = await buildPdf(report, null);
    const head = new TextDecoder().decode(new Uint8Array(await blob.arrayBuffer()).slice(0, 5));
    expect(head).toBe('%PDF-');
  });

  it('PDF text sanitizer keeps Latin text and drops emoji', () => {
    expect(pdfText('Shorts 🔥 lucu — keren…')).toBe('Shorts lucu - keren...');
    expect(pdfText('日本語')).toContain('non-Latin');
  });
});
