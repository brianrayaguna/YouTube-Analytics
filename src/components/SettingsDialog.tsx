import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Loader2, ExternalLink, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { validateApiKey, clearAnalysisCache } from '../services/youtubeService';
import { ShowToast } from '../types';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apiKey: string;
  onSave: (key: string) => void;
  onToast: ShowToast;
}

const SHORTCUTS: Array<[string, string]> = [
  ['/', 'Fokus ke pencarian'],
  ['Ctrl K', 'Fokus ke pencarian'],
  ['D', 'Ganti tema terang/gelap'],
  ['Esc', 'Tutup dialog / menu'],
  ['← →', 'Video sebelumnya / berikutnya'],
  ['S', 'Simpan video di pratinjau'],
];

const SettingsDialog: React.FC<SettingsDialogProps> = ({ open, onOpenChange, apiKey, onSave, onToast }) => {
  const [draft, setDraft] = useState(apiKey);
  const [show, setShow] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(apiKey);
      setError(null);
      setShow(false);
    }
  }, [open, apiKey]);

  const handleSave = async () => {
    const key = draft.trim();
    if (!key) {
      setError('API Key tidak boleh kosong.');
      return;
    }
    setChecking(true);
    setError(null);
    try {
      await validateApiKey(key);
      onSave(key);
      onToast('API Key valid dan tersimpan', 'success');
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'API Key tidak valid.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto rounded-xl border-0 bg-popover p-0 sm:max-w-[480px] sm:rounded-xl">
        <DialogHeader className="px-6 pb-2 pt-6 text-left">
          <DialogTitle className="text-xl font-normal">Pengaturan</DialogTitle>
          <DialogDescription>Aplikasi memakai YouTube Data API v3 dengan API key milik Anda sendiri.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 px-6 py-4">
          <div>
            <label htmlFor="api-key" className="text-sm font-medium text-foreground">YouTube API Key</label>
            <div className="mt-2 flex items-center gap-2">
              <input
                id="api-key"
                type={show ? 'text' : 'password'}
                value={draft}
                autoComplete="off"
                spellCheck={false}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                className="yt-input font-mono"
                placeholder="AIza…"
              />
              <button
                type="button"
                onClick={() => setShow(s => !s)}
                className="yt-icon-btn"
                aria-label={show ? 'Sembunyikan' : 'Tampilkan'}
              >
                {show ? <EyeOff className="h-5 w-5" strokeWidth={1.75} /> : <Eye className="h-5 w-5" strokeWidth={1.75} />}
              </button>
            </div>
            {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
            <a
              href="https://console.cloud.google.com/apis/library/youtube.googleapis.com"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              Cara mendapatkan API key <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Key disimpan hanya di browser ini (localStorage). Kuota gratis: 10.000 unit/hari — pencarian kata kunci
              memakan 100 unit per 50 video, analisis channel/playlist hanya ±2 unit per 50 video.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-medium text-foreground">Data lokal</h3>
            <button
              type="button"
              onClick={() => {
                const n = clearAnalysisCache();
                onToast(n ? `${n} cache analisis dihapus` : 'Cache sudah kosong', 'success');
              }}
              className="yt-pill mt-2"
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.75} /> Hapus cache analisis
            </button>
          </div>

          <div>
            <h3 className="text-sm font-medium text-foreground">Pintasan keyboard</h3>
            <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {SHORTCUTS.map(([key, label]) => (
                <div key={key + label} className="flex items-center gap-3">
                  <dt>
                    <kbd className="inline-flex min-w-8 justify-center rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-xs">
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
            className="h-9 rounded-full px-4 text-sm font-medium text-foreground hover:bg-secondary"
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
  );
};

export default SettingsDialog;
