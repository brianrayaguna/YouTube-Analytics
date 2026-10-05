// Laporan PDF profesional (jsPDF + AutoTable), dimuat hanya saat dibutuhkan.
// Catatan: font standar PDF hanya mendukung huruf Latin; karakter lain (emoji, aksara non-Latin)
// dihapus. Untuk Unicode penuh gunakan laporan HTML lalu cetak ke PDF.

import type { jsPDF as JsPDF } from 'jspdf';
import { Report, METHODOLOGY, GRADE_COLORS, APP_NAME, sourceLabel, formatDateId, performanceRgb, ScheduleRow } from './reportModel';
import { ThumbImage } from './thumbnails';
import { formatNumber, formatFullNumber } from '../../lib/format';

type RGB = [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
const INK: RGB = [15, 15, 15];
const MUTED: RGB = [96, 96, 96];
const LINE: RGB = [229, 229, 229];
const CHIP: RGB = [242, 242, 242];
const RED: RGB = [255, 0, 0];
const BLUE: RGB = [6, 95, 212];

const PUNCT: Record<string, string> = { '—': '-', '–': '-', '‘': "'", '’': "'", '“': '"', '”': '"', '…': '...', '•': '-', '×': 'x', '≥': '>=', '≤': '<=', '÷': '/', '≈': '~', 'τ': 'tau', '→': '->' };

/** Sesuaikan teks dengan font standar PDF (WinAnsi). */
export const pdfText = (s: string): string => {
  const mapped = Array.from(s ?? '')
    .map(ch => PUNCT[ch] ?? ch)
    .join('')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return mapped || '(teks non-Latin - lihat Excel/HTML)';
};

export const buildPdf = async (report: Report, thumbs: Map<string, ThumbImage> | null, avatar?: ThumbImage): Promise<Blob> => {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc: JsPDF = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const { context: ctx, summary: s, rows } = report;
  const title = pdfText(ctx.title);

  doc.setProperties({ title: `${title} - ${APP_NAME}`, creator: APP_NAME, subject: 'Laporan analisis YouTube' });

  const pageW = () => doc.internal.pageSize.getWidth();
  const pageH = () => doc.internal.pageSize.getHeight();
  const M = 14;

  // ---------- Halaman 1: sampul + ringkasan ----------
  doc.setFillColor(...RED);
  doc.rect(0, 0, pageW(), 4, 'F');

  // logo
  doc.setFillColor(...RED);
  doc.roundedRect(M, 14, 10, 7, 2, 2, 'F');
  doc.setFillColor(255, 255, 255);
  doc.triangle(M + 4, 15.8, M + 4, 19.2, M + 7, 17.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(`${APP_NAME}  |  Laporan analisis`, M + 13, 19);

  let y = 34;
  const textX = avatar ? M + 30 : M;
  if (avatar) {
    doc.addImage(avatar.dataUrl, 'JPEG', M, y - 6, 24, 24);
  }
  doc.setTextColor(...INK);
  doc.setFontSize(22);
  doc.text(doc.splitTextToSize(title, pageW() - textX - M).slice(0, 2), textX, y + 2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...MUTED);
  const metaLine = [
    sourceLabel(ctx),
    ctx.channelStats?.customUrl,
    `${formatFullNumber(s.totalVideos)} video`,
    `upload ${formatDateId(s.firstPublished)} - ${formatDateId(s.lastPublished)}`,
  ]
    .filter(Boolean)
    .join('  |  ');
  doc.text(pdfText(metaLine), textX, y + 12);
  doc.text(pdfText(`Dibuat ${formatDateId(ctx.generatedAt, true)}${ctx.scopeNote ? `  |  ${ctx.scopeNote}` : ''}`), textX, y + 17);
  y += 30;

  // KPI
  const kpis: Array<[string, string, string]> = [];
  if (ctx.channelStats && !ctx.channelStats.hiddenSubscriberCount) {
    kpis.push(['Subscriber', formatNumber(ctx.channelStats.subCountRaw), `${formatNumber(ctx.channelStats.viewCountRaw ?? 0)} views channel`]);
  }
  kpis.push(
    ['Total views', formatNumber(s.totalViews), `rata-rata ${formatNumber(s.avgViews)}`],
    ['Median views', formatNumber(s.medianViews), `${s.long} video | ${s.shorts} Shorts`],
    ['Engagement rate', `${s.avgEngagementRate.toFixed(2)}%`, `${formatNumber(s.totalLikes)} likes`],
    ['Outlier', String(s.outliers), 'views >= 3x median'],
    ['Skor judul', String(s.avgTitleScore), 'rata-rata / 100'],
    ['Skor thumbnail', String(s.avgThumbnailScore), 'rata-rata / 100'],
    ['Upload / minggu', String(s.uploadsPerWeek), 'rentang data']
  );
  const cols = 4;
  const gap = 3.5;
  const boxW = (pageW() - 2 * M - gap * (cols - 1)) / cols;
  const boxH = 20;
  kpis.slice(0, 8).forEach((k, i) => {
    const x = M + (i % cols) * (boxW + gap);
    const by = y + Math.floor(i / cols) * (boxH + gap);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, by, boxW, boxH, 2.5, 2.5, 'S');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(pdfText(k[0]), x + 4, by + 6);
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...INK);
    doc.text(pdfText(k[1]), x + 4, by + 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(pdfText(k[2]), x + 4, by + 19);
  });
  y += Math.ceil(Math.min(kpis.length, 8) / cols) * (boxH + gap) + 5;

  // Distribusi nilai (bar bertumpuk)
  const drawDistribution = (label: string, dist: Record<string, number>, yy: number) => {
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(label, M, yy);
    const total = Object.values(dist).reduce((a, b) => a + b, 0) || 1;
    let x = M + 32;
    const w = pageW() - M - x;
    (['A', 'B', 'C', 'D', 'F'] as const).forEach(g => {
      const segW = (dist[g] / total) * w;
      if (segW <= 0) return;
      doc.setFillColor(...hex(GRADE_COLORS[g]));
      doc.rect(x, yy - 3.5, segW, 5, 'F');
      if (segW > 8) {
        doc.setFontSize(7);
        doc.setTextColor(255, 255, 255);
        doc.text(`${g} ${dist[g]}`, x + 1.5, yy);
      }
      x += segW;
    });
  };
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text('Distribusi nilai', M, y);
  doc.setFont('helvetica', 'normal');
  drawDistribution('Skor judul', s.titleGrades, y + 7);
  drawDistribution('Skor thumbnail', s.thumbnailGrades, y + 14);
  y += 23;

  // Format konten + tag
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Format konten', M, y);
  doc.text('Tag teratas', pageW() / 2 + 2, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  s.formats.forEach((f, i) =>
    doc.text(pdfText(`${f.type === 'Shorts' ? 'Shorts (<= 3 menit)' : 'Video panjang'}: ${f.count} | rata-rata ${formatNumber(f.avgViews)} views | ER ${f.avgEngagementRate}%`), M, y + 6 + i * 5)
  );
  const tagLine = s.topTags.slice(0, 18).map(t => `${t.tag} (${t.count})`).join(', ');
  doc.text(doc.splitTextToSize(pdfText(tagLine || 'Tidak ada tag publik'), pageW() / 2 - M - 2).slice(0, 3), pageW() / 2 + 2, y + 6);
  y += 21;

  // Top 10
  const top = [...rows].sort((a, b) => b.views - a.views).slice(0, 10);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text('10 video teratas berdasarkan views', M, y);
  autoTable(doc, {
    startY: y + 3,
    margin: { left: M, right: M, bottom: 16 },
    head: [['#', 'Thumbnail', 'Judul', 'Views', 'ER', 'Judul', 'Thumb']],
    body: top.map((r, i) => [
      String(i + 1),
      '',
      pdfText(r.title),
      formatNumber(r.views),
      r.engagementRate === null ? '-' : `${r.engagementRate.toFixed(1)}%`,
      `${r.titleGrade} ${r.titleScore}`,
      `${r.thumbnailGrade} ${r.thumbnailScore}`,
    ]),
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.2, valign: 'middle', textColor: INK, lineColor: LINE, lineWidth: { bottom: 0.2 } },
    headStyles: { fillColor: INK, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
    columnStyles: { 0: { cellWidth: 7, halign: 'center' }, 1: { cellWidth: thumbs ? 17 : 1, minCellHeight: thumbs ? 9.6 : 0 }, 3: { halign: 'right', cellWidth: 18 }, 4: { halign: 'right', cellWidth: 13 }, 5: { cellWidth: 14, halign: 'center' }, 6: { cellWidth: 14, halign: 'center' } },
    didParseCell: data => {
      if (data.section === 'body' && (data.column.index === 5 || data.column.index === 6)) {
        const g = String(data.cell.raw).charAt(0) as keyof typeof GRADE_COLORS;
        data.cell.styles.fillColor = hex(GRADE_COLORS[g] ?? '606060');
        data.cell.styles.textColor = [255, 255, 255];
        data.cell.styles.fontStyle = 'bold';
      }
    },
    didDrawCell: data => {
      if (thumbs && data.section === 'body' && data.column.index === 1) {
        const img = thumbs.get(top[data.row.index]?.id);
        if (img) doc.addImage(img.dataUrl, 'JPEG', data.cell.x + 1, data.cell.y + (data.cell.height - 8.4) / 2, 15, 8.4);
      }
    },
  });

  // ---------- Jadwal upload ----------
  const sc = report.schedule;
  doc.addPage('a4', 'portrait');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...INK);
  doc.text('Jadwal upload', M, 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text(
    doc.splitTextToSize(
      pdfText(`${formatFullNumber(sc.totalVideos)} video • waktu dalam zona ${sc.timeZone} (${sc.utcOffset}). Performa = views dibanding perkiraan views video seusia (1,0x = rata-rata).`),
      pageW() - 2 * M
    ),
    M,
    23.5
  );
  y = 30;
  const schedKpis: Array<[string, string, string]> = [
    ['Hari terbaik', sc.bestDay?.day ?? '-', sc.bestDay ? `${sc.bestDay.performance}x | ${sc.bestDay.uploads} upload` : 'data belum cukup'],
    ['Jam terbaik', sc.bestHour?.hour ?? '-', sc.bestHour ? `${sc.bestHour.performance}x | ${sc.bestHour.uploads} upload` : 'data belum cukup'],
    ['Slot 3 jam terbaik', sc.bestSlots[0] ? `${sc.bestSlots[0].day} ${sc.bestSlots[0].time}` : '-', sc.bestSlots[0] ? `${sc.bestSlots[0].performance}x | keyakinan ${sc.bestSlots[0].confidence}` : 'data belum cukup'],
    ['Paling sering upload', sc.busiestDay?.day ?? '-', sc.busiestDay ? `${sc.busiestDay.uploads} upload` : ''],
  ];
  schedKpis.forEach((k, i) => {
    const x = M + i * (boxW + gap);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, boxW, boxH, 2.5, 2.5, 'S');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(pdfText(k[0]), x + 4, y + 6);
    doc.setFontSize(k[1].length > 12 ? 10 : 14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...BLUE);
    doc.text(pdfText(k[1]), x + 4, y + 13.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text(pdfText(k[2]), x + 4, y + 18.5);
  });
  y += boxH + 6;
  if (sc.recommendation) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const lines = doc.splitTextToSize(pdfText(sc.recommendation), pageW() - 2 * M - 8);
    const h = lines.length * 4 + 6;
    doc.setFillColor(230, 239, 251);
    doc.roundedRect(M, y, pageW() - 2 * M, h, 2.5, 2.5, 'F');
    doc.setTextColor(...INK);
    doc.text(lines, M + 4, y + 5.5);
    y += h + 6;
  }

  // Peta panas performa hari × jam
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text('Peta panas performa (hari x jam)', M, y);
  y += 4;
  const labelW = 16;
  const cellW = (pageW() - 2 * M - labelW) / 24;
  const cellH = 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...MUTED);
  for (let h = 0; h < 24; h += 3) doc.text(String(h).padStart(2, '0'), M + labelW + h * cellW + cellW / 2, y + 2.5, { align: 'center' });
  y += 4;
  sc.heatmap.days.forEach((day, di) => {
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(pdfText(day), M, y + cellH / 2 + 1.2);
    for (let h = 0; h < 24; h++) {
      const p = sc.heatmap.performance[di][h];
      doc.setFillColor(...performanceRgb(p));
      doc.rect(M + labelW + h * cellW + 0.3, y + 0.3, cellW - 0.6, cellH - 0.6, 'F');
      const n = sc.heatmap.uploads[di][h];
      if (n) {
        doc.setFontSize(5.5);
        doc.setTextColor(...(p !== null && (p >= 2 || p <= 0.4) ? ([255, 255, 255] as RGB) : INK));
        doc.text(String(n), M + labelW + h * cellW + cellW / 2, y + cellH / 2 + 1, { align: 'center' });
      }
    }
    y += cellH;
  });
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text('Angka di sel = jumlah upload. Biru = di atas rata-rata, merah = di bawah rata-rata, abu-abu = belum ada upload.', M, y + 4);
  y += 10;

  const perfCell = (data: { section: string; column: { index: number }; cell: { raw: unknown; styles: { fillColor: unknown; fontStyle: string } } }, col: number) => {
    if (data.section === 'body' && data.column.index === col) {
      const p = parseFloat(String(data.cell.raw));
      if (!Number.isNaN(p)) {
        data.cell.styles.fillColor = performanceRgb(p);
        data.cell.styles.fontStyle = 'bold';
      }
    }
  };
  const groupTable = (title: string, list: ScheduleRow[], startY: number, half?: 'left' | 'right') => {
    const width = half ? (pageW() - 2 * M - 6) / 2 : pageW() - 2 * M;
    const left = half === 'right' ? M + width + 6 : M;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    doc.text(title, left, startY);
    autoTable(doc, {
      startY: startY + 2.5,
      margin: { left, right: pageW() - left - width, bottom: 16 },
      tableWidth: width,
      head: [['Waktu', 'Upload', 'Performa', 'Median views', 'Keyakinan']],
      body: list.map(g => [pdfText(g.label), String(g.uploads), `${g.performance.toFixed(1)}x`, formatNumber(g.medianViews), g.rank ? g.confidence : `${g.confidence}*`]),
      theme: 'plain',
      styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 1.2, valign: 'middle', textColor: INK, lineColor: LINE, lineWidth: { bottom: 0.2 } },
      headStyles: { fillColor: INK, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'center' }, 3: { halign: 'right' }, 4: { halign: 'center' } },
      didParseCell: data => perfCell(data as never, 2),
    });
    return (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? startY + 40;
  };
  const leftEnd = groupTable('Per hari', sc.groups.day, y, 'left');
  const rightEnd = groupTable('Per bagian hari', sc.groups.daypart, y, 'right');
  y = Math.max(leftEnd, rightEnd) + 8;

  const slotRows = [
    ...sc.bestSlots.map(sl => ['Terbaik', pdfText(`${sl.day}, ${sl.time}`), String(sl.uploads), `${sl.performance.toFixed(1)}x`, formatNumber(sl.medianViews), sl.confidence]),
    ...sc.worstSlots.map(sl => ['Terendah', pdfText(`${sl.day}, ${sl.time}`), String(sl.uploads), `${sl.performance.toFixed(1)}x`, formatNumber(sl.medianViews), sl.confidence]),
  ];
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  doc.text('Slot 3 jam terbaik & terendah', M, y);
  autoTable(doc, {
    startY: y + 2.5,
    margin: { left: M, right: M, bottom: 16 },
    head: [['', 'Slot', 'Upload', 'Performa', 'Median views', 'Keyakinan']],
    body: slotRows.length ? slotRows : [['-', 'Data belum cukup (butuh minimal 2 upload per blok 3 jam)', '', '', '', '']],
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.3, valign: 'middle', textColor: INK, lineColor: LINE, lineWidth: { bottom: 0.2 } },
    headStyles: { fillColor: INK, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
    columnStyles: { 0: { cellWidth: 20, fontStyle: 'bold' }, 2: { halign: 'right' }, 3: { halign: 'center' }, 4: { halign: 'right' }, 5: { halign: 'center' } },
    didParseCell: data => perfCell(data as never, 3),
  });
  y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 30) + 8;
  if (y > pageH() - 60) {
    doc.addPage('a4', 'portrait');
    y = 20;
  }
  groupTable('Per blok 3 jam', sc.groups.block, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  const noteY = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 5;
  doc.text('* kurang dari 2 upload - belum bisa diperingkat. Tabel per jam lengkap tersedia di Excel, HTML, JSON, dan CSV jadwal.', M, noteY);

  // ---------- Daftar semua video (landscape) ----------
  doc.addPage('a4', 'landscape');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...INK);
  doc.text(`Daftar video (${formatFullNumber(rows.length)})`, M, 18);
  autoTable(doc, {
    startY: 23,
    margin: { left: M, right: M, top: 16, bottom: 16 },
    head: [['#', 'Thumbnail', 'Judul', 'Jenis', 'Tanggal', 'Views', 'Likes', 'Komentar', 'ER', 'Views/hari', 'Rasio', 'Judul', 'Thumb']],
    body: rows.map(r => [
      String(r.no),
      '',
      pdfText(r.title) + (r.isOutlier ? '  [OUTLIER]' : ''),
      `${r.type}\n${r.duration}`,
      `${pdfText(formatDateId(r.publishedAt))}\n${pdfText(`${r.uploadDay} ${r.uploadHour}`)}`,
      formatFullNumber(r.views),
      r.likes === null ? 'tersembunyi' : formatFullNumber(r.likes),
      r.comments === null ? 'nonaktif' : formatFullNumber(r.comments),
      r.engagementRate === null ? '-' : `${r.engagementRate.toFixed(2)}%`,
      formatFullNumber(r.viewsPerDay),
      `${r.reachRatio.toFixed(1)}x`,
      `${r.titleGrade} ${r.titleScore}`,
      `${r.thumbnailGrade} ${r.thumbnailScore}`,
    ]),
    theme: 'plain',
    rowPageBreak: 'avoid',
    styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 1.5, valign: 'middle', textColor: INK, lineColor: LINE, lineWidth: { bottom: 0.2 } },
    headStyles: { fillColor: INK, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: thumbs ? 22 : 1, minCellHeight: thumbs ? 12.6 : 0 },
      3: { cellWidth: 15 },
      4: { cellWidth: 20 },
      5: { halign: 'right', cellWidth: 20 },
      6: { halign: 'right', cellWidth: 17 },
      7: { halign: 'right', cellWidth: 16 },
      8: { halign: 'right', cellWidth: 13 },
      9: { halign: 'right', cellWidth: 16 },
      10: { halign: 'right', cellWidth: 11 },
      11: { halign: 'center', cellWidth: 13 },
      12: { halign: 'center', cellWidth: 13 },
    },
    didParseCell: data => {
      if (data.section !== 'body') return;
      if (data.column.index === 11 || data.column.index === 12) {
        const g = String(data.cell.raw).charAt(0) as keyof typeof GRADE_COLORS;
        data.cell.styles.fillColor = hex(GRADE_COLORS[g] ?? '606060');
        data.cell.styles.textColor = [255, 255, 255];
        data.cell.styles.fontStyle = 'bold';
      }
      if (data.column.index === 2) data.cell.styles.textColor = BLUE;
    },
    didDrawCell: data => {
      if (data.section !== 'body') return;
      const row = rows[data.row.index];
      if (!row) return;
      if (thumbs && data.column.index === 1) {
        const img = thumbs.get(row.id);
        if (img) doc.addImage(img.dataUrl, 'JPEG', data.cell.x + 1, data.cell.y + (data.cell.height - 11.25) / 2, 20, 11.25);
      }
      if (data.column.index === 2) doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: row.url });
    },
  });

  // ---------- Metodologi ----------
  doc.addPage('a4', 'portrait');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...INK);
  doc.text('Metodologi & definisi', M, 22);
  autoTable(doc, {
    startY: 27,
    margin: { left: M, right: M, bottom: 16 },
    body: METHODOLOGY.map(([k, v]) => [pdfText(k), pdfText(v)]),
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 2.5, textColor: INK, lineColor: LINE, lineWidth: { bottom: 0.2 } },
    columnStyles: { 0: { cellWidth: 42, fontStyle: 'bold' } },
  });
  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 120;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text(
    doc.splitTextToSize('Sumber: statistik publik YouTube Data API v3. CTR, durasi tonton, dan retensi hanya tersedia di YouTube Studio milik kreator.', pageW() - 2 * M),
    M,
    finalY + 8
  );

  // ---------- Header/footer semua halaman ----------
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    const w = pageW();
    const h = pageH();
    if (i > 1) {
      doc.setFillColor(...RED);
      doc.rect(0, 0, w, 2.5, 'F');
    }
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.line(M, h - 11, w - M, h - 11);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(pdfText(`${APP_NAME}  |  ${title}`), M, h - 6.5);
    doc.text(`Halaman ${i} dari ${total}`, w - M, h - 6.5, { align: 'right' });
  }

  return doc.output('blob');
};
