// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { isShortDuration, withShortsClassification } from '../lib/video';
import { calculateAllVideoScores, midRankPercentile, gradeFromScore } from '../services/performanceScoreService';
import { analyzeTitleScore } from '../services/titleScoreService';
import { buildReport } from '../services/export/reportModel';
import { buildCsv, buildJson, buildScheduleCsv } from '../services/export/dataFormats';
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

  it('CSV: neutralises formula injection from untrusted titles/tags', async () => {
    const hostile = buildReport(
      [
        video('ddddddddddd', { title: '=HYPERLINK("http://evil.example","klik")', tags: ['+cmd', '-1', '@SUM(A1)'] }),
        video('eeeeeeeeeee', { title: '\tTab di depan' }),
      ],
      { title: 'Uji', source: 'channel', generatedAt: new Date(NOW) }
    );
    const csv = await buildCsv(hostile).text();
    expect(csv).not.toMatch(/(^|,)=HYPERLINK/m);
    expect(csv).toContain(`"'=HYPERLINK(""http://evil.example"",""klik"")"`);
    expect(csv).toContain(`"'+cmd | -1 | @SUM(A1)"`);
    expect(csv).toContain(`"'\tTab di depan"`);
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
    expect(wb.worksheets.map(w => w.name)).toEqual(['Ringkasan', 'Jadwal Upload', 'Video', 'Tag', 'Metodologi']);
    const ws = wb.getWorksheet('Video')!;
    expect(ws.rowCount).toBe(4);
    expect((ws.getCell('C2').value as { hyperlink: string }).hyperlink).toBe('https://www.youtube.com/watch?v=aaaaaaaaaaa');
    expect(ws.getCell('G1').value).toBe('Hari upload');
    expect(ws.getCell('G2').value).toBe(report.rows[0].uploadDay);
    expect(ws.getCell('H2').value).toBe(report.rows[0].uploadTime);
    expect(ws.getCell('L4').value).toBe('Disembunyikan');
    const sched = wb.getWorksheet('Jadwal Upload')!;
    const texts: string[] = [];
    sched.eachRow(r => r.eachCell(c => texts.push(String(c.value ?? ''))));
    expect(texts).toContain('Hari terbaik');
    expect(texts.some(t => t.includes('PERINGKAT') || t.includes('PERFORMA PER HARI'))).toBe(true);
    expect(texts).toContain('Senin');
    expect(texts).toContain('DETAIL UPLOAD PER VIDEO');
    expect(texts).toContain(report.rows[0].uploadTime);
  });

  it('PDF: valid document with a schedule page', async () => {
    const blob = await buildPdf(report, null);
    const text = new TextDecoder('latin1').decode(new Uint8Array(await blob.arrayBuffer()));
    expect(text.slice(0, 5)).toBe('%PDF-');
    expect(text).toContain('Jadwal upload');
    expect(text).toContain('Peta panas performa');
  });

  it('schedule data is in the report and every format', async () => {
    const sc = report.schedule;
    expect(sc.totalVideos).toBe(3);
    expect(sc.heatmap.days).toEqual(['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']);
    expect(sc.heatmap.uploads.flat().reduce((a, b) => a + b, 0)).toBe(3);
    expect(sc.groups.day.reduce((a, g) => a + g.uploads, 0)).toBe(3);
    expect(sc.groups.hour.length).toBeGreaterThan(0);
    expect(report.rows[0].uploadHour).toMatch(/^\d{2}\.00$/);
    expect(report.rows[0].uploadTime).toMatch(/^\d{2}\.\d{2}$/);
    const local = new Date(report.rows[0].publishedAt);
    expect(report.rows[0].uploadDate).toBe(
      `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`
    );

    const json = JSON.parse(await buildJson(report, null).text());
    expect(json.schedule.groups.daypart.length).toBeGreaterThan(0);
    expect(json.videos[0].upload.day).toBe(report.rows[0].uploadDay);
    expect(json.videos[0].upload.time).toBe(report.rows[0].uploadTime);
    expect(json.videos[0].upload.date).toBe(report.rows[0].uploadDate);

    const csv = await buildCsv(report).text();
    expect(csv.split('\r\n')[0]).toContain('Tanggal upload,Hari upload,Jam upload,Bagian hari');
    // jumlah kolom header = jumlah kolom data (tidak ada koma liar di header)
    const cols = (line: string) => line.match(/("([^"]|"")*"|[^,]*)(,|$)/g)!.filter(Boolean).length;
    expect(cols(csv.split('\r\n')[0].replace('\uFEFF', ''))).toBe(cols(csv.split('\r\n')[3]));
    expect(csv.split('\r\n')[1]).toContain(`${report.rows[0].uploadDate},${report.rows[0].uploadDay},${report.rows[0].uploadTime}`);
    const schedCsv = (await buildScheduleCsv(report).text()).split('\r\n');
    expect(schedCsv[0]).toContain('Kelompok,Waktu,Upload');
    expect(schedCsv.some(l => l.startsWith('Hari,'))).toBe(true);
    expect(schedCsv.some(l => l.startsWith('Hari × jam,'))).toBe(true);

    const html = await buildHtml(report, null).text();
    expect(html).toContain('id="jadwal"');
    expect(html.match(/class="hc/g)).toHaveLength(7 * 24);
    expect(html).toContain('data-g="daypart"');
  });

  it('PDF text sanitizer keeps Latin text and drops emoji', () => {
    expect(pdfText('Shorts 🔥 lucu — keren…')).toBe('Shorts lucu - keren...');
    expect(pdfText('日本語')).toContain('non-Latin');
  });
});
