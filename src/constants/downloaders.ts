// Layanan downloader eksternal — semua dibuka di tab baru.

const VIDEO_ID_PATTERNS = [
  /[?&]v=([\w-]{11})/,
  /youtu\.be\/([\w-]{11})/,
  /youtube\.com\/(?:shorts|live|embed|v)\/([\w-]{11})/,
];

export const extractYouTubeVideoId = (url: string): string | null => {
  for (const re of VIDEO_ID_PATTERNS) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return /^[\w-]{11}$/.test(url.trim()) ? url.trim() : null;
};

export const isYouTubeUrl = (url: string) => /(^|\.|\/\/)(youtube\.com|youtu\.be)\//i.test(url);

export const normalizeVideoUrl = (input: string): string => {
  const trimmed = input.trim();
  if (!trimmed) return '';
  const id = extractYouTubeVideoId(trimmed);
  if (id && (isYouTubeUrl(trimmed) || trimmed.length === 11)) return `https://www.youtube.com/watch?v=${id}`;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

export interface DownloaderService {
  id: string;
  name: string;
  description: string;
  recommended?: boolean;
  youtubeOnly?: boolean;
  homepage: string;
  getUrl: (videoUrl: string) => string;
}

export const DOWNLOADER_SERVICES: DownloaderService[] = [
  {
    id: 'cobalt',
    name: 'Cobalt',
    description: 'Bersih, tanpa iklan, banyak platform',
    recommended: true,
    homepage: 'https://cobalt.tools/',
    // cobalt membaca link dari parameter "u" (atau hash)
    getUrl: (videoUrl) => `https://cobalt.tools/?u=${encodeURIComponent(videoUrl)}`,
  },
  {
    id: 'y2mate',
    name: 'Y2Mate',
    description: 'Banyak pilihan kualitas MP4/MP3',
    youtubeOnly: true,
    homepage: 'https://www.y2mate.com/',
    getUrl: (videoUrl) => {
      const id = extractYouTubeVideoId(videoUrl);
      return id ? `https://www.y2mate.com/youtube/${id}` : 'https://www.y2mate.com/';
    },
  },
  {
    id: 'savefrom',
    name: 'SaveFrom',
    description: 'Format beragam, multi-platform',
    homepage: 'https://en.savefrom.net/',
    getUrl: (videoUrl) => `https://en.savefrom.net/1-${encodeURIComponent(videoUrl)}`,
  },
  {
    id: 'ssyoutube',
    name: 'SSYouTube',
    description: 'Cepat & sederhana',
    youtubeOnly: true,
    homepage: 'https://ssyoutube.com/',
    getUrl: (videoUrl) => {
      const id = extractYouTubeVideoId(videoUrl);
      return id ? `https://ssyoutube.com/watch?v=${id}` : 'https://ssyoutube.com/';
    },
  },
];

export const openDownloader = (service: DownloaderService, rawUrl: string) => {
  const url = normalizeVideoUrl(rawUrl);
  const target = !url || (service.youtubeOnly && !isYouTubeUrl(url)) ? service.homepage : service.getUrl(url);
  window.open(target, '_blank', 'noopener,noreferrer');
};

export const openVideoDownload = (videoId: string) =>
  openDownloader(DOWNLOADER_SERVICES[0], `https://www.youtube.com/watch?v=${videoId}`);
