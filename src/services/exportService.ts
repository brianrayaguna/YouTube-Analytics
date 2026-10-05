import { VideoItem } from '../types';
import { safeFileName } from '../lib/format';

/** Unduh Blob — pakai FileSaver bila tersedia, fallback ke <a download>. */
export const downloadBlob = (blob: Blob, filename: string) => {
  if (window.saveAs) {
    window.saveAs(blob, filename);
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const copyToClipboard = async (text: string): Promise<void> => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  // Fallback untuk konteks non-HTTPS / browser lama
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(textarea);
  if (!ok) throw new Error('Clipboard tidak tersedia');
};

/** Unduh satu thumbnail (fallback buka di tab baru bila CORS/fetch gagal). */
export const downloadThumbnail = async (video: VideoItem, prefix = ''): Promise<void> => {
  const res = await fetch(video.thumbnail);
  if (!res.ok) throw new Error('Gagal mengambil thumbnail');
  const blob = await res.blob();
  downloadBlob(blob, `${prefix}${safeFileName(video.title)}.jpg`);
};
