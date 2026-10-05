import { ShowToast } from '../types';
import { openVideoDownload } from '../constants/downloaders';
import {
  isLocalDownloaderEnabled,
  startLocalDownload,
  waitForLocalJob,
  LocalFormat,
  LocalQuality,
} from './localDownloader';

/**
 * Unduh video: lewat mesin lokal (yt-dlp) bila diaktifkan, selain itu buka Cobalt.
 * Cobalt dibuka sinkron agar tidak diblokir popup blocker.
 */
export const downloadVideo = (
  videoId: string,
  title: string,
  onToast: ShowToast,
  opts: { format?: LocalFormat; quality?: LocalQuality } = {}
) => {
  if (!isLocalDownloaderEnabled()) {
    openVideoDownload(videoId);
    return;
  }
  return downloadVideoLocally(`https://www.youtube.com/watch?v=${videoId}`, title, onToast, opts);
};

export const downloadVideoLocally = async (
  url: string,
  title: string,
  onToast: ShowToast,
  { format = 'mp4', quality = 'best' }: { format?: LocalFormat; quality?: LocalQuality } = {}
) => {
  const short = title.length > 48 ? `${title.slice(0, 48)}…` : title;
  try {
    onToast(`Mengirim ke mesin lokal: ${short}`, 'loading');
    const job = await startLocalDownload(url, format, quality);
    const done = await waitForLocalJob(job.id, j => {
      if (j.status === 'queued') onToast(`Antre di mesin lokal: ${short}`, 'loading');
      else if (j.status === 'processing') onToast(`Memproses ${format.toUpperCase()}… ${short}`, 'loading');
      else if (j.percent !== null) onToast(`Mengunduh ${Math.round(j.percent)}% — ${short}`, 'loading');
    });
    if (done.status === 'done') onToast(`Tersimpan di perangkat: ${done.filename}`, 'success');
    else if (done.status === 'canceled') onToast('Unduhan dibatalkan', 'info');
    else onToast(done.error || 'Unduhan gagal', 'error');
  } catch (e) {
    onToast(e instanceof Error ? e.message : 'Local Downloader tidak terhubung', 'error');
  }
};
