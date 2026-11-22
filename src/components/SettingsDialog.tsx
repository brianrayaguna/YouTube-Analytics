import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Loader2, ExternalLink, Trash2, Monitor, Sun, Moon, ChevronDown } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { validateApiKey, clearAnalysisCache, QUOTA_LIMIT } from '../services/youtubeService';
import { formatNumber } from '../lib/format';
import { ShowToast, ThemePreference } from '../types';
import { cn } from '@/lib/utils';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apiKey: string;
  onSave: (key: string) => void;
  onRemoveKey: () => void;
  themePref: ThemePreference;
  onThemePrefChange: (pref: ThemePreference) => void;
  quotaUsed: number;
  onToast: ShowToast;
}

const SHORTCUTS: Array<[string, string]> = [
  ['/', 'Fokus pada kolom pencarian'],
  ['Ctrl K', 'Fokus pada kolom pencarian'],
  ['D', 'Ubah tema terang/gelap'],
  ['Esc', 'Tutup dialog atau panel'],
  ['← →', 'Navigasi video pada pratinjau'],
  ['S', 'Simpan video pada pratinjau'],
];

const THEME_OPTIONS: Array<{ value: ThemePreference; label: string; icon: typeof Monitor }> = [
  { value: 'system', label: 'Sistem', icon: Monitor },
  { value: 'light', label: 'Terang', icon: Sun },
  { value: 'dark', label: 'Gelap', icon: Moon },
];

const SettingsDialog: React.FC<SettingsDialogProps> = ({
  open,
  onOpenChange,
  apiKey,
  onSave,
  onRemoveKey,
  themePref,
  onThemePrefChange,
  quotaUsed,
  onToast,
}) => {
  const [draft, setDraft] = useState(apiKey);
  const [show, setShow] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(apiKey);
      setError(null);
      setShow(false);
      setConfirmRemove(false);
    }
  }, [open, apiKey]);

  const handleSave = async () => {
    const key = draft.trim();
    if (!key) {
      setError('Kunci API tidak boleh kosong.');
      return;
    }
    setChecking(true);
    setError(null);
    try {
      await validateApiKey(key);
      onSave(key);
      onToast('Kunci API terverifikasi dan tersimpan', 'success');
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunci API tidak valid.');
    } finally {
      setChecking(false);
    }
  };

  const quotaPct = Math.min((quotaUsed / QUOTA_LIMIT) * 100, 100);
  const quotaBarColor = quotaPct >= 90 ? 'bg-destructive' : quotaPct >= 70 ? 'bg-warning' : 'bg-primary';

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto rounded-xl border border-border bg-popover p-0 sm:max-w-[500px] sm:rounded-xl">
          <DialogHeader className="px-6 pb-2 pt-6 text-left">
            <DialogTitle className="text-xl font-medium">Pengaturan</DialogTitle>
            <DialogDescription>Konfigurasi kunci API, tema antarmuka, kuota harian, dan penyimpanan cache lokal.</DialogDescription>
          </DialogHeader>

          <div className="space-y-6 px-6 py-4">
            {/* Kunci API */}
            <div>
              <label htmlFor="api-key" className="text-sm font-medium text-foreground">
                Kunci YouTube Data API v3
              </label>
              <div className="mt-2 flex items-center gap-2">
                <input
                  id="api-key"
                  type={show ? 'text' : 'password'}
                  value={draft}
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={!!error}
                  aria-describedby={error ? 'api-key-error api-key-help' : 'api-key-help'}
                  onChange={e => {
                    setDraft(e.target.value);
                    if (error) setError(null);
                  }}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                  className={cn('yt-input font-mono', error && 'border-destructive focus:border-destructive')}
                  placeholder="AIza…"
                />
                <button
                  type="button"
                  onClick={() => setShow(s => !s)}
                  className="yt-icon-btn"
                  aria-label={show ? 'Sembunyikan kunci API' : 'Tampilkan kunci API'}
                >
                  {show ? <EyeOff className="h-5 w-5" strokeWidth={1.75} /> : <Eye className="h-5 w-5" strokeWidth={1.75} />}
                </button>
              </div>
              {error && (
                <p id="api-key-error" role="alert" className="mt-2 text-sm text-destructive">
                  {error}
                </p>
              )}

              <details className="group mt-3 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
                <summary className="flex cursor-pointer list-none items-center justify-between font-medium text-foreground">
                  <span>Panduan memperoleh kunci API gratis (3 langkah)</span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <ol className="mt-2 list-decimal space-y-1 pl-4 leading-5">
                  <li>Buat proyek baru pada Google Cloud Console (tanpa biaya berlangganan).</li>
                  <li>
                    Aktifkan layanan{' '}
                    <a
                      href="https://console.cloud.google.com/apis/library/youtube.googleapis.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline"
                    >
                      YouTube Data API v3 <ExternalLink className="h-3 w-3" />
                    </a>
                    .
                  </li>
                  <li>Buka menu Credentials → Create Credentials → API Key, lalu masukkan nilai kunci pada kolom di atas.</li>
                </ol>
              </details>

              <p id="api-key-help" className="mt-2 text-xs leading-5 text-muted-foreground">
                Kunci hanya disimpan pada penyimpanan lokal browser (localStorage). Kuota gratis sebesar 10.000 unit/hari:
                analisis channel atau playlist memerlukan ±2 unit per 50 video, sedangkan pencarian kata kunci memerlukan 100 unit per 50 video.
              </p>
            </div>

            {/* Tampilan */}
            <div>
              <h3 className="text-sm font-medium text-foreground">Tema antarmuka</h3>
              <div className="mt-2 grid grid-cols-3 gap-2" role="group" aria-label="Pilih tema antarmuka">
                {THEME_OPTIONS.map(opt => {
                  const Icon = opt.icon;
                  const active = themePref === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => onThemePrefChange(opt.value)}
                      className={cn(
                        'flex min-h-11 items-center justify-center gap-2 rounded-lg border text-sm font-medium transition-colors sm:min-h-9',
                        active
                          ? 'border-foreground bg-foreground text-background'
                          : 'border-border bg-secondary/50 text-foreground hover:bg-secondary'
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Kuota & Data lokal */}
            <div className="space-y-3">
              <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-medium text-foreground">Kuota &amp; data lokal</h3>
                <span className="text-xs font-medium tabular-nums text-muted-foreground">
                  {formatNumber(quotaUsed)} / {formatNumber(QUOTA_LIMIT)} unit
                </span>
              </div>
              <div
                role="progressbar"
                aria-label="Pemakaian kuota API harian"
                aria-valuenow={quotaUsed}
                aria-valuemin={0}
                aria-valuemax={QUOTA_LIMIT}
                className="h-1.5 w-full overflow-hidden rounded-full bg-secondary"
              >
                <div
                  className={cn('h-full w-full origin-left rounded-full transition-transform duration-300', quotaBarColor)}
                  style={{ transform: `scaleX(${quotaPct / 100})` }}
                />
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const n = clearAnalysisCache();
                    onToast(n ? `${n} entri cache analisis dihapus` : 'Cache analisis dalam keadaan kosong', 'success');
                  }}
                  className="yt-pill"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={1.75} /> Hapus cache analisis
                </button>
                {apiKey && (
                  <button
                    type="button"
                    onClick={() => setConfirmRemove(true)}
                    className="yt-pill text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={1.75} /> Hapus Kunci API
                  </button>
                )}
              </div>
            </div>

            {/* Pintasan */}
            <div>
              <h3 className="text-sm font-medium text-foreground">Pintasan papan ketik</h3>
              <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                {SHORTCUTS.map(([key, label]) => (
                  <div key={key + label} className="flex items-center gap-3">
                    <dt className="shrink-0">
                      <kbd className="inline-flex min-w-8 justify-center whitespace-nowrap rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-xs">
                        {key}
                      </kbd>
                    </dt>
                    <dd className="text-muted-foreground">{label}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="min-h-11 rounded-full px-4 text-sm font-medium text-foreground hover:bg-secondary sm:min-h-9"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={checking}
              className="yt-pill-blue min-w-[96px]"
            >
              {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Simpan'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus kunci API dari browser ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Kunci API akan dihapus dari penyimpanan lokal browser. Mode data contoh tetap dapat digunakan, dan kunci API dapat dimasukkan kembali sewaktu-waktu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onRemoveKey();
                setDraft('');
                setConfirmRemove(false);
                onToast('Kunci API dihapus dari browser', 'info');
                onOpenChange(false);
              }}
            >
              Hapus Kunci
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default SettingsDialog;
