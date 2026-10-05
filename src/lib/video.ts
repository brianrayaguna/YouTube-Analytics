import { VideoItem } from '../types';

/** Batas durasi YouTube Shorts (sejak 15 Okt 2024): hingga 3 menit. */
export const SHORTS_MAX_SECONDS = 180;

/** Shorts = video berdurasi 1 detik s.d. 3 menit (0 detik = live/premiere yang belum selesai). */
export const isShortDuration = (seconds: number): boolean => seconds > 0 && seconds <= SHORTS_MAX_SECONDS;

/** Hitung ulang klasifikasi untuk data lama (cache / video tersimpan) yang memakai aturan sebelumnya. */
export const withShortsClassification = <T extends Pick<VideoItem, 'durationSec' | 'isShort'>>(v: T): T =>
  v.isShort === isShortDuration(v.durationSec) ? v : { ...v, isShort: isShortDuration(v.durationSec) };

export type ThumbnailSize = 'default' | 'mq' | 'hq' | 'sd' | 'maxres';

const THUMB_FILE: Record<ThumbnailSize, string> = {
  default: 'default.jpg', // 120×90
  mq: 'mqdefault.jpg', // 320×180
  hq: 'hqdefault.jpg', // 480×360
  sd: 'sddefault.jpg', // 640×480
  maxres: 'maxresdefault.jpg', // 1280×720
};

export const thumbnailUrl = (videoId: string, size: ThumbnailSize = 'mq') => `https://i.ytimg.com/vi/${videoId}/${THUMB_FILE[size]}`;

export const videoUrl = (v: Pick<VideoItem, 'id' | 'isShort'>, preferShortsUrl = false) =>
  preferShortsUrl && v.isShort ? `https://www.youtube.com/shorts/${v.id}` : `https://www.youtube.com/watch?v=${v.id}`;
