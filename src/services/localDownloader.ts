// Klien untuk "Local Downloader" (local-downloader/server.mjs) — server kecil
// di perangkat pengguna yang menjalankan yt-dlp + ffmpeg.

export type LocalFormat = 'mp4' | 'mp3';
export type LocalQuality = 'best' | '2160' | '1440' | '1080' | '720' | '480' | '360';
export type LocalJobStatus = 'queued' | 'downloading' | 'processing' | 'converting' | 'done' | 'error' | 'canceled';

/** Versi server minimum: v1.1.0 memastikan MP4 ber-codec H.264/AAC (bisa diputar di semua pemutar). */
export const MIN_SERVER_VERSION = '1.1.0';

export const isServerOutdated = (version?: string | null) => {
  if (!version) return true;
  const a = version.split('.').map(Number);
  const b = MIN_SERVER_VERSION.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) < (b[i] || 0);
  }
  return false;
};

export interface LocalHealth {
  ok: boolean;
  version: string;
  ytdlp: string | null;
  ffmpeg: string | null;
  ffprobe?: boolean;
  downloadDir: string;
  platform: string;
  active: number;
  queued: number;
}

export interface LocalJob {
  id: string;
  url: string;
  format: LocalFormat;
  quality: LocalQuality;
  status: LocalJobStatus;
  percent: number | null;
  part?: number;
  downloaded?: number | null;
  total?: number | null;
  speed?: number | null;
  eta?: number | null;
  title: string | null;
  filename: string | null;
  filepath: string | null;
  size?: number;
  error: string | null;
  videoCodec?: string | null;
  audioCodec?: string | null;
  /** Konversi yang dilakukan agar bisa diputar: 'audio' (audio saja) atau 'full' (video ke H.264) */
  conversion?: 'audio' | 'full' | null;
  createdAt: number;
}

export interface LocalVideoInfo {
  id: string;
  title: string;
  channel: string;
  duration: number | null;
  thumbnail: string | null;
  extractor: string;
  heights: number[];
}

const URL_KEY = 'yt_local_dl_url';
const ENABLED_KEY = 'yt_local_dl_enabled';
export const DEFAULT_LOCAL_URL = 'http://127.0.0.1:17890';
const EVENT = 'localDownloaderChanged';

export const getLocalDownloaderUrl = (): string => {
  try {
    return (localStorage.getItem(URL_KEY) || DEFAULT_LOCAL_URL).replace(/\/+$/, '');
  } catch {
    return DEFAULT_LOCAL_URL;
  }
};

export const setLocalDownloaderUrl = (url: string) => {
  try {
    const clean = url.trim().replace(/\/+$/, '');
    if (!clean || clean === DEFAULT_LOCAL_URL) localStorage.removeItem(URL_KEY);
    else localStorage.setItem(URL_KEY, clean);
  } catch {
    // abaikan
  }
  cachedHealth = null;
  window.dispatchEvent(new Event(EVENT));
};

/** Pakai mesin lokal untuk tombol "Unduh video" di kartu & pratinjau. */
export const isLocalDownloaderEnabled = (): boolean => {
  try {
    return localStorage.getItem(ENABLED_KEY) === '1';
  } catch {
    return false;
  }
};

export const setLocalDownloaderEnabled = (enabled: boolean) => {
  try {
    // '0' = dimatikan pengguna (tidak diaktifkan ulang otomatis)
    localStorage.setItem(ENABLED_KEY, enabled ? '1' : '0');
  } catch {
    // abaikan
  }
  window.dispatchEvent(new Event(EVENT));
};

export const hasLocalDownloaderPreference = (): boolean => {
  try {
    return localStorage.getItem(ENABLED_KEY) !== null;
  } catch {
    return true;
  }
};

export const subscribeLocalDownloader = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
};

export class LocalDownloaderError extends Error {}

const request = async <T>(path: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), init?.timeoutMs ?? 8000);
  let res: Response;
  try {
    res = await fetch(`${getLocalDownloaderUrl()}${path}`, {
      ...init,
      signal: controller.signal,
      headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    });
  } catch {
    throw new LocalDownloaderError('Local Downloader tidak terhubung. Jalankan "npm run downloader" di perangkat ini.');
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new LocalDownloaderError(data?.error || `Local Downloader error (HTTP ${res.status})`);
  return data as T;
};

let cachedHealth: { at: number; value: LocalHealth | null } | null = null;

/** Cek status mesin lokal. Hasil di-cache 15 detik kecuali `force`. */
export const checkLocalDownloader = async (force = false): Promise<LocalHealth | null> => {
  if (!force && cachedHealth && Date.now() - cachedHealth.at < 15000) return cachedHealth.value;
  let value: LocalHealth | null = null;
  try {
    const h = await request<LocalHealth & { app?: string }>(`/health${force ? '?refresh=1' : ''}`, { timeoutMs: 2500 });
    value = h?.app === 'yt-analyzer-local-downloader' ? h : null;
  } catch {
    value = null;
  }
  cachedHealth = { at: Date.now(), value };
  return value;
};

export const isLocalEngineReady = (h: LocalHealth | null): h is LocalHealth => !!h?.ytdlp;

export const getLocalVideoInfo = (url: string) =>
  request<LocalVideoInfo>('/info', { method: 'POST', body: JSON.stringify({ url }), timeoutMs: 65000 });

export const startLocalDownload = (url: string, format: LocalFormat = 'mp4', quality: LocalQuality = 'best') =>
  request<LocalJob>('/download', { method: 'POST', body: JSON.stringify({ url, format, quality }) });

export const listLocalJobs = () => request<{ jobs: LocalJob[] }>('/jobs').then(r => r.jobs);

export const getLocalJob = (id: string) => request<LocalJob>(`/jobs/${encodeURIComponent(id)}`);

export const cancelOrRemoveLocalJob = (id: string) =>
  request<{ ok: boolean }>(`/jobs/${encodeURIComponent(id)}`, { method: 'DELETE' });

export const openLocalFolder = (jobId?: string) =>
  request<{ ok: boolean }>('/open-folder', { method: 'POST', body: JSON.stringify(jobId ? { jobId } : {}) });

export const isJobActive = (j: LocalJob) => ['queued', 'downloading', 'processing', 'converting'].includes(j.status);

const CODEC_LABEL: Record<string, string> = { h264: 'H.264', hevc: 'HEVC', vp9: 'VP9', av1: 'AV1', aac: 'AAC', opus: 'Opus', mp3: 'MP3' };
export const codecLabel = (j: Pick<LocalJob, 'videoCodec' | 'audioCodec'>) =>
  [j.videoCodec, j.audioCodec].filter(Boolean).map(c => CODEC_LABEL[c as string] ?? String(c).toUpperCase()).join(' + ');

/** Pantau job sampai selesai (dipakai tombol unduh cepat di kartu video). */
export const waitForLocalJob = async (id: string, onUpdate?: (job: LocalJob) => void): Promise<LocalJob> => {
  for (;;) {
    const job = await getLocalJob(id);
    onUpdate?.(job);
    if (!isJobActive(job)) return job;
    await new Promise(r => setTimeout(r, 1000));
  }
};

export const formatBytes = (n?: number | null): string => {
  if (!n || n <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
};

export const formatEta = (s?: number | null): string => {
  if (s === null || s === undefined || !Number.isFinite(s)) return '';
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return m ? `${m} mnt ${sec} dtk` : `${sec} dtk`;
};
