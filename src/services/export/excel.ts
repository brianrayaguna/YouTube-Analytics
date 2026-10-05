// Ekspor Excel (.xlsx) profesional — ExcelJS dimuat hanya saat dibutuhkan.

import type { Workbook, Worksheet, Cell, Fill, Borders } from 'exceljs';
import { Report, ReportRow, ScheduleRow, ScheduleSlotRow, METHODOLOGY, GRADE_COLORS, APP_NAME, sourceLabel, formatDateId, performanceRgb } from './reportModel';
import { ThumbImage } from './thumbnails';
import { formatNumber } from '../../lib/format';

const INK = 'FF0F0F0F';
const RED = 'FFFF0000';
const MUTED = 'FF606060';
const BORDER = 'FFE5E5E5';
const ZEBRA = 'FFF8F8F8';

const performanceArgb = (p: number | null): string =>
  `FF${performanceRgb(p).map(c => c.toString(16).padStart(2, '0')).join('').toUpperCase()}`;

const solid = (argb: string): Fill => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const thinBorder: Partial<Borders> = {
  top: { style: 'thin', color: { argb: BORDER } },
  bottom: { style: 'thin', color: { argb: BORDER } },
  left: { style: 'thin', color: { argb: BORDER } },
  right: { style: 'thin', color: { argb: BORDER } },
};

const styleHeaderRow = (ws: Worksheet, rowNumber: number) => {
  const row = ws.getRow(rowNumber);
  row.height = 26;
  row.eachCell(cell => {
    cell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = solid(INK);
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = thinBorder;
  });
};

const gradeCell = (cell: Cell, grade: string) => {
  const color = GRADE_COLORS[grade as keyof typeof GRADE_COLORS] ?? '606060';
  cell.fill = solid(`FF${color}`);
  cell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' } };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
};

const addTitleBlock = (ws: Worksheet, report: Report, lastCol: string) => {
  ws.mergeCells(`A1:${lastCol}1`);
  const t = ws.getCell('A1');
  t.value = `${APP_NAME} — ${report.context.title}`;
  t.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  t.fill = solid(RED);
  t.alignment = { vertical: 'middle', indent: 1 };
  ws.getRow(1).height = 34;
  ws.mergeCells(`A2:${lastCol}2`);
  const s = ws.getCell('A2');
  s.value = `${sourceLabel(report.context)} • ${report.summary.totalVideos.toLocaleString('id-ID')} video • dibuat ${formatDateId(report.context.generatedAt, true)}${
    report.context.scopeNote ? ` • ${report.context.scopeNote}` : ''
  }`;
  s.font = { name: 'Arial', size: 10, color: { argb: MUTED } };
  s.alignment = { indent: 1 };
  ws.getRow(2).height = 20;
};

const buildSummarySheet = (wb: Workbook, report: Report, avatar?: ThumbImage) => {
  const ws = wb.addWorksheet('Ringkasan', { views: [{ showGridLines: false }], properties: { tabColor: { argb: RED } } });
  // A: nomor/margin • B: label/judul • C–E: nilai
  ws.columns = [{ width: 5 }, { width: 58 }, { width: 18 }, { width: 16 }, { width: 16 }];
  ws.pageSetup = { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } };
  addTitleBlock(ws, report, 'E');
  const { summary: s, context } = report;
  let r = 4;

  const section = (title: string, headers: string[] = []) => {
    ws.mergeCells(r, 1, r, 2);
    const c = ws.getCell(r, 1);
    c.value = title.toUpperCase();
    c.font = { name: 'Arial', bold: true, size: 10, color: { argb: INK } };
    headers.forEach((h, i) => {
      const hc = ws.getCell(r, 3 + i);
      hc.value = h;
      hc.font = { name: 'Arial', bold: true, size: 9, color: { argb: MUTED } };
      hc.alignment = { horizontal: 'right' };
    });
    for (let col = 1; col <= 5; col++) ws.getCell(r, col).border = { bottom: { style: 'medium', color: { argb: INK } } };
    ws.getRow(r).height = 20;
    r++;
  };
  const kv = (label: string, values: Array<string | number>, numFmt?: string) => {
    ws.mergeCells(r, 1, r, 2);
    const l = ws.getCell(r, 1);
    l.value = label;
    l.font = { name: 'Arial', size: 10, color: { argb: MUTED } };
    l.alignment = { indent: 1, vertical: 'middle' };
    values.forEach((val, i) => {
      const v = ws.getCell(r, 3 + i);
      v.value = val;
      v.font = { name: 'Arial', size: 11, bold: true, color: { argb: INK } };
      v.alignment = { horizontal: 'right', vertical: 'middle' };
      if (numFmt && typeof val === 'number') v.numFmt = numFmt;
    });
    for (let col = 1; col <= 5; col++) ws.getCell(r, col).border = { bottom: { style: 'hair', color: { argb: BORDER } } };
    ws.getRow(r).height = 18;
    r++;
  };

  if (context.channelStats) {
    const ch = context.channelStats;
    section('Channel');
    const startRow = r;
    kv('Nama', [ch.title || context.title]);
    kv('Handle', [ch.customUrl || '-']);
    kv('Subscriber', [ch.hiddenSubscriberCount ? 'Disembunyikan' : ch.subCountRaw], '#,##0');
    kv('Total views channel', [ch.viewCountRaw ?? 0], '#,##0');
    kv('Total video channel', [ch.videoCountRaw ?? 0], '#,##0');
    if (avatar) {
      const id = wb.addImage({ base64: avatar.dataUrl, extension: 'jpeg' });
      ws.addImage(id, { tl: { col: 4.15, row: startRow - 0.9 }, ext: { width: 84, height: 84 }, editAs: 'oneCell' });
    }
    r++;
  }

  section('Kinerja konten');
  kv('Video dianalisis', [s.totalVideos], '#,##0');
  kv('Video panjang / Shorts (≤ 3 menit)', [s.long, s.shorts], '#,##0');
  kv('Total views', [s.totalViews], '#,##0');
  kv('Rata-rata / median views', [s.avgViews, s.medianViews], '#,##0');
  kv('Total likes / komentar', [s.totalLikes, s.totalComments], '#,##0');
  kv('Rata-rata engagement rate', [s.avgEngagementRate / 100], '0.00%');
  kv('Outlier (views ≥ 3× median)', [s.outliers], '#,##0');
  kv('Upload per minggu', [s.uploadsPerWeek], '0.0');
  kv('Rentang upload', [`${formatDateId(s.firstPublished)} – ${formatDateId(s.lastPublished)}`]);
  ws.mergeCells(r - 1, 3, r - 1, 5);
  r++;

  section('Format', ['Video', 'Rata-rata views', 'ER']);
  s.formats.forEach(f => kv(f.type === 'Shorts' ? 'Shorts (≤ 3 menit)' : 'Video panjang', [f.count, f.avgViews, f.avgEngagementRate / 100]));
  ws.getCell(r - 1, 4).numFmt = '#,##0';
  ws.getCell(r - 2, 4).numFmt = '#,##0';
  ws.getCell(r - 1, 5).numFmt = '0.00%';
  ws.getCell(r - 2, 5).numFmt = '0.00%';
  r++;

  section('Skor & distribusi nilai', ['Judul', 'Thumbnail']);
  kv('Skor rata-rata (0–100)', [s.avgTitleScore, s.avgThumbnailScore], '0');
  (['A', 'B', 'C', 'D', 'F'] as const).forEach(g => {
    kv(`Nilai ${g}`, [s.titleGrades[g], s.thumbnailGrades[g]], '#,##0');
    const label = ws.getCell(r - 1, 1);
    label.fill = solid(`FF${GRADE_COLORS[g]}`);
    label.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  });
  r++;

  section('10 video teratas (views)', ['Views', 'Nilai judul', 'Nilai thumb']);
  const top = [...report.rows].sort((a, b) => b.views - a.views).slice(0, 10);
  top.forEach((row, i) => {
    const n = ws.getCell(r, 1);
    n.value = i + 1;
    n.alignment = { horizontal: 'center', vertical: 'middle' };
    n.font = { name: 'Arial', size: 10, color: { argb: MUTED } };
    const titleCell = ws.getCell(r, 2);
    titleCell.value = { text: row.title, hyperlink: row.url };
    titleCell.font = { name: 'Arial', size: 10, color: { argb: 'FF065FD4' }, underline: true };
    titleCell.alignment = { vertical: 'middle', wrapText: true };
    const views = ws.getCell(r, 3);
    views.value = row.views;
    views.numFmt = '#,##0';
    views.font = { name: 'Arial', size: 10, bold: true };
    views.alignment = { horizontal: 'right', vertical: 'middle' };
    gradeCell(ws.getCell(r, 4), row.titleGrade);
    ws.getCell(r, 4).value = `${row.titleGrade} (${row.titleScore})`;
    gradeCell(ws.getCell(r, 5), row.thumbnailGrade);
    ws.getCell(r, 5).value = `${row.thumbnailGrade} (${row.thumbnailScore})`;
    for (let col = 1; col <= 3; col++) {
      ws.getCell(r, col).border = { bottom: { style: 'hair', color: { argb: BORDER } } };
      if (i % 2) ws.getCell(r, col).fill = solid(ZEBRA);
    }
    ws.getRow(r).height = 30;
    r++;
  });

  const sc = report.schedule;
  r++;
  section('Jadwal upload', ['Waktu', 'Performa', 'Upload']);
  kv('Hari terbaik', [sc.bestDay?.day ?? '-', sc.bestDay ? `${sc.bestDay.performance}×` : '-', sc.bestDay?.uploads ?? '-']);
  kv('Jam terbaik', [sc.bestHour?.hour ?? '-', sc.bestHour ? `${sc.bestHour.performance}×` : '-', sc.bestHour?.uploads ?? '-']);
  kv('Slot 3 jam terbaik', sc.bestSlots[0] ? [`${sc.bestSlots[0].day} ${sc.bestSlots[0].time}`, `${sc.bestSlots[0].performance}×`, sc.bestSlots[0].uploads] : ['-']);
  kv('Paling sering upload', [sc.busiestDay ? `${sc.busiestDay.day} (${sc.busiestDay.uploads})` : '-']);
  kv('Zona waktu', [`${sc.timeZone} (${sc.utcOffset})`]);
  ws.mergeCells(r - 1, 3, r - 1, 5);
  const note = ws.getCell(r, 1);
  ws.mergeCells(r, 1, r, 5);
  note.value = 'Detail lengkap ada di sheet "Jadwal Upload".';
  note.font = { name: 'Arial', size: 9, italic: true, color: { argb: MUTED } };
  note.alignment = { indent: 1 };
  r++;

  if (s.topTags.length) {
    r++;
    section('Tag teratas', ['Video', 'Rata-rata views']);
    s.topTags.slice(0, 10).forEach(t => kv(t.tag, [t.count, t.avgViews], '#,##0'));
  }
};

const VIDEO_COLUMNS = [
  { header: 'No', key: 'no', width: 6 },
  { header: 'Thumbnail', key: 'thumb', width: 19 },
  { header: 'Judul', key: 'title', width: 52 },
  { header: 'Jenis', key: 'type', width: 9 },
  { header: 'Durasi', key: 'duration', width: 9 },
  { header: 'Tanggal upload', key: 'published', width: 14 },
  { header: 'Hari upload', key: 'uday', width: 11 },
  { header: 'Jam upload', key: 'uhour', width: 10 },
  { header: 'Bagian hari', key: 'upart', width: 11 },
  { header: 'Umur (hari)', key: 'age', width: 10 },
  { header: 'Views', key: 'views', width: 13 },
  { header: 'Likes', key: 'likes', width: 11 },
  { header: 'Komentar', key: 'comments', width: 11 },
  { header: 'ER', key: 'er', width: 9 },
  { header: 'Views/hari', key: 'vpd', width: 11 },
  { header: 'Rasio jangkauan', key: 'reach', width: 11 },
  { header: 'Outlier', key: 'outlier', width: 9 },
  { header: 'Skor judul', key: 'ts', width: 9 },
  { header: 'Nilai judul', key: 'tg', width: 9 },
  { header: 'Skor thumbnail', key: 'ths', width: 10 },
  { header: 'Nilai thumbnail', key: 'thg', width: 10 },
  { header: 'Keyakinan', key: 'conf', width: 10 },
  { header: 'Tag', key: 'tags', width: 40 },
  { header: 'Channel', key: 'channel', width: 22 },
  { header: 'Video ID', key: 'id', width: 14 },
  { header: 'URL', key: 'url', width: 44 },
];

/** Excel tidak mengenal zona waktu: geser agar sel menampilkan tanggal/jam lokal pembuat laporan. */
const excelLocalDate = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000);
};

const TITLE_COL = VIDEO_COLUMNS.findIndex(c => c.key === 'title') + 1;
const TAGS_COL = VIDEO_COLUMNS.findIndex(c => c.key === 'tags') + 1;

const buildVideoSheet = (wb: Workbook, rows: ReportRow[], thumbs: Map<string, ThumbImage> | null) => {
  const ws = wb.addWorksheet('Video', {
    views: [{ state: 'frozen', xSplit: 3, ySplit: 1, showGridLines: false }],
    properties: { tabColor: { argb: INK } },
  });
  ws.columns = VIDEO_COLUMNS.map(c => ({ header: c.header, key: c.key, width: c.width }));
  styleHeaderRow(ws, 1);
  ws.pageSetup = {
    paperSize: 9,
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: '1:1',
    margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
  };
  ws.headerFooter = { oddFooter: '&L&8YT Analyzer Pro&R&8Halaman &P dari &N' };

  const rowHeight = thumbs ? 62 : 20;
  rows.forEach((r, i) => {
    const row = ws.addRow({
      no: r.no,
      thumb: '',
      title: { text: r.title, hyperlink: r.url },
      type: r.type,
      duration: r.duration,
      published: excelLocalDate(r.publishedAt),
      uday: r.uploadDay,
      uhour: r.uploadTime,
      upart: r.uploadDaypart,
      age: r.ageDays,
      views: r.views,
      likes: r.likes ?? 'Disembunyikan',
      comments: r.comments ?? 'Nonaktif',
      er: r.engagementRate === null ? '-' : r.engagementRate / 100,
      vpd: r.viewsPerDay,
      reach: r.reachRatio,
      outlier: r.isOutlier ? 'Ya' : '',
      ts: r.titleScore,
      tg: r.titleGrade,
      ths: r.thumbnailScore,
      thg: r.thumbnailGrade,
      conf: r.scoreConfidence,
      tags: r.tags.join(', '),
      channel: r.channelTitle,
      id: r.id,
      url: { text: r.url, hyperlink: r.url },
    });
    row.height = rowHeight;
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      cell.font = { name: 'Arial', size: 10, color: { argb: INK } };
      cell.alignment = { vertical: 'middle', wrapText: col === TITLE_COL || col === TAGS_COL };
      cell.border = thinBorder;
      if (i % 2) cell.fill = solid(ZEBRA);
    });
    row.getCell('title').font = { name: 'Arial', size: 10, color: { argb: 'FF065FD4' }, underline: true };
    row.getCell('url').font = { name: 'Arial', size: 9, color: { argb: 'FF065FD4' } };
    row.getCell('published').numFmt = 'dd mmm yyyy';
    ['views', 'likes', 'comments', 'vpd', 'age'].forEach(k => (row.getCell(k).numFmt = '#,##0'));
    row.getCell('er').numFmt = '0.00%';
    row.getCell('reach').numFmt = '0.0"×"';
    ['no', 'type', 'duration', 'published', 'uday', 'uhour', 'upart', 'outlier', 'ts', 'ths', 'conf'].forEach(k => (row.getCell(k).alignment = { horizontal: 'center', vertical: 'middle' }));
    if (r.isOutlier) row.getCell('outlier').font = { name: 'Arial', bold: true, color: { argb: 'FFCC0000' } };
    gradeCell(row.getCell('tg'), r.titleGrade);
    gradeCell(row.getCell('thg'), r.thumbnailGrade);

    const img = thumbs?.get(r.id);
    if (img) {
      const id = wb.addImage({ base64: img.dataUrl, extension: 'jpeg' });
      // Kolom B (index 1), baris data (index i + 1); ukuran 128×72 px
      ws.addImage(id, { tl: { col: 1.06, row: i + 1.08 }, ext: { width: 128, height: 72 }, editAs: 'oneCell' });
    }
  });

  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: VIDEO_COLUMNS.length } };
};

const CONFIDENCE_ARGB: Record<string, string> = { tinggi: 'FF0B8043', sedang: 'FFE8710A', rendah: 'FF909090' };

const buildScheduleSheet = (wb: Workbook, report: Report) => {
  const sc = report.schedule;
  const ws = wb.addWorksheet('Jadwal Upload', { views: [{ showGridLines: false }], properties: { tabColor: { argb: 'FF065FD4' } } });
  // A: label • B–Y: 24 kolom jam (peta panas) / kolom tabel
  ws.columns = [{ width: 26 }, ...Array.from({ length: 24 }, () => ({ width: 6.2 }))];
  ws.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } };
  addTitleBlock(ws, report, 'Y');
  ws.getCell('A1').value = `Jadwal Upload — ${report.context.title}`;
  let r = 4;

  const heading = (text: string, sub?: string) => {
    ws.mergeCells(r, 1, r, 25);
    const c = ws.getCell(r, 1);
    c.value = text.toUpperCase();
    c.font = { name: 'Arial', bold: true, size: 10, color: { argb: INK } };
    for (let col = 1; col <= 25; col++) ws.getCell(r, col).border = { bottom: { style: 'medium', color: { argb: INK } } };
    ws.getRow(r).height = 20;
    r++;
    if (sub) {
      ws.mergeCells(r, 1, r, 25);
      const d = ws.getCell(r, 1);
      d.value = sub;
      d.font = { name: 'Arial', size: 9, color: { argb: MUTED } };
      d.alignment = { wrapText: true, vertical: 'top' };
      ws.getRow(r).height = 26;
      r++;
    }
  };

  // Tabel: kolom A label, lalu kolom bergabung 3 sel per nilai (B–D, E–G, ...)
  const tableHeader = (headers: string[]) => {
    const h = ws.getCell(r, 1);
    h.value = headers[0];
    headers.slice(1).forEach((t, i) => {
      ws.mergeCells(r, 2 + i * 3, r, 4 + i * 3);
      ws.getCell(r, 2 + i * 3).value = t;
    });
    const last = 1 + (headers.length - 1) * 3;
    for (let col = 1; col <= last; col++) {
      const c = ws.getCell(r, col);
      c.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
      c.fill = solid(INK);
      c.alignment = { vertical: 'middle', horizontal: col === 1 ? 'left' : 'center', indent: col === 1 ? 1 : 0 };
    }
    ws.getRow(r).height = 20;
    r++;
    return last;
  };
  const tableRow = (values: Array<string | number | null>, fmts: Array<string | undefined>, opts: { perf?: number | null; confidence?: string; zebra?: boolean } = {}) => {
    const l = ws.getCell(r, 1);
    l.value = values[0];
    l.font = { name: 'Arial', size: 10, bold: true, color: { argb: INK } };
    l.alignment = { indent: 1, vertical: 'middle' };
    values.slice(1).forEach((v, i) => {
      ws.mergeCells(r, 2 + i * 3, r, 4 + i * 3);
      const c = ws.getCell(r, 2 + i * 3);
      c.value = v ?? '-';
      c.font = { name: 'Arial', size: 10, color: { argb: INK } };
      c.alignment = { horizontal: 'center', vertical: 'middle' };
      if (fmts[i] && typeof v === 'number') c.numFmt = fmts[i]!;
    });
    const last = 1 + (values.length - 1) * 3;
    for (let col = 1; col <= last; col++) {
      const c = ws.getCell(r, col);
      c.border = { bottom: { style: 'hair', color: { argb: BORDER } } };
      if (opts.zebra) c.fill = solid(ZEBRA);
    }
    return { last };
  };

  // Ringkasan
  heading(
    'Ringkasan',
    `${sc.totalVideos.toLocaleString('id-ID')} video • waktu dalam zona ${sc.timeZone} (${sc.utcOffset}). Performa = views dibanding perkiraan views video seusia (1,0× = rata-rata).`
  );
  const summaryRows: Array<[string, string]> = [
    ['Hari terbaik', sc.bestDay ? `${sc.bestDay.day} — ${sc.bestDay.performance}× (${sc.bestDay.uploads} upload)` : 'Data belum cukup'],
    ['Jam terbaik', sc.bestHour ? `${sc.bestHour.hour} — ${sc.bestHour.performance}× (${sc.bestHour.uploads} upload)` : 'Data belum cukup'],
    ['Paling sering upload', sc.busiestDay ? `${sc.busiestDay.day} (${sc.busiestDay.uploads} upload)` : '-'],
    ['Rekomendasi', sc.recommendation ?? 'Belum ada slot dengan minimal 2 upload.'],
  ];
  summaryRows.forEach(([k, v]) => {
    ws.getCell(r, 1).value = k;
    ws.getCell(r, 1).font = { name: 'Arial', size: 10, color: { argb: MUTED } };
    ws.getCell(r, 1).alignment = { indent: 1, vertical: 'top' };
    ws.mergeCells(r, 2, r, 25);
    const c = ws.getCell(r, 2);
    c.value = v;
    c.font = { name: 'Arial', size: 10, bold: k !== 'Rekomendasi', color: { argb: INK } };
    c.alignment = { wrapText: true, vertical: 'top' };
    ws.getRow(r).height = k === 'Rekomendasi' ? 30 : 18;
    r++;
  });
  r++;

  // Slot terbaik / terendah
  const slotTable = (title: string, list: ScheduleSlotRow[]) => {
    heading(title);
    if (!list.length) {
      ws.getCell(r, 1).value = 'Data belum cukup (butuh minimal 2 upload per blok 3 jam).';
      ws.getCell(r, 1).font = { name: 'Arial', size: 10, italic: true, color: { argb: MUTED } };
      r += 2;
      return;
    }
    tableHeader(['Slot', 'Upload', 'Performa', 'Median views', 'Keyakinan']);
    list.forEach((sl, i) => {
      tableRow([`${sl.day}, ${sl.time}`, sl.uploads, sl.performance, sl.medianViews, sl.confidence], ['#,##0', '0.0"×"', '#,##0'], { zebra: i % 2 === 1 });
      ws.getCell(r, 5).fill = solid(performanceArgb(sl.performance));
      ws.getCell(r, 11).font = { name: 'Arial', size: 10, bold: true, color: { argb: CONFIDENCE_ARGB[sl.confidence] } };
      r++;
    });
    r++;
  };
  slotTable('Slot 3 jam terbaik (di atas rata-rata)', sc.bestSlots);
  slotTable('Slot 3 jam terendah (di bawah rata-rata)', sc.worstSlots);

  // Tabel per kelompok
  const groupTable = (title: string, rows: ScheduleRow[]) => {
    heading(title);
    tableHeader(['Waktu', 'Upload', 'Performa', 'Median views', 'Rata-rata views', 'Keyakinan', 'Peringkat']);
    rows.forEach((g, i) => {
      tableRow([g.label, g.uploads, g.performance, g.medianViews, g.avgViews, g.confidence, g.rank], ['#,##0', '0.0"×"', '#,##0', '#,##0', undefined, '0'], {
        zebra: i % 2 === 1,
      });
      ws.getCell(r, 5).fill = solid(performanceArgb(g.performance));
      ws.getCell(r, 14).font = { name: 'Arial', size: 10, bold: true, color: { argb: CONFIDENCE_ARGB[g.confidence] } };
      if (g.rank === 1) ws.getCell(r, 17).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0B8043' } };
      if (!g.rank) ws.getRow(r).eachCell(c => (c.font = { ...c.font, color: { argb: MUTED } }));
      r++;
    });
    r++;
  };
  groupTable('Performa per hari', sc.groups.day);
  groupTable('Performa per bagian hari', sc.groups.daypart);
  groupTable('Performa per blok 3 jam', sc.groups.block);

  // Peta panas
  const heatmap = (title: string, sub: string, value: (di: number, h: number) => { text: string | number; fill: string; dark?: boolean }) => {
    heading(title, sub);
    const hr = ws.getRow(r);
    hr.getCell(1).value = 'Hari / jam';
    for (let h = 0; h < 24; h++) hr.getCell(2 + h).value = String(h).padStart(2, '0');
    hr.eachCell(c => {
      c.font = { name: 'Arial', bold: true, size: 8, color: { argb: 'FFFFFFFF' } };
      c.fill = solid(INK);
      c.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    r++;
    sc.heatmap.days.forEach((day, di) => {
      const row = ws.getRow(r);
      row.height = 20;
      row.getCell(1).value = day;
      row.getCell(1).font = { name: 'Arial', size: 9, bold: true };
      row.getCell(1).alignment = { indent: 1, vertical: 'middle' };
      for (let h = 0; h < 24; h++) {
        const { text, fill, dark } = value(di, h);
        const c = row.getCell(2 + h);
        c.value = text;
        c.fill = solid(fill);
        c.font = { name: 'Arial', size: 8, color: { argb: dark ? 'FFFFFFFF' : INK } };
        c.alignment = { horizontal: 'center', vertical: 'middle' };
        c.border = { top: { style: 'thin', color: { argb: 'FFFFFFFF' } }, left: { style: 'thin', color: { argb: 'FFFFFFFF' } } };
        if (typeof text === 'number' && text % 1 !== 0) c.numFmt = '0.0';
      }
      r++;
    });
    r++;
  };
  heatmap('Peta panas performa (hari × jam)', 'Angka = performa (×). Biru = di atas rata-rata, merah = di bawah rata-rata, abu-abu = belum ada upload.', (di, h) => {
    const p = sc.heatmap.performance[di][h];
    return { text: p === null ? '' : p, fill: performanceArgb(p), dark: p !== null && (p >= 2 || p <= 0.4) };
  });
  const maxCount = Math.max(1, ...sc.heatmap.uploads.flat());
  heatmap('Peta panas jumlah upload (hari × jam)', 'Angka = jumlah video yang diupload di slot tersebut.', (di, h) => {
    const n = sc.heatmap.uploads[di][h];
    if (!n) return { text: '', fill: 'FFF2F2F2' };
    const alpha = 0.15 + (n / maxCount) * 0.85;
    const mix = [6, 95, 212].map(c => Math.round(255 + (c - 255) * alpha).toString(16).padStart(2, '0')).join('');
    return { text: n, fill: `FF${mix.toUpperCase()}`, dark: alpha > 0.6 };
  });

  groupTable('Performa per jam', sc.groups.hour);

  // Detail upload per video (terbaru dulu)
  heading('Detail upload per video', `Hari, tanggal, dan jam upload setiap video (zona waktu ${sc.timeZone}, ${sc.utcOffset}), urut dari yang terbaru.`);
  const detailHeaders = ['Judul', 'Tanggal', 'Hari', 'Jam', 'Bagian hari', 'Views', 'Performa'];
  const hdr = ws.getRow(r);
  hdr.getCell(1).value = detailHeaders[0];
  ws.mergeCells(r, 1, r, 9);
  detailHeaders.slice(1).forEach((h, i) => {
    ws.mergeCells(r, 10 + i * 2, r, 11 + i * 2);
    hdr.getCell(10 + i * 2).value = h;
  });
  for (let col = 1; col <= 21; col++) {
    const c = hdr.getCell(col);
    c.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
    c.fill = solid(INK);
    c.alignment = { vertical: 'middle', horizontal: col === 1 ? 'left' : 'center', indent: col === 1 ? 1 : 0 };
  }
  hdr.height = 20;
  r++;
  [...report.rows]
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .forEach((v, i) => {
      const row = ws.getRow(r);
      ws.mergeCells(r, 1, r, 9);
      const t = row.getCell(1);
      t.value = { text: v.title, hyperlink: v.url };
      t.font = { name: 'Arial', size: 9, color: { argb: 'FF065FD4' }, underline: true };
      t.alignment = { indent: 1, vertical: 'middle' };
      const vals: Array<[unknown, string | undefined]> = [
        [excelLocalDate(v.publishedAt), 'dd mmm yyyy'],
        [v.uploadDay, undefined],
        [v.uploadTime, undefined],
        [v.uploadDaypart, undefined],
        [v.views, '#,##0'],
        [v.reachRatio, '0.0"×"'],
      ];
      vals.forEach(([val, fmt], j) => {
        ws.mergeCells(r, 10 + j * 2, r, 11 + j * 2);
        const c = row.getCell(10 + j * 2);
        c.value = val as never;
        c.font = { name: 'Arial', size: 9, color: { argb: INK } };
        c.alignment = { horizontal: 'center', vertical: 'middle' };
        if (fmt) c.numFmt = fmt;
      });
      row.getCell(20).fill = solid(performanceArgb(v.reachRatio));
      for (let col = 1; col <= 21; col++) {
        const c = row.getCell(col);
        c.border = { bottom: { style: 'hair', color: { argb: BORDER } } };
        if (i % 2 && col !== 20) c.fill = solid(ZEBRA);
      }
      r++;
    });
};

const buildTagSheet = (wb: Workbook, report: Report) => {
  const ws = wb.addWorksheet('Tag', { views: [{ state: 'frozen', ySplit: 1, showGridLines: false }] });
  ws.columns = [
    { header: 'Peringkat', key: 'rank', width: 10 },
    { header: 'Tag', key: 'tag', width: 36 },
    { header: 'Dipakai di (video)', key: 'count', width: 18 },
    { header: 'Total views', key: 'total', width: 16 },
    { header: 'Rata-rata views', key: 'avg', width: 16 },
  ];
  styleHeaderRow(ws, 1);
  report.summary.topTags.forEach((t, i) => {
    const row = ws.addRow({ rank: i + 1, tag: t.tag, count: t.count, total: t.totalViews, avg: t.avgViews });
    row.eachCell(cell => {
      cell.font = { name: 'Arial', size: 10 };
      cell.border = thinBorder;
      if (i % 2) cell.fill = solid(ZEBRA);
    });
    row.getCell('total').numFmt = '#,##0';
    row.getCell('avg').numFmt = '#,##0';
  });
  if (!report.summary.topTags.length) ws.addRow({ tag: 'Video tidak memiliki tag publik' });
};

const buildMethodSheet = (wb: Workbook) => {
  const ws = wb.addWorksheet('Metodologi', { views: [{ showGridLines: false }] });
  ws.columns = [{ width: 26 }, { width: 110 }];
  ws.addRow(['Istilah', 'Penjelasan']);
  styleHeaderRow(ws, 1);
  METHODOLOGY.forEach(([k, v]) => {
    const row = ws.addRow([k, v]);
    row.getCell(1).font = { name: 'Arial', bold: true, size: 10 };
    row.getCell(2).font = { name: 'Arial', size: 10 };
    row.getCell(2).alignment = { wrapText: true, vertical: 'top' };
    row.getCell(1).alignment = { vertical: 'top' };
    row.eachCell(c => (c.border = thinBorder));
  });
  ws.addRow([]);
  ws.addRow(['Sumber data', 'YouTube Data API v3 (statistik publik). Dibuat dengan YT Analyzer Pro.']);
};

export const buildExcel = async (report: Report, thumbs: Map<string, ThumbImage> | null, avatar?: ThumbImage): Promise<Blob> => {
  const mod = await import('exceljs');
  const ExcelJS = (mod as unknown as { default?: typeof mod }).default ?? mod;
  const wb = new ExcelJS.Workbook();
  wb.creator = APP_NAME;
  wb.created = report.context.generatedAt;
  wb.title = report.context.title;

  buildSummarySheet(wb, report, avatar);
  buildScheduleSheet(wb, report);
  buildVideoSheet(wb, report.rows, thumbs);
  buildTagSheet(wb, report);
  buildMethodSheet(wb);

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};
