import React, { useEffect, useRef, useState } from 'react';
import { FileSpreadsheet, FileText, Globe, Braces, Sheet, Package, Loader2, Check, ImageIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Switch } from './ui/switch';
import { VideoItem, ShowToast } from '../types';
import type { ExportFormat, ExportContext } from '../services/export';
import { formatFullNumber } from '../lib/format';
import { cn } from '@/lib/utils';

export type ExportScope = 'filtered' | 'all' | 'selected';

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scopes: Partial<Record<ExportScope, VideoItem[]>>;
  defaultScope?: ExportScope;
  context: Omit<ExportContext, 'generatedAt' | 'scopeNote'>;
  /** Keterangan filter aktif untuk ditulis di laporan */
  filterNote?: string;
  onToast: ShowToast;
}

const FORMATS: Array<{ id: ExportFormat; label: string; ext: string; icon: typeof FileText; description: string; recommended?: boolean }> = [
  { id: 'xlsx', label: 'Excel', ext: '.xlsx', icon: FileSpreadsheet, description: 'Ringkasan, jadwal upload, tabel + thumbnail, tag', recommended: true },
  { id: 'pdf', label: 'PDF', ext: '.pdf', icon: FileText, description: 'Laporan siap cetak + jadwal upload' },
  { id: 'html', label: 'HTML', ext: '.html', icon: Globe, description: 'Laporan 1 file + peta panas jadwal' },
  { id: 'json', label: 'JSON', ext: '.json', icon: Braces, description: 'Data terstruktur, skor & jadwal' },
  { id: 'csv', label: 'CSV', ext: '.csv', icon: Sheet, description: 'Tabel video atau tabel jadwal upload' },
  { id: 'zip', label: 'Paket lengkap', ext: '.zip', icon: Package, description: 'Semua format + CSV jadwal + thumbnail HD' },
];

const SCOPE_LABEL: Record<ExportScope, string> = {
  filtered: 'Sesuai tampilan',
  all: 'Semua hasil',
  selected: 'Video terpilih',
};

const todayStamp = () => new Date().toISOString().slice(0, 10);

const ExportDialog: React.FC<ExportDialogProps> = ({ open, onOpenChange, scopes, defaultScope = 'filtered', context, filterNote, onToast }) => {
  const [format, setFormat] = useState<ExportFormat>('xlsx');
  const [scope, setScope] = useState<ExportScope>(defaultScope);
  const [withThumbs, setWithThumbs] = useState(true);
  const [zipSize, setZipSize] = useState<'maxres' | 'hq'>('maxres');
  const [csvKind, setCsvKind] = useState<'videos' | 'schedule'>('videos');
  const [fileName, setFileName] = useState('');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ label: string; percent: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) return;
    setScope(scopes[defaultScope]?.length ? defaultScope : 'filtered');
    setFileName(`${context.title.replace(/^Playlist: |^Hasil pencarian: /, '')}_${todayStamp()}`);
    setProgress(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset hanya saat dialog dibuka
  }, [open]);

  const videos = scopes[scope] ?? [];
  const info = FORMATS.find(f => f.id === format)!;
  const thumbsSupported = format !== 'csv';

  const scopeNote =
    scope === 'selected'
      ? `${videos.length} video terpilih`
      : scope === 'filtered' && filterNote
        ? `Filter: ${filterNote}`
        : undefined;

  const start = async () => {
    if (!videos.length) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setProgress({ label: 'Menyiapkan…', percent: 0 });
    try {
      const { runExport } = await import('../services/export');
      const res = await runExport({
        format,
        videos,
        context: { ...context, scopeNote, generatedAt: new Date() },
        fileName,
        includeThumbnails: thumbsSupported && withThumbs,
        zipThumbnailSize: zipSize,
        csvKind,
        signal: controller.signal,
        onProgress: (label, percent) => setProgress({ label, percent }),
      });
      onToast(`${info.label} diunduh: ${res.fileName}`, 'success');
      onOpenChange(false);
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') onToast('Ekspor dibatalkan', 'info');
      else onToast(e instanceof Error ? e.message : 'Gagal mengekspor', 'error');
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={o => {
        if (!o && running) abortRef.current?.abort();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-h-[92vh] gap-0 overflow-y-auto rounded-xl border border-border bg-popover p-0 sm:max-w-[640px] sm:rounded-xl">
        <DialogHeader className="px-6 pb-2 pt-6 text-left">
          <DialogTitle className="text-xl font-semibold">Ekspor data</DialogTitle>
          <DialogDescription>{context.title}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 px-6 py-4">
          <section>
            <h3 className="yt-label mb-2">Format</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {FORMATS.map(f => {
                const Icon = f.icon;
                const active = format === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    disabled={running}
                    onClick={() => setFormat(f.id)}
                    aria-pressed={active}
                    className={cn(
                      'relative flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors',
                      active ? 'border-primary bg-primary/5' : 'border-border hover:bg-secondary'
                    )}
                  >
                    <span className="flex w-full items-center gap-2">
                      <Icon className={cn('h-5 w-5', active ? 'text-primary' : 'text-foreground')} strokeWidth={1.75} aria-hidden="true" />
                      <span className="text-sm font-medium text-foreground">{f.label}</span>
                      <span className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground">
                        {f.ext}
                        {active && <Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" />}
                      </span>
                    </span>
                    <span className="text-xs leading-4 text-muted-foreground">{f.description}</span>
                    {f.recommended && <span className="mt-1 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">Disarankan</span>}
                  </button>
                );
              })}
            </div>
            {format === 'csv' && (
              <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Isi CSV">
                <span className="text-xs text-muted-foreground">Isi CSV:</span>
                <button type="button" className="yt-chip" aria-pressed={csvKind === 'videos'} data-active={csvKind === 'videos'} disabled={running} onClick={() => setCsvKind('videos')}>
                  Data video (+ hari & jam upload)
                </button>
                <button type="button" className="yt-chip" aria-pressed={csvKind === 'schedule'} data-active={csvKind === 'schedule'} disabled={running} onClick={() => setCsvKind('schedule')}>
                  Jadwal upload
                </button>
              </div>
            )}
          </section>

          <section>
            <h3 className="yt-label mb-2">Data</h3>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Cakupan data ekspor">
              {(['filtered', 'all', 'selected'] as ExportScope[])
                .filter(s => scopes[s] && (s !== 'selected' || scopes[s]!.length > 0))
                .map(s => (
                  <button
                    key={s}
                    type="button"
                    disabled={running}
                    className="yt-chip"
                    aria-pressed={scope === s}
                    data-active={scope === s}
                    onClick={() => setScope(s)}
                  >
                    {SCOPE_LABEL[s]} · {formatFullNumber(scopes[s]!.length)}
                  </button>
                ))}
            </div>
            {scope === 'filtered' && filterNote && <p className="mt-2 text-xs text-muted-foreground">Filter aktif: {filterNote}</p>}
          </section>

          <section>
            <label className={cn('flex items-center justify-between gap-4', !thumbsSupported && 'opacity-50')}>
              <span className="flex items-start gap-3">
                <ImageIcon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
                <span className="text-sm">
                  <span className="font-medium text-foreground">Sertakan thumbnail</span>
                  <span className="block text-xs text-muted-foreground">
                    {format === 'csv'
                      ? 'CSV hanya berisi URL thumbnail'
                      : format === 'json'
                        ? 'Gambar disisipkan sebagai base64 (file lebih besar)'
                        : format === 'zip'
                          ? 'Gambar di dalam laporan + folder thumbnails/ resolusi tinggi'
                          : 'Gambar thumbnail tampil langsung di dalam laporan'}
                    {videos.length > 1000 && thumbsSupported ? ' • tersemat untuk 1.000 video pertama' : ''}
                  </span>
                </span>
              </span>
              <Switch checked={thumbsSupported && withThumbs} onCheckedChange={setWithThumbs} disabled={!thumbsSupported || running} aria-label="Sertakan thumbnail" />
            </label>
            {format === 'zip' && withThumbs && (
              <div className="ml-8 mt-3 flex flex-wrap gap-2" role="group" aria-label="Resolusi thumbnail ZIP">
                <button type="button" className="yt-chip" aria-pressed={zipSize === 'maxres'} data-active={zipSize === 'maxres'} onClick={() => setZipSize('maxres')} disabled={running}>
                  HD 1280×720
                </button>
                <button type="button" className="yt-chip" aria-pressed={zipSize === 'hq'} data-active={zipSize === 'hq'} onClick={() => setZipSize('hq')} disabled={running}>
                  Sedang 480×360
                </button>
              </div>
            )}
          </section>

          <section>
            <label className="yt-label mb-2 block" htmlFor="export-name">
              Nama file
            </label>
            <div className="flex items-center rounded-lg border border-input bg-background pr-3 focus-within:border-primary">
              <input
                id="export-name"
                value={fileName}
                onChange={e => setFileName(e.target.value)}
                disabled={running}
                className="h-10 min-w-0 flex-1 bg-transparent px-3 text-sm text-foreground outline-none"
              />
              <span className="text-sm text-muted-foreground">{info.ext}</span>
            </div>
          </section>

          {progress && (
            <div aria-live="polite">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{progress.label}</span>
                <span className="tabular-nums">{progress.percent}%</span>
              </div>
              <div
                role="progressbar"
                aria-label={progress.label}
                aria-valuenow={progress.percent}
                aria-valuemin={0}
                aria-valuemax={100}
                className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary"
              >
                <div
                  className="h-full w-full origin-left rounded-full bg-primary transition-transform duration-300"
                  style={{ transform: `scaleX(${progress.percent / 100})` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 flex items-center justify-between gap-2 border-t border-border bg-popover px-4 py-3">
          <span className="pl-2 text-xs tabular-nums text-muted-foreground">{formatFullNumber(videos.length)} video</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => (running ? abortRef.current?.abort() : onOpenChange(false))}
              className="min-h-11 rounded-full px-4 text-sm font-medium text-foreground hover:bg-secondary sm:min-h-9"
            >
              {running ? 'Batalkan' : 'Tutup'}
            </button>
            <button type="button" onClick={start} disabled={running || !videos.length} className="yt-pill-blue min-w-[120px]">
              {running ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : `Ekspor ${info.label}`}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExportDialog;
