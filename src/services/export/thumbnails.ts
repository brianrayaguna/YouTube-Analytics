// Ambil thumbnail untuk ekspor: unduh paralel, kecilkan via canvas (JPEG), sediakan base64 & bytes.

import { thumbnailUrl, ThumbnailSize } from '../../lib/video';

export interface ThumbImage {
  dataUrl: string; // data:image/jpeg;base64,...
  base64: string; // tanpa prefix
  bytes: Uint8Array;
  width: number;
  height: number;
}

export type ProgressFn = (done: number, total: number) => void;

const loadBlob = async (url: string, signal?: AbortSignal): Promise<Blob | null> => {
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const blob = await res.blob();
    // i.ytimg.com mengembalikan placeholder 120×90 abu-abu (±1 KB) bila ukuran tidak tersedia
    return blob.size > 1500 ? blob : null;
  } catch {
    return null;
  }
};

const blobToBase64 = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

type Decoded = { source: CanvasImageSource; width: number; height: number; close: () => void };

/** Dekode gambar: createImageBitmap, lalu fallback <img> (mendukung SVG/WebP di semua browser). */
const decodeImage = async (blob: Blob): Promise<Decoded | null> => {
  try {
    const bmp = await createImageBitmap(blob);
    return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close?.() };
  } catch {
    // lanjut ke fallback
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    const width = img.naturalWidth || 320;
    const height = img.naturalHeight || 180;
    return { source: img, width, height, close: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    return null;
  }
};

/** Gambar ulang ke ukuran target (crop 16:9 di tengah) dan encode JPEG. Null bila gagal. */
const resizeToJpeg = async (blob: Blob, width: number, quality: number): Promise<{ blob: Blob; width: number; height: number } | null> => {
  const height = Math.round((width * 9) / 16);
  const decoded = await decodeImage(blob);
  if (!decoded) return null;
  try {
    const srcRatio = decoded.width / decoded.height;
    let sw = decoded.width;
    let sh = decoded.height;
    let sx = 0;
    let sy = 0;
    if (srcRatio > 16 / 9) {
      sw = decoded.height * (16 / 9);
      sx = (decoded.width - sw) / 2;
    } else {
      sh = decoded.width * (9 / 16);
      sy = (decoded.height - sh) / 2;
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return null;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(decoded.source, sx, sy, sw, sh, 0, 0, width, height);
    const out = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', quality));
    canvas.width = 0;
    canvas.height = 0;
    return out ? { blob: out, width, height } : null;
  } catch {
    return null; // mis. canvas "tainted" — lewati gambar
  } finally {
    decoded.close();
  }
};

const toImage = async (blob: Blob, width: number, height: number): Promise<ThumbImage> => {
  const base64 = await blobToBase64(blob);
  return {
    base64,
    dataUrl: `data:image/jpeg;base64,${base64}`,
    bytes: new Uint8Array(await blob.arrayBuffer()),
    width,
    height,
  };
};

/**
 * Ambil thumbnail kecil (default 320×180) untuk disematkan di Excel/PDF/HTML/JSON.
 * Hasil berupa Map videoId → gambar; video yang gagal tidak dimasukkan.
 */
export const fetchEmbeddedThumbnails = async (
  items: Array<{ id: string; thumbnail?: string }>,
  { width = 320, quality = 0.78, concurrency = 6, onProgress, signal }: { width?: number; quality?: number; concurrency?: number; onProgress?: ProgressFn; signal?: AbortSignal } = {}
): Promise<Map<string, ThumbImage>> => {
  const result = new Map<string, ThumbImage>();
  let done = 0;
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      if (signal?.aborted) return;
      const item = items[cursor++];
      const blob = (await loadBlob(thumbnailUrl(item.id, 'mq'), signal)) ?? (item.thumbnail ? await loadBlob(item.thumbnail, signal) : null);
      const resized = blob ? await resizeToJpeg(blob, width, quality) : null;
      if (resized) result.set(item.id, await toImage(resized.blob, resized.width, resized.height));
      onProgress?.(++done, items.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return result;
};

/** Thumbnail ukuran penuh untuk folder di paket ZIP (maxres → sd → hq → bawaan). */
export const fetchFullThumbnail = async (id: string, fallbackUrl: string | undefined, prefer: ThumbnailSize = 'maxres', signal?: AbortSignal): Promise<Blob | null> => {
  const order: ThumbnailSize[] = prefer === 'maxres' ? ['maxres', 'sd', 'hq'] : ['hq', 'mq'];
  for (const size of order) {
    const blob = await loadBlob(thumbnailUrl(id, size), signal);
    if (blob) return blob;
  }
  return fallbackUrl ? loadBlob(fallbackUrl, signal) : null;
};
