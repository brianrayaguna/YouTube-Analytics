// Orkestrator ekspor: satu pintu untuk semua format.

import { VideoItem } from '../../types';
import { buildReport, ExportContext, Report, APP_NAME, formatDateId } from './reportModel';
import { fetchEmbeddedThumbnails, fetchFullThumbnail, ThumbImage } from './thumbnails';
import { downloadBlob } from '../exportService';
import { safeFileName } from '../../lib/format';

export type ExportFormat = 'xlsx' | 'pdf' | 'json' | 'csv' | 'html' | 'zip';

export interface ExportOptions {
  format: ExportFormat;
  videos: VideoItem[];
  context: ExportContext;
  fileName: string;
  includeThumbnails: boolean;
  /** Ukuran thumbnail di folder paket ZIP */
  zipThumbnailSize?: 'maxres' | 'hq';
  onProgress?: (label: string, percent: number) => void;
  signal?: AbortSignal;
}

export const FORMAT_INFO: Record<ExportFormat, { label: string; ext: string; description: string; supportsThumbnails: boolean }> = {
  xlsx: { label: 'Excel', ext: 'xlsx', description: 'Ringkasan, tabel video dengan thumbnail, tag & metodologi', supportsThumbnails: true },
  pdf: { label: 'PDF', ext: 'pdf', description: 'Laporan siap cetak: KPI, 10 teratas, daftar lengkap', supportsThumbnails: true },
  html: { label: 'HTML', ext: 'html', description: 'Laporan satu file, dibuka di browser, Unicode penuh', supportsThumbnails: true },
  json: { label: 'JSON', ext: 'json', description: 'Data terstruktur + skor rinci untuk developer/integrasi', supportsThumbnails: true },
  csv: { label: 'CSV', ext: 'csv', description: 'Tabel universal untuk Sheets, Excel, BI', supportsThumbnails: false },
  zip: { label: 'Paket lengkap', ext: 'zip', description: 'Excel + PDF + HTML + JSON + CSV + folder thumbnail HD', supportsThumbnails: true },
};

/** Batas thumbnail tersemat agar file tetap ringan. */
export const MAX_EMBEDDED_THUMBNAILS = 1000;

const loadAvatar = async (report: Report): Promise<ThumbImage | undefined> => {
  const url = report.context.channelStats?.avatar;
  if (!url) return undefined;
  try {
    const map = await fetchEmbeddedThumbnails([{ id: '__avatar', thumbnail: url }], { width: 240 });
    return map.get('__avatar');
  } catch {
    return undefined;
  }
};

const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new DOMException('Ekspor dibatalkan', 'AbortError');
};

export const runExport = async (opts: ExportOptions): Promise<{ fileName: string; size: number; thumbnailsEmbedded: number }> => {
  const { format, videos, context, includeThumbnails, onProgress, signal } = opts;
  if (!videos.length) throw new Error('Tidak ada video untuk diekspor');
  const progress = (label: string, pct: number) => onProgress?.(label, Math.max(0, Math.min(100, Math.round(pct))));

  progress('Menghitung skor & ringkasan…', 3);
  const report = buildReport(videos, context);
  throwIfAborted(signal);

  const wantsThumbs = includeThumbnails && FORMAT_INFO[format].supportsThumbnails;
  let thumbs: Map<string, ThumbImage> | null = null;
  if (wantsThumbs) {
    const subset = report.rows.slice(0, MAX_EMBEDDED_THUMBNAILS).map(r => ({ id: r.id, thumbnail: r.scored.thumbnail }));
    thumbs = await fetchEmbeddedThumbnails(subset, {
      width: format === 'pdf' ? 240 : 320,
      signal,
      onProgress: (d, t) => progress(`Mengambil thumbnail ${d}/${t}…`, 5 + (d / t) * (format === 'zip' ? 35 : 70)),
    });
  }
  throwIfAborted(signal);
  const avatar = format === 'csv' || format === 'json' ? undefined : await loadAvatar(report);

  const base = safeFileName(opts.fileName || `${context.title}_${context.generatedAt.toISOString().slice(0, 10)}`);
  let blob: Blob;

  const build = async (f: Exclude<ExportFormat, 'zip'>): Promise<Blob> => {
    switch (f) {
      case 'xlsx':
        return (await import('./excel')).buildExcel(report, thumbs, avatar);
      case 'pdf':
        return (await import('./pdf')).buildPdf(report, thumbs, avatar);
      case 'html':
        return (await import('./html')).buildHtml(report, thumbs, avatar);
      case 'json':
        return (await import('./dataFormats')).buildJson(report, thumbs);
      case 'csv':
        return (await import('./dataFormats')).buildCsv(report);
    }
  };

  if (format !== 'zip') {
    progress(`Menyusun ${FORMAT_INFO[format].label}…`, 85);
    blob = await build(format);
  } else {
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    const steps: Array<Exclude<ExportFormat, 'zip'>> = ['xlsx', 'pdf', 'html', 'json', 'csv'];
    for (let i = 0; i < steps.length; i++) {
      throwIfAborted(signal);
      progress(`Menyusun ${FORMAT_INFO[steps[i]].label}…`, 42 + i * 6);
      // JSON di paket tidak menyematkan base64 (gambar sudah ada di folder thumbnails/)
      const b = steps[i] === 'json' ? (await import('./dataFormats')).buildJson(report, null) : await build(steps[i]);
      zip.file(`${base}.${FORMAT_INFO[steps[i]].ext}`, b);
    }
    if (includeThumbnails) {
      const folder = zip.folder('thumbnails')!;
      let done = 0;
      let cursor = 0;
      const worker = async () => {
        while (cursor < report.rows.length) {
          throwIfAborted(signal);
          const r = report.rows[cursor++];
          const img = await fetchFullThumbnail(r.id, r.scored.thumbnail, opts.zipThumbnailSize ?? 'maxres', signal);
          if (img) folder.file(`${String(r.no).padStart(4, '0')} - ${safeFileName(r.title, 80)} [${r.id}].jpg`, img);
          done++;
          progress(`Thumbnail HD ${done}/${report.rows.length}…`, 72 + (done / report.rows.length) * 20);
        }
      };
      await Promise.all(Array.from({ length: Math.min(6, report.rows.length) }, worker));
    }
    zip.file(
      'BACA-SAYA.txt',
      [
        `${APP_NAME} — ${context.title}`,
        `Dibuat: ${formatDateId(context.generatedAt, true)} • ${report.summary.totalVideos} video`,
        '',
        `${base}.xlsx  → laporan Excel (ringkasan, video + thumbnail, tag, metodologi)`,
        `${base}.pdf   → laporan siap cetak`,
        `${base}.html  → laporan interaktif (buka di browser)`,
        `${base}.json  → data terstruktur lengkap dengan skor rinci`,
        `${base}.csv   → tabel universal`,
        includeThumbnails ? 'thumbnails/    → thumbnail resolusi tinggi, diberi nomor sesuai kolom "No"' : '',
      ].join('\r\n')
    );
    progress('Mengompres paket ZIP…', 94);
    blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  }

  throwIfAborted(signal);
  const fileName = `${base}.${FORMAT_INFO[format].ext}`;
  downloadBlob(blob, fileName);
  progress('Selesai', 100);
  return { fileName, size: blob.size, thumbnailsEmbedded: thumbs?.size ?? 0 };
};

export type { ExportContext } from './reportModel';
