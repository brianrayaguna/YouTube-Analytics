import React, { useEffect, useState } from 'react';
import {
  Download,
  ClipboardPaste,
  ExternalLink,
  Info,
  HardDrive,
  Globe,
  FolderOpen,
  RefreshCw,
  X,
  Trash2,
  Film,
  Music,
  CheckCircle2,
  CircleAlert,
  Loader2,
  Copy,
  FileCode2,
} from 'lucide-react';
import serverSource from '../../local-downloader/server.mjs?raw';
import { ShowToast } from '../types';
import { DOWNLOADER_SERVICES, openDownloader, normalizeVideoUrl, isYouTubeUrl, extractYouTubeVideoId } from '../constants/downloaders';
import { PageHeader, SectionCard, StudioTabs } from './common';
import { Switch } from './ui/switch';
import { useLocalDownloader } from '../hooks/useLocalDownloader';
import {
  startLocalDownload,
  getLocalVideoInfo,
  cancelOrRemoveLocalJob,
  openLocalFolder,
  getLocalDownloaderUrl,
  setLocalDownloaderUrl,
  isJobActive,
  formatBytes,
  formatEta,
  codecLabel,
  isServerOutdated,
  MIN_SERVER_VERSION,
  DEFAULT_LOCAL_URL,
  LocalFormat,
  LocalQuality,
  LocalJob,
  LocalVideoInfo,
} from '../services/localDownloader';
import { copyToClipboard, downloadBlob } from '../services/exportService';
import { formatDuration } from '../lib/format';
import { cn } from '@/lib/utils';

interface DownloaderPageProps {
  onToast: ShowToast;
}

type Tab = 'local' | 'online';

const QUALITY_OPTIONS: Array<{ value: LocalQuality; label: string }> = [
  { value: 'best', label: 'Terbaik (H.264, s.d. 1080p)' },
  { value: '2160', label: '4K 2160p (dikonversi, lama)' },
  { value: '1440', label: '1440p (dikonversi, lama)' },
  { value: '1080', label: '1080p' },
  { value: '720', label: '720p' },
  { value: '480', label: '480p' },
  { value: '360', label: '360p' },
];

const SERVER_FILENAME = 'yt-analyzer-downloader.mjs';

const INSTALL_STEPS: Array<{ os: string; cmd: string }> = [
  { os: 'Windows', cmd: 'winget install yt-dlp.yt-dlp Gyan.FFmpeg OpenJS.NodeJS.LTS' },
  { os: 'macOS', cmd: 'brew install yt-dlp ffmpeg node' },
  { os: 'Linux', cmd: 'sudo apt install ffmpeg nodejs && pipx install yt-dlp' },
];

const STATUS_LABEL: Record<LocalJob['status'], string> = {
  queued: 'Dalam antrean',
  downloading: 'Mengunduh',
  processing: 'Memproses',
  converting: 'Mengonversi ke H.264',
  done: 'Selesai',
  error: 'Gagal',
  canceled: 'Dibatalkan',
};

const UrlInput: React.FC<{ value: string; onChange: (v: string) => void; onToast: ShowToast }> = ({ value, onChange, onToast }) => (
  <div className="flex h-12 flex-1 items-center rounded-full border border-input bg-background pl-5 pr-1 focus-within:border-primary">
    <input
      type="url"
      inputMode="url"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder="https://www.youtube.com/watch?v=…"
      className="h-full min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
      aria-label="URL video"
    />
    <button
      type="button"
      onClick={async () => {
        try {
          onChange((await navigator.clipboard.readText()).trim());
        } catch {
          onToast('Izin papan klip ditolak — tempel manual dengan Ctrl+V', 'error');
        }
      }}
      className="yt-pill h-10 bg-transparent"
      title="Tempel dari papan klip"
    >
      <ClipboardPaste className="h-5 w-5" strokeWidth={1.75} /> <span className="hidden sm:inline">Tempel</span>
    </button>
  </div>
);

const CodeLine: React.FC<{ label?: string; cmd: string; onToast: ShowToast }> = ({ label, cmd, onToast }) => (
  <div className="flex items-center gap-2 rounded-lg bg-secondary py-1 pl-3 pr-1">
    {label && <span className="w-16 shrink-0 text-xs text-muted-foreground">{label}</span>}
    <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-xs text-foreground no-scrollbar">{cmd}</code>
    <button
      type="button"
      className="yt-icon-btn h-8 w-8"
      aria-label="Salin perintah"
      title="Salin"
      onClick={async () => {
        try {
          await copyToClipboard(cmd);
          onToast('Perintah disalin', 'success');
        } catch {
          onToast('Gagal menyalin', 'error');
        }
      }}
    >
      <Copy className="h-4 w-4" />
    </button>
  </div>
);

const JobRow: React.FC<{ job: LocalJob; onChanged: () => void; onToast: ShowToast }> = ({ job, onChanged, onToast }) => {
  const active = isJobActive(job);
  const pct = job.status === 'done' ? 100 : job.percent ?? 0;
  const detail = [
    job.status === 'downloading' && job.part && job.part > 1 ? `stream ${job.part}` : '',
    job.status === 'downloading' && job.speed ? `${formatBytes(job.speed)}/s` : '',
    job.status === 'downloading' && job.eta ? `sisa ${formatEta(job.eta)}` : '',
    job.status === 'done' && job.size ? formatBytes(job.size) : '',
  ]
    .filter(Boolean)
    .join(' • ');

  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      onChanged();
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Gagal', 'error');
    }
  };

  return (
    <li className="flex items-center gap-3 py-3">
      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
          job.status === 'done' ? 'bg-success/15 text-success' : job.status === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-secondary'
        )}
      >
        {job.status === 'done' ? (
          <CheckCircle2 className="h-5 w-5" />
        ) : job.status === 'error' ? (
          <CircleAlert className="h-5 w-5" />
        ) : active ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : job.format === 'mp3' ? (
          <Music className="h-5 w-5" />
        ) : (
          <Film className="h-5 w-5" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground" title={job.filename || job.title || job.url}>
          {job.filename || job.title || job.url}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <span className="rounded-sm bg-secondary px-1.5 py-px text-[11px] font-medium uppercase text-muted-foreground">
            {job.format}
            {job.format === 'mp4' && job.quality !== 'best' ? ` ${job.quality}p` : ''}
          </span>
          {job.status === 'done' && codecLabel(job) && (
            <span
              className="rounded-sm bg-success/15 px-1.5 py-px text-[11px] font-medium text-success"
              title={job.conversion ? 'Dikonversi otomatis agar bisa diputar di semua pemutar' : 'Codec yang kompatibel dengan semua pemutar'}
            >
              {codecLabel(job)}
              {job.conversion ? ' • dikonversi' : ''}
            </span>
          )}
          <span
            className={cn('min-w-0 text-xs', job.status === 'error' ? 'line-clamp-2 text-destructive' : 'text-muted-foreground')}
            title={job.error ?? undefined}
          >
            {job.status === 'error' ? job.error : STATUS_LABEL[job.status]}
            {(job.status === 'downloading' || job.status === 'converting') && job.percent !== null ? ` ${Math.round(pct)}%` : ''}
            {detail && ` • ${detail}`}
          </span>
        </div>
        {active && (
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary">
            <div
              className={cn(
                'h-full rounded-full transition-[width] duration-500',
                job.status === 'converting' ? 'bg-primary' : 'bg-youtube-red',
                job.status !== 'downloading' && job.status !== 'converting' && 'animate-pulse'
              )}
              style={{ width: `${job.status === 'downloading' || job.status === 'converting' ? pct : 100}%` }}
            />
          </div>
        )}
      </div>
      {job.status === 'done' && (
        <button type="button" className="yt-icon-btn" title="Tampilkan di folder" aria-label="Tampilkan di folder" onClick={() => act(() => openLocalFolder(job.id))}>
          <FolderOpen className="h-5 w-5" strokeWidth={1.75} />
        </button>
      )}
      <button
        type="button"
        className="yt-icon-btn"
        title={active ? 'Batalkan' : 'Hapus dari daftar'}
        aria-label={active ? 'Batalkan' : 'Hapus dari daftar'}
        onClick={() => act(() => cancelOrRemoveLocalJob(job.id))}
      >
        {active ? <X className="h-5 w-5" strokeWidth={1.75} /> : <Trash2 className="h-5 w-5" strokeWidth={1.75} />}
      </button>
    </li>
  );
};

const LocalTab: React.FC<{ onToast: ShowToast }> = ({ onToast }) => {
  const { health, checking, refresh, jobs, refreshJobs, enabled, setEnabled } = useLocalDownloader({ pollJobs: true });
  const [videoUrl, setVideoUrl] = useState('');
  const [format, setFormat] = useState<LocalFormat>('mp4');
  const [quality, setQuality] = useState<LocalQuality>('best');
  const [info, setInfo] = useState<LocalVideoInfo | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverUrl, setServerUrl] = useState(getLocalDownloaderUrl);

  const url = normalizeVideoUrl(videoUrl);
  const connected = !!health;
  const ready = !!health?.ytdlp;
  const hasFfmpeg = !!health?.ffmpeg;

  // Ambil info video (judul, resolusi tersedia) setelah URL berhenti diketik
  useEffect(() => {
    setInfo(null);
    if (!ready || !url) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setInfoLoading(true);
      try {
        const i = await getLocalVideoInfo(url);
        if (!cancelled) setInfo(i);
      } catch {
        // info opsional — unduhan tetap bisa dicoba
      } finally {
        if (!cancelled) setInfoLoading(false);
      }
    }, 700);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [url, ready]);

  const submit = async () => {
    if (!url) {
      onToast('Tempel URL video terlebih dahulu', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await startLocalDownload(url, format, quality);
      onToast('Unduhan dimulai di perangkat ini', 'success');
      setVideoUrl('');
      refreshJobs();
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Gagal memulai unduhan', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const availableQualities = QUALITY_OPTIONS.filter(
    q => q.value === 'best' || !info?.heights.length || info.heights.some(h => h >= Number(q.value) * 0.9)
  );

  return (
    <div className="space-y-6">
      {/* Status mesin */}
      <div className={cn('yt-card flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5', ready && 'border-success/40')}>
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <span
            className={cn(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-full',
              ready ? 'bg-success/15 text-success' : connected ? 'bg-warning/15 text-warning' : 'bg-secondary text-muted-foreground'
            )}
          >
            {checking && !connected ? <Loader2 className="h-6 w-6 animate-spin" /> : <HardDrive className="h-6 w-6" strokeWidth={1.75} />}
          </span>
          <div className="min-w-0">
            <p className="font-medium text-foreground">
              {ready ? 'Mesin lokal terhubung' : connected ? 'Server terhubung, yt-dlp belum terpasang' : checking ? 'Mencari mesin lokal…' : 'Mesin lokal belum terhubung'}
            </p>
            {connected ? (
              <p className="mt-0.5 text-sm text-muted-foreground">
                yt-dlp {health.ytdlp ?? '✖'} • ffmpeg {hasFfmpeg ? '✓' : '✖ (MP3, >720p & konversi H.264 tidak tersedia)'} • server v{health.version}
                <span className="block truncate" title={health.downloadDir}>
                  Folder: {health.downloadDir}
                </span>
              </p>
            ) : (
              <p className="mt-0.5 text-sm text-muted-foreground">
                Video diunduh langsung oleh yt-dlp di komputer Anda — tanpa situs pihak ketiga. Ikuti langkah di bawah sekali saja.
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {connected && (
            <button type="button" className="yt-pill" onClick={() => openLocalFolder().catch(e => onToast(e.message, 'error'))}>
              <FolderOpen className="h-5 w-5" strokeWidth={1.75} /> Buka folder
            </button>
          )}
          <button type="button" className="yt-pill" onClick={() => refresh(true)} disabled={checking}>
            <RefreshCw className={cn('h-4 w-4', checking && 'animate-spin')} /> Cek ulang
          </button>
        </div>
      </div>

      {connected && isServerOutdated(health.version) && (
        <div className="flex flex-col gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 sm:flex-row sm:items-center">
          <CircleAlert className="h-5 w-5 shrink-0 text-warning" />
          <p className="flex-1 text-sm text-foreground">
            Server lokal Anda versi lama ({health.version ?? '?'}). Versi itu bisa menyimpan MP4 ber-codec AV1/VP9 yang{' '}
            <b className="font-medium">tidak bisa dibuka</b> di banyak pemutar. Unduh server v{MIN_SERVER_VERSION}, hentikan server lama (Ctrl+C), lalu jalankan
            yang baru.
          </p>
          <button
            type="button"
            className="yt-pill-primary shrink-0"
            onClick={() => downloadBlob(new Blob([serverSource], { type: 'text/javascript' }), SERVER_FILENAME)}
          >
            <FileCode2 className="h-4 w-4" /> Unduh server terbaru
          </button>
        </div>
      )}

      {ready && (
        <>
          <div className="yt-card p-4 sm:p-6">
            <form
              className="flex flex-col gap-3"
              onSubmit={e => {
                e.preventDefault();
                submit();
              }}
            >
              <UrlInput value={videoUrl} onChange={setVideoUrl} onToast={onToast} />

              {(info || infoLoading) && (
                <div className="flex items-center gap-3 rounded-xl bg-secondary p-3">
                  {info?.thumbnail ? (
                    <img src={info.thumbnail} alt="" referrerPolicy="no-referrer" className="aspect-video w-28 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <div className="flex aspect-video w-28 shrink-0 items-center justify-center rounded-lg bg-background">
                      {infoLoading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : <Film className="h-5 w-5 text-muted-foreground" />}
                    </div>
                  )}
                  <div className="min-w-0 text-sm">
                    {info ? (
                      <>
                        <p className="line-clamp-2 font-medium text-foreground">{info.title}</p>
                        <p className="text-muted-foreground">
                          {[info.channel, info.duration ? formatDuration(info.duration) : '', info.heights[0] ? `maks ${info.heights[0]}p` : '']
                            .filter(Boolean)
                            .join(' • ')}
                        </p>
                      </>
                    ) : (
                      <p className="text-muted-foreground">Membaca info video…</p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="yt-chip" data-active={format === 'mp4'} onClick={() => setFormat('mp4')}>
                  <Film className="h-4 w-4" /> Video MP4
                </button>
                <button
                  type="button"
                  className="yt-chip"
                  data-active={format === 'mp3'}
                  onClick={() => setFormat('mp3')}
                  title={hasFfmpeg ? undefined : 'Tanpa ffmpeg audio disimpan dalam format aslinya (m4a/webm)'}
                >
                  <Music className="h-4 w-4" /> Audio {hasFfmpeg ? 'MP3' : 'M4A'}
                </button>
                {format === 'mp4' && (
                  <select
                    value={quality}
                    onChange={e => setQuality(e.target.value as LocalQuality)}
                    className="h-8 rounded-lg border border-border bg-background px-2 text-sm font-medium text-foreground outline-none"
                    aria-label="Kualitas video"
                  >
                    {availableQualities.map(q => (
                      <option key={q.value} value={q.value}>
                        {q.label}
                      </option>
                    ))}
                  </select>
                )}
                <button type="submit" disabled={!url || submitting} className="yt-pill-primary ml-auto h-10 px-5">
                  {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />} Unduh ke perangkat
                </button>
              </div>
              {!hasFfmpeg && format === 'mp4' && (
                <p className="text-xs text-muted-foreground">Tanpa ffmpeg, YouTube umumnya hanya menyediakan file gabungan hingga 360p–720p.</p>
              )}
            </form>

            <label className="mt-5 flex cursor-pointer items-center justify-between gap-4 border-t border-border pt-4">
              <span className="text-sm">
                <span className="font-medium text-foreground">Pakai mesin lokal untuk tombol “Unduh video”</span>
                <span className="block text-muted-foreground">Menu ⋮ di kartu video & tombol Unduh di pratinjau langsung menyimpan ke perangkat.</span>
              </span>
              <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Pakai mesin lokal" />
            </label>
          </div>

          <SectionCard
            title="Unduhan"
            description={jobs.length ? `${jobs.filter(isJobActive).length} berjalan • ${jobs.length} total` : 'Belum ada unduhan di sesi server ini'}
          >
            {jobs.length > 0 && (
              <ul className="-my-3 divide-y divide-border">
                {jobs.map(job => (
                  <JobRow key={job.id} job={job} onChanged={refreshJobs} onToast={onToast} />
                ))}
              </ul>
            )}
          </SectionCard>
        </>
      )}

      {!ready && (
        <SectionCard title="Pasang mesin lokal (sekali saja)" description="Butuh Node.js 18+ dan yt-dlp. ffmpeg disarankan untuk MP3 & resolusi tinggi.">
          <ol className="space-y-5 text-sm">
            <li>
              <p className="font-medium text-foreground">1. Pasang yt-dlp, ffmpeg, dan Node.js</p>
              <div className="mt-2 space-y-2">
                {INSTALL_STEPS.map(s => (
                  <CodeLine key={s.os} label={s.os} cmd={s.cmd} onToast={onToast} />
                ))}
              </div>
            </li>
            <li>
              <p className="font-medium text-foreground">2. Unduh server penghubung</p>
              <p className="mt-1 text-muted-foreground">Satu file kecil tanpa dependensi. Atau, dari folder repo ini jalankan <code className="font-mono">npm run downloader</code>.</p>
              <button
                type="button"
                className="yt-pill mt-2"
                onClick={() => downloadBlob(new Blob([serverSource], { type: 'text/javascript' }), SERVER_FILENAME)}
              >
                <FileCode2 className="h-5 w-5" strokeWidth={1.75} /> Unduh {SERVER_FILENAME}
              </button>
            </li>
            <li>
              <p className="font-medium text-foreground">3. Jalankan, lalu biarkan jendela terminal terbuka</p>
              <div className="mt-2">
                <CodeLine cmd={`node ${SERVER_FILENAME}`} onToast={onToast} />
              </div>
              <p className="mt-2 text-muted-foreground">
                Halaman ini akan terhubung otomatis. Bila browser meminta izin <b className="font-medium text-foreground">akses jaringan lokal</b>, pilih Izinkan.
                Safari memblokir koneksi ini dari situs HTTPS — gunakan Chrome, Edge, atau Firefox.
              </p>
            </li>
          </ol>
        </SectionCard>
      )}

      <details className="yt-card group p-4 sm:px-6">
        <summary className="cursor-pointer select-none text-sm font-medium text-foreground">Pengaturan lanjutan</summary>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex-1 text-sm">
            <span className="text-muted-foreground">Alamat server lokal</span>
            <input value={serverUrl} onChange={e => setServerUrl(e.target.value)} className="yt-input mt-1 font-mono" placeholder={DEFAULT_LOCAL_URL} />
          </label>
          <button
            type="button"
            className="yt-pill"
            onClick={() => {
              setLocalDownloaderUrl(serverUrl || DEFAULT_LOCAL_URL);
              onToast('Alamat server disimpan', 'success');
            }}
          >
            Simpan
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Ubah bila server dijalankan dengan <code className="font-mono">PORT=…</code>. Folder tujuan diatur lewat <code className="font-mono">DOWNLOAD_DIR=…</code>.
        </p>
      </details>
    </div>
  );
};

const OnlineTab: React.FC<{ onToast: ShowToast }> = ({ onToast }) => {
  const [videoUrl, setVideoUrl] = useState('');
  const [selected, setSelected] = useState(DOWNLOADER_SERVICES[0].id);
  const url = normalizeVideoUrl(videoUrl);
  const ytId = extractYouTubeVideoId(videoUrl);
  const service = DOWNLOADER_SERVICES.find(s => s.id === selected) ?? DOWNLOADER_SERVICES[0];
  const unsupported = !!url && service.youtubeOnly && !isYouTubeUrl(url);

  return (
    <div className="yt-card p-4 sm:p-6">
      <form
        className="flex flex-col gap-3 sm:flex-row"
        onSubmit={e => {
          e.preventDefault();
          if (!url) onToast('Tempel URL video terlebih dahulu', 'error');
          else openDownloader(service, url);
        }}
      >
        <UrlInput value={videoUrl} onChange={setVideoUrl} onToast={onToast} />
        <button type="submit" disabled={!url} className="yt-pill-primary h-12 px-6 text-base">
          <ExternalLink className="h-5 w-5" /> Buka
        </button>
      </form>

      {ytId && (
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-secondary p-3">
          <img src={`https://i.ytimg.com/vi/${ytId}/mqdefault.jpg`} alt="" className="aspect-video w-28 shrink-0 rounded-lg object-cover" />
          <div className="min-w-0 text-sm">
            <p className="font-medium text-foreground">Video YouTube terdeteksi</p>
            <p className="truncate text-muted-foreground">{url}</p>
          </div>
        </div>
      )}

      <h2 className="mb-3 mt-6 text-sm font-medium text-foreground">Pilih layanan</h2>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {DOWNLOADER_SERVICES.map(s => (
          <div
            key={s.id}
            className={cn('flex items-center gap-1 rounded-xl border pr-2 transition-colors', selected === s.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-secondary')}
          >
            <button type="button" onClick={() => setSelected(s.id)} aria-pressed={selected === s.id} className="flex min-w-0 flex-1 items-center gap-3 p-3 text-left">
              <span
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                  selected === s.id ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'
                )}
              >
                {s.name.charAt(0)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 text-sm font-medium text-foreground">
                  {s.name}
                  {s.youtubeOnly && <span className="rounded-sm bg-secondary px-1.5 py-px text-[11px] text-muted-foreground">YouTube saja</span>}
                </span>
                <span className="block text-xs text-muted-foreground">{s.description}</span>
              </span>
            </button>
            <a href={s.homepage} target="_blank" rel="noopener noreferrer" className="yt-icon-btn h-8 w-8" aria-label={`Buka ${s.name}`} title={`Buka ${s.name}`}>
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        ))}
      </div>
      {unsupported && <p className="mt-3 text-sm text-warning">{service.name} hanya mendukung YouTube — halaman utamanya akan dibuka.</p>}
      <p className="mt-4 flex gap-2 text-xs leading-5 text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" /> Dibuka di tab baru melalui layanan pihak ketiga.
      </p>
    </div>
  );
};

const DownloaderPage: React.FC<DownloaderPageProps> = ({ onToast }) => {
  const [tab, setTab] = useState<Tab>('local');

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Video Downloader" subtitle="Unduh video & audio langsung ke perangkat ini memakai yt-dlp, atau lewat layanan online." />
      <StudioTabs<Tab>
        tabs={[
          { id: 'local', label: 'Perangkat ini' },
          { id: 'online', label: 'Layanan online' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'local' ? <LocalTab onToast={onToast} /> : <OnlineTab onToast={onToast} />}
      <p className="mt-6 flex gap-2 text-xs leading-5 text-muted-foreground">
        <Globe className="mt-0.5 h-4 w-4 shrink-0" />
        Unduh hanya untuk penggunaan pribadi dan hormati hak cipta kreator serta Ketentuan Layanan YouTube.
      </p>
    </div>
  );
};

export default DownloaderPage;
