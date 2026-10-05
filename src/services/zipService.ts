import { VideoItem } from '../types';
import { downloadBlob } from './exportService';
import { safeFileName } from '../lib/format';

/**
 * Helper to crop image to 9:16 aspect ratio via Canvas
 * Optimized to prevent memory leaks
 */
const cropTo916 = (imageUrl: string): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const targetRatio = 9 / 16;
      const newWidth = img.height * targetRatio;
      const startX = (img.width - newWidth) / 2;

      canvas.width = newWidth;
      canvas.height = img.height;

      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return reject("Canvas context error");

      ctx.drawImage(img, startX, 0, newWidth, img.height, 0, 0, newWidth, img.height);

      canvas.toBlob((blob) => {
        // Clear references immediately
        canvas.width = 0;
        canvas.height = 0;
        if (blob) resolve(blob);
        else reject("Blob conversion failed");
      }, 'image/jpeg', 0.85);
    };
    img.onerror = () => reject("Image load error");
    img.src = imageUrl;
  });
};

export const generateZip = async (
  list: VideoItem[],
  name: string,
  onProgress: (percent: number) => void
): Promise<{ succeeded: number; failed: number }> => {
  if (!list.length) return { succeeded: 0, failed: 0 };

  // JSZip dibundel lewat npm dan dimuat hanya saat dibutuhkan
  const { default: JSZip } = await import('jszip');

  onProgress(1);
  const zip = new JSZip();
  const folder = zip.folder(safeFileName(name))!;
  let succeeded = 0;

  // Concurrency limit to prevent memory spikes
  const BATCH_SIZE = 5;
  for (let i = 0; i < list.length; i += BATCH_SIZE) {
    const batch = list.slice(i, i + BATCH_SIZE);

    await Promise.all(batch.map(async (v, indexInBatch) => {
      const globalIndex = i + indexInBatch;
      try {
        let blob: Blob;
        if (v.isShort) {
          blob = await cropTo916(v.thumbnail);
        } else {
          const res = await fetch(v.thumbnail);
          if (!res.ok) throw new Error("Fetch failed");
          blob = await res.blob();
        }

        const fileName = `${globalIndex + 1}. ${safeFileName(v.title)}.jpg`;
        folder.file(fileName, blob);
        succeeded++;

      } catch (e) {
        console.warn("Failed process thumbnail:", v.title, e);
      }
    }));

    onProgress(Math.round(((i + batch.length) / list.length) * 100));
  }

  if (succeeded === 0) {
    throw new Error("Tidak ada thumbnail yang berhasil diunduh.");
  }

  const content = await zip.generateAsync({ type: 'blob' });
  downloadBlob(content, `${safeFileName(name)}_Thumbnails.zip`);
  onProgress(0);
  return { succeeded, failed: list.length - succeeded };
};
