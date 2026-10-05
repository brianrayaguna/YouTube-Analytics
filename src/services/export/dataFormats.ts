// Ekspor JSON & CSV

import { Report, REPORT_SCHEMA_VERSION, APP_NAME, sourceLabel, METHODOLOGY } from './reportModel';
import { SCORE_MODEL } from '../performanceScoreService';
import { ThumbImage } from './thumbnails';

export const buildJson = (report: Report, thumbs: Map<string, ThumbImage> | null): Blob => {
  const { context, summary, schedule, rows } = report;
  const ch = context.channelStats;
  const payload = {
    $schema: 'yt-analyzer-report',
    schemaVersion: REPORT_SCHEMA_VERSION,
    generator: { name: APP_NAME, scoreModelVersion: SCORE_MODEL.version },
    generatedAt: context.generatedAt.toISOString(),
    source: { type: context.source ?? null, label: sourceLabel(context), title: context.title, query: context.query ?? null, scope: context.scopeNote ?? null },
    channel: ch
      ? {
          id: ch.channelId ?? null,
          title: ch.title ?? null,
          handle: ch.customUrl || null,
          subscribers: ch.hiddenSubscriberCount ? null : ch.subCountRaw,
          totalViews: ch.viewCountRaw ?? null,
          totalVideos: ch.videoCountRaw ?? null,
          avatarUrl: ch.avatar || null,
          bannerUrl: ch.banner || null,
          description: ch.description || '',
        }
      : null,
    summary,
    schedule,
    scoring: {
      model: SCORE_MODEL,
      glossary: Object.fromEntries(METHODOLOGY),
    },
    videos: rows.map(r => ({
      no: r.no,
      id: r.id,
      url: r.url,
      title: r.title,
      type: r.type,
      channel: { id: r.channelId, title: r.channelTitle },
      publishedAt: r.publishedAt,
      upload: {
        date: r.uploadDate,
        day: r.uploadDay,
        time: r.uploadTime,
        hourSlot: r.uploadHour,
        daypart: r.uploadDaypart,
        timeZone: schedule.timeZone,
        utcOffset: schedule.utcOffset,
      },
      ageDays: r.ageDays,
      duration: { seconds: r.durationSec, formatted: r.duration },
      statistics: { views: r.views, likes: r.likes, comments: r.comments, engagementRate: r.engagementRate, viewsPerDay: r.viewsPerDay },
      performance: { reachRatio: r.reachRatio, isOutlier: r.isOutlier, cohort: r.scoreCohort, confidence: r.scoreConfidence },
      scores: {
        title: { score: r.titleScore, grade: r.titleGrade, components: r.scored.titleScore.components },
        thumbnail: { score: r.thumbnailScore, grade: r.thumbnailGrade, components: r.scored.thumbnailScore.components },
      },
      tags: r.tags,
      description: r.description,
      thumbnails: {
        ...r.thumbnails,
        hdAvailable: r.thumbnailHd,
        ...(thumbs?.get(r.id) ? { embedded: thumbs.get(r.id)!.dataUrl } : {}),
      },
    })),
  };
  return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
};

const csvCell = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const str = String(value);
  return /[",\n\r;]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

export const buildCsv = (report: Report): Blob => {
  const headers = [
    'No', 'Video ID', 'Judul', 'Jenis', 'Tanggal upload', 'Hari upload', 'Jam upload', 'Bagian hari', 'Waktu upload UTC (ISO 8601)', 'Umur (hari)', 'Durasi', 'Durasi (detik)',
    'Views', 'Likes', 'Komentar', 'Engagement rate (%)', 'Views per hari', 'Rasio jangkauan', 'Outlier',
    'Skor judul', 'Nilai judul', 'Skor thumbnail', 'Nilai thumbnail', 'Keyakinan skor', 'Kelompok pembanding',
    'Tag', 'Channel', 'Channel ID', 'URL', 'Thumbnail URL (HQ)',
  ];
  const lines = report.rows.map(r =>
    [
      r.no, r.id, r.title, r.type, r.uploadDate, r.uploadDay, r.uploadTime, r.uploadDaypart, r.publishedAt, r.ageDays, r.duration, r.durationSec,
      r.views, r.likes, r.comments, r.engagementRate, r.viewsPerDay, r.reachRatio, r.isOutlier ? 'Ya' : 'Tidak',
      r.titleScore, r.titleGrade, r.thumbnailScore, r.thumbnailGrade, r.scoreConfidence, r.scoreCohort,
      r.tags.join(' | '), r.channelTitle, r.channelId, r.url, r.thumbnails.high,
    ]
      .map(csvCell)
      .join(',')
  );
  // BOM agar Excel membaca UTF-8 (judul berbahasa Indonesia/emoji) dengan benar
  return new Blob(['﻿' + [headers.map(csvCell).join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' });
};

const GROUP_TITLES: Array<[keyof Report['schedule']['groups'], string]> = [
  ['day', 'Hari'],
  ['daypart', 'Bagian hari'],
  ['block', 'Blok 3 jam'],
  ['hour', 'Jam'],
];

/** CSV ringkasan jadwal upload: satu tabel panjang dengan kolom "Kelompok" (mudah di-pivot). */
export const buildScheduleCsv = (report: Report): Blob => {
  const sc = report.schedule;
  const headers = ['Kelompok', 'Waktu', 'Upload', 'Performa (x video seusia)', 'Median views', 'Rata-rata views', 'Keyakinan', 'Peringkat', 'Zona waktu'];
  const lines: string[] = [];
  GROUP_TITLES.forEach(([key, title]) =>
    sc.groups[key].forEach(g =>
      lines.push([title, g.label, g.uploads, g.performance, g.medianViews, g.avgViews, g.confidence, g.rank ?? '', `${sc.timeZone} (${sc.utcOffset})`].map(csvCell).join(','))
    )
  );
  sc.heatmap.days.forEach((day, di) =>
    sc.heatmap.uploads[di].forEach((count, hour) => {
      if (!count) return;
      const perf = sc.heatmap.performance[di][hour];
      lines.push(['Hari × jam', `${day} ${String(hour).padStart(2, '0')}.00`, count, perf, '', '', '', '', `${sc.timeZone} (${sc.utcOffset})`].map(csvCell).join(','));
    })
  );
  return new Blob(['﻿' + [headers.map(csvCell).join(','), ...lines].join('\r\n')], { type: 'text/csv;charset=utf-8' });
};
