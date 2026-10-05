import { VideoItem, AnalyzedData, ChannelStats } from '../types';
import { formatNumber, formatDuration, timeAgo, median } from '../lib/format';

export { formatNumber, formatDuration } from '../lib/format';

const API_BASE = 'https://www.googleapis.com/youtube/v3';

/** Batas hasil yang bisa diberikan endpoint search YouTube Data API */
const SEARCH_RESULT_CAP = 500;
/** Endpoint chart=mostPopular hanya menyediakan maksimal 200 video */
const TRENDING_RESULT_CAP = 200;

// --- QUOTA & CACHE MANAGER ---
const QUOTA_KEY = 'yt_quota_usage_v1';
const DATE_KEY = 'yt_quota_date_v1';
const CACHE_PREFIX = 'yt_cache_';
const CACHE_TTL_MS = 60 * 60 * 1000;

export const QUOTA_LIMIT = 10000;

// Kuota YouTube Data API direset tengah malam waktu Pasifik
const quotaDay = () => new Date().toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles' });

export const getQuotaUsage = (): number => {
  try {
    const today = quotaDay();
    if (localStorage.getItem(DATE_KEY) !== today) {
      localStorage.setItem(DATE_KEY, today);
      localStorage.setItem(QUOTA_KEY, '0');
      return 0;
    }
    return parseInt(localStorage.getItem(QUOTA_KEY) || '0', 10) || 0;
  } catch {
    return 0;
  }
};

const trackQuota = (cost: number) => {
  try {
    localStorage.setItem(QUOTA_KEY, String(getQuotaUsage() + cost));
  } catch {
    // localStorage penuh / tidak tersedia — abaikan
  }
  window.dispatchEvent(new Event('quotaUpdated'));
};

const reviveVideo = (v: VideoItem): VideoItem => ({
  ...v,
  publishedAtDate: new Date(v.publishedAt),
  publishedTimeAgo: timeAgo(v.publishedAt),
});

const getCache = (key: string): AnalyzedData | null => {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    const value = parsed.value as AnalyzedData;
    return { ...value, videos: value.videos.map(reviveVideo) };
  } catch {
    return null;
  }
};

export const clearAnalysisCache = (): number => {
  let removed = 0;
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith(CACHE_PREFIX))
      .forEach(k => {
        localStorage.removeItem(k);
        removed++;
      });
  } catch {
    // abaikan
  }
  return removed;
};

const setCache = (key: string, value: AnalyzedData) => {
  const payload = JSON.stringify({ value, timestamp: Date.now() });
  try {
    localStorage.setItem(CACHE_PREFIX + key, payload);
  } catch {
    // Storage penuh: hapus cache lama lalu coba sekali lagi. Jika tetap gagal, lewati cache.
    clearAnalysisCache();
    try {
      localStorage.setItem(CACHE_PREFIX + key, payload);
    } catch {
      // data terlalu besar untuk di-cache
    }
  }
};

// --- API HELPER ---
export class YouTubeApiError extends Error {
  reason?: string;
  status?: number;
  constructor(message: string, reason?: string, status?: number) {
    super(message);
    this.name = 'YouTubeApiError';
    this.reason = reason;
    this.status = status;
  }
}

const describeApiError = (reason: string | undefined, fallback: string): string => {
  switch (reason) {
    case 'quotaExceeded':
    case 'dailyLimitExceeded':
      return 'Kuota YouTube API harian sudah habis. Coba lagi besok atau gunakan API key lain.';
    case 'keyInvalid':
    case 'badRequest':
      return fallback.toLowerCase().includes('api key')
        ? 'API Key tidak valid. Periksa kembali di Pengaturan.'
        : fallback;
    case 'accessNotConfigured':
    case 'SERVICE_DISABLED':
      return 'YouTube Data API v3 belum diaktifkan untuk API key ini di Google Cloud Console.';
    case 'keyExpired':
      return 'API Key sudah kedaluwarsa. Buat API key baru.';
    case 'forbidden':
    case 'ipRefererBlocked':
      return 'API Key tidak diizinkan untuk domain/aplikasi ini (cek pembatasan API key).';
    case 'playlistNotFound':
      return 'Playlist tidak ditemukan atau bersifat privat.';
    case 'channelNotFound':
      return 'Channel tidak ditemukan.';
    case 'rateLimitExceeded':
    case 'userRateLimitExceeded':
      return 'Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.';
    default:
      return fallback || 'Terjadi kesalahan saat menghubungi YouTube API.';
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- respons YouTube API bervariasi per endpoint
type ApiResponse = any;

const apiGet = async (
  endpoint: string,
  params: Record<string, string | number | undefined>,
  apiKey: string,
  cost = 1
): Promise<ApiResponse> => {
  const url = new URL(`${API_BASE}/${endpoint}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
  });
  url.searchParams.set('key', apiKey);

  trackQuota(cost);

  let res: Response;
  try {
    res = await fetch(url.toString());
  } catch {
    throw new YouTubeApiError('Gagal terhubung ke YouTube API. Periksa koneksi internet.');
  }

  let data: ApiResponse = null;
  try {
    data = await res.json();
  } catch {
    // body kosong / bukan JSON
  }

  if (!res.ok || data?.error) {
    const reason: string | undefined =
      data?.error?.errors?.[0]?.reason || data?.error?.details?.[0]?.reason || data?.error?.status;
    const message: string = data?.error?.message || `HTTP ${res.status}`;
    throw new YouTubeApiError(describeApiError(reason, message), reason, res.status);
  }
  return data;
};

/** Cek API key dengan request termurah (1 unit). */
export const validateApiKey = async (apiKey: string): Promise<void> => {
  if (!apiKey.trim()) throw new YouTubeApiError('API Key masih kosong.');
  await apiGet('videos', { part: 'id', chart: 'mostPopular', maxResults: 1, regionCode: 'US' }, apiKey.trim(), 1);
};

// --- PARSING ---
const parseIsoDuration = (duration: string | undefined): number => {
  const match = duration?.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const [, d, h, m, s] = match.map(x => parseInt(x || '0', 10));
  return d * 86400 + h * 3600 + m * 60 + s;
};

const SHORTS_HASHTAG = /#shorts?\b/i;

const mapVideo = (v: ApiResponse): VideoItem => {
  const dur = parseIsoDuration(v.contentDetails?.duration);
  const thumbs = v.snippet?.thumbnails || {};
  const thumbObj = thumbs.maxres || thumbs.standard || thumbs.high || thumbs.medium || thumbs.default;
  const views = Number(v.statistics?.viewCount || 0);
  const likes = Number(v.statistics?.likeCount || 0);
  const comments = Number(v.statistics?.commentCount || 0);
  const er = views > 0 ? ((likes + comments) / views) * 100 : 0;
  const title: string = v.snippet?.title || '(Tanpa judul)';
  const description: string = v.snippet?.description || '';
  // Shorts: ≤60 dtk, atau ≤3 menit dengan tagar #shorts (batas Shorts sejak Okt 2024)
  const isShort = dur > 0 && (dur <= 60 || (dur <= 180 && SHORTS_HASHTAG.test(`${title} ${description}`)));

  return {
    id: v.id,
    title,
    description,
    thumbnail: thumbObj?.url || `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`,
    views: formatNumber(views),
    viewCountRaw: views,
    likes: formatNumber(likes),
    likeCountRaw: likes,
    comments: formatNumber(comments),
    commentCountRaw: comments,
    engagementRate: parseFloat(er.toFixed(2)),
    tags: v.snippet?.tags || [],
    publishedAt: v.snippet?.publishedAt,
    publishedAtDate: new Date(v.snippet?.publishedAt),
    publishedTimeAgo: timeAgo(v.snippet?.publishedAt),
    durationSec: dur,
    durationFormatted: formatDuration(dur),
    channelTitle: v.snippet?.channelTitle || '',
    channelId: v.snippet?.channelId || '',
    isShort,
    isOutlier: false,
  };
};

/** Tandai outlier: views ≥ 3× median views daftar (minimal 5 video). */
export const markOutliers = (videos: VideoItem[]): VideoItem[] => {
  if (videos.length < 5) return videos.map(v => ({ ...v, isOutlier: false }));
  const med = median(videos.map(v => v.viewCountRaw));
  return videos.map(v => ({ ...v, isOutlier: med > 0 && v.viewCountRaw >= med * 3 }));
};

const fetchVideoDetails = async (apiKey: string, videoIds: string[]): Promise<VideoItem[]> => {
  const unique = Array.from(new Set(videoIds.filter(Boolean)));
  const items: ApiResponse[] = [];
  for (let i = 0; i < unique.length; i += 50) {
    const chunk = unique.slice(i, i + 50);
    const data = await apiGet('videos', { part: 'snippet,contentDetails,statistics', id: chunk.join(','), maxResults: 50 }, apiKey);
    if (data.items) items.push(...data.items);
  }
  // Pertahankan urutan asli (mis. urutan playlist)
  const order = new Map(unique.map((id, i) => [id, i]));
  return items.map(mapVideo).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
};

const fetchPlaylistVideoIds = async (apiKey: string, playlistId: string, limit: number): Promise<string[]> => {
  const ids: string[] = [];
  let pageToken = '';
  while (ids.length < limit) {
    const data = await apiGet('playlistItems', {
      part: 'contentDetails',
      playlistId,
      maxResults: Math.min(limit - ids.length, 50),
      pageToken,
    }, apiKey);
    if (!data.items?.length) break;
    ids.push(...data.items.map((i: ApiResponse) => i.contentDetails?.videoId).filter(Boolean));
    pageToken = data.nextPageToken || '';
    if (!pageToken) break;
  }
  return ids;
};

// --- INPUT PARSER ---
export type ParsedQuery =
  | { kind: 'playlist'; id: string }
  | { kind: 'video'; id: string }
  | { kind: 'channelId'; id: string }
  | { kind: 'handle'; handle: string }
  | { kind: 'username'; name: string }
  | { kind: 'customUrl'; name: string }
  | { kind: 'search'; q: string };

const CHANNEL_ID_RE = /^UC[\w-]{22}$/;
const VIDEO_ID_RE = /^[\w-]{11}$/;

export const parseYouTubeQuery = (raw: string): ParsedQuery => {
  const input = raw.trim();

  if (/^@[\p{L}\p{N}._·-]+$/u.test(input)) return { kind: 'handle', handle: input.slice(1) };
  if (CHANNEL_ID_RE.test(input)) return { kind: 'channelId', id: input };

  let url: URL | null = null;
  if (/^(https?:\/\/)?([\w-]+\.)*(youtube\.com|youtu\.be)\//i.test(input)) {
    try {
      url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
    } catch {
      url = null;
    }
  }
  if (!url) return { kind: 'search', q: input };

  const host = url.hostname.replace(/^www\.|^m\.|^music\./, '');
  const path = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  const list = url.searchParams.get('list');
  const v = url.searchParams.get('v');

  if (host === 'youtu.be' && path[0] && VIDEO_ID_RE.test(path[0])) {
    if (list && !list.startsWith('RD')) return { kind: 'playlist', id: list };
    return { kind: 'video', id: path[0] };
  }
  // Mix/Radio (RD...) tidak bisa diakses lewat API → pakai videonya
  if (list && !list.startsWith('RD')) return { kind: 'playlist', id: list };
  if (v && VIDEO_ID_RE.test(v)) return { kind: 'video', id: v };
  if (['shorts', 'live', 'embed', 'v'].includes(path[0]) && path[1] && VIDEO_ID_RE.test(path[1])) {
    return { kind: 'video', id: path[1] };
  }
  if (path[0]?.startsWith('@')) return { kind: 'handle', handle: path[0].slice(1) };
  if (path[0] === 'channel' && path[1]) return { kind: 'channelId', id: path[1] };
  if (path[0] === 'user' && path[1]) return { kind: 'username', name: path[1] };
  if (path[0] === 'c' && path[1]) return { kind: 'customUrl', name: path[1] };
  if (path[0] && !['watch', 'results', 'feed', 'playlist'].includes(path[0])) {
    return { kind: 'customUrl', name: path[0] };
  }
  return { kind: 'search', q: url.searchParams.get('search_query') || input };
};

export const classifyQuery = (raw: string): 'channel' | 'playlist' | 'keyword' => {
  const parsed = parseYouTubeQuery(raw);
  if (parsed.kind === 'playlist') return 'playlist';
  if (parsed.kind === 'search') return 'keyword';
  return 'channel';
};

/** Ubah input channel (ID, @handle, URL, username) menjadi channel ID. */
export const resolveChannelId = async (apiKey: string, raw: string): Promise<string> => {
  const parsed = parseYouTubeQuery(raw);
  switch (parsed.kind) {
    case 'channelId':
      return parsed.id;
    case 'handle': {
      const data = await apiGet('channels', { part: 'id', forHandle: parsed.handle }, apiKey);
      if (data.items?.[0]?.id) return data.items[0].id;
      break;
    }
    case 'username': {
      const data = await apiGet('channels', { part: 'id', forUsername: parsed.name }, apiKey);
      if (data.items?.[0]?.id) return data.items[0].id;
      break;
    }
    case 'video': {
      const data = await apiGet('videos', { part: 'snippet', id: parsed.id }, apiKey);
      if (data.items?.[0]?.snippet?.channelId) return data.items[0].snippet.channelId;
      throw new YouTubeApiError('Video tidak ditemukan atau bersifat privat.');
    }
    default:
      break;
  }

  // Fallback: cari channel (100 unit)
  const q = parsed.kind === 'handle' ? parsed.handle
    : parsed.kind === 'username' || parsed.kind === 'customUrl' ? parsed.name
    : parsed.kind === 'search' ? parsed.q
    : raw;
  const search = await apiGet('search', { part: 'snippet', type: 'channel', q, maxResults: 1 }, apiKey, 100);
  const id = search.items?.[0]?.id?.channelId || search.items?.[0]?.snippet?.channelId;
  if (!id) throw new YouTubeApiError(`Channel "${raw.trim()}" tidak ditemukan. Pastikan nama/handle benar.`);
  return id;
};

// --- PUBLIC API ---
export const fetchChannelInfo = async (apiKey: string, channelId: string): Promise<ChannelStats | undefined> => {
  const data = await apiGet('channels', { part: 'snippet,statistics,brandingSettings', id: channelId }, apiKey);
  const ch = data.items?.[0];
  if (!ch) return undefined;
  const subs = Number(ch.statistics?.subscriberCount || 0);
  const views = Number(ch.statistics?.viewCount || 0);
  const videos = Number(ch.statistics?.videoCount || 0);
  const thumbs = ch.snippet?.thumbnails || {};
  return {
    channelId: ch.id,
    title: ch.snippet?.title || '',
    subscriberCount: formatNumber(subs),
    subCountRaw: subs,
    hiddenSubscriberCount: !!ch.statistics?.hiddenSubscriberCount,
    viewCount: formatNumber(views),
    viewCountRaw: views,
    videoCount: formatNumber(videos),
    videoCountRaw: videos,
    customUrl: ch.snippet?.customUrl || '',
    description: ch.snippet?.description || '',
    avatar: (thumbs.high || thumbs.medium || thumbs.default)?.url || '',
    banner: ch.brandingSettings?.image?.bannerExternalUrl || '',
  };
};

/** Ambil video terbaru dari uploads playlist sebuah channel. */
export const fetchChannelUploads = async (apiKey: string, channelId: string, limit: number): Promise<VideoItem[]> => {
  // Uploads playlist selalu "UU" + sisa channel ID — hemat 1 request
  const uploadsId = `UU${channelId.slice(2)}`;
  let ids: string[] = [];
  try {
    ids = await fetchPlaylistVideoIds(apiKey, uploadsId, limit);
  } catch (e) {
    if (!(e instanceof YouTubeApiError) || e.reason !== 'playlistNotFound') throw e;
  }
  if (!ids.length) return [];
  return fetchVideoDetails(apiKey, ids);
};

export const fetchTrendingVideos = async (apiKey: string, limit: number = 50, regionCode: string = 'ID'): Promise<AnalyzedData> => {
  const target = Math.min(limit, TRENDING_RESULT_CAP);
  const items: ApiResponse[] = [];
  let pageToken = '';
  while (items.length < target) {
    const data = await apiGet('videos', {
      part: 'snippet,contentDetails,statistics',
      chart: 'mostPopular',
      regionCode,
      maxResults: Math.min(target - items.length, 50),
      pageToken,
    }, apiKey);
    if (!data.items?.length) break;
    items.push(...data.items);
    pageToken = data.nextPageToken || '';
    if (!pageToken) break;
  }

  const videos = markOutliers(items.map(mapVideo));
  return {
    videos,
    channelTitle: `Trending (${regionCode})`,
    totalFound: videos.length,
    source: 'trending',
    query: regionCode,
    notice: limit > TRENDING_RESULT_CAP ? `YouTube hanya menyediakan maksimal ${TRENDING_RESULT_CAP} video trending.` : undefined,
  };
};

export const fetchYouTubeData = async (apiKey: string, query: string, limit: number): Promise<AnalyzedData> => {
  const cleanQuery = query.trim();
  if (!cleanQuery) throw new YouTubeApiError('Masukkan nama channel, URL, atau kata kunci.');

  const cacheKey = `analysis_${cleanQuery}_${limit}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const parsed = parseYouTubeQuery(cleanQuery);
  let result: AnalyzedData;

  if (parsed.kind === 'playlist') {
    const ids = await fetchPlaylistVideoIds(apiKey, parsed.id, limit);
    if (!ids.length) throw new YouTubeApiError('Playlist kosong atau tidak bisa diakses.');
    const [videos, meta] = await Promise.all([
      fetchVideoDetails(apiKey, ids),
      apiGet('playlists', { part: 'snippet', id: parsed.id }, apiKey).catch(() => null),
    ]);
    const snippet = meta?.items?.[0]?.snippet;
    result = {
      videos: markOutliers(videos),
      channelTitle: snippet?.title ? `Playlist: ${snippet.title}` : 'Playlist',
      channelId: snippet?.channelId,
      totalFound: videos.length,
      source: 'playlist',
      query: cleanQuery,
    };
  } else if (parsed.kind === 'search') {
    const target = Math.min(limit, SEARCH_RESULT_CAP);
    const ids: string[] = [];
    let pageToken = '';
    while (ids.length < target) {
      const data = await apiGet('search', {
        part: 'id',
        q: parsed.q,
        type: 'video',
        maxResults: Math.min(target - ids.length, 50),
        pageToken,
      }, apiKey, 100);
      if (!data.items?.length) break;
      ids.push(...data.items.map((i: ApiResponse) => i.id?.videoId).filter(Boolean));
      pageToken = data.nextPageToken || '';
      if (!pageToken) break;
    }
    if (!ids.length) throw new YouTubeApiError(`Tidak ada video untuk "${parsed.q}".`);
    const videos = await fetchVideoDetails(apiKey, ids);
    result = {
      videos: markOutliers(videos),
      channelTitle: `Hasil pencarian: ${parsed.q}`,
      totalFound: videos.length,
      source: 'search',
      query: cleanQuery,
      notice: limit > SEARCH_RESULT_CAP
        ? `Pencarian kata kunci dibatasi ${SEARCH_RESULT_CAP} video oleh YouTube API (100 unit kuota per 50 hasil).`
        : undefined,
    };
  } else {
    // Channel: @handle, ID, URL channel, atau URL video (menganalisis channel pemilik video)
    const channelId = await resolveChannelId(apiKey, cleanQuery);
    const [stats, videos] = await Promise.all([
      fetchChannelInfo(apiKey, channelId),
      fetchChannelUploads(apiKey, channelId, limit),
    ]);
    if (!stats) throw new YouTubeApiError('Channel tidak ditemukan.');
    if (!videos.length) throw new YouTubeApiError(`Channel "${stats.title}" belum memiliki video publik.`);
    result = {
      videos: markOutliers(videos),
      channelTitle: stats.title || videos[0]?.channelTitle,
      channelId,
      channelStats: stats,
      totalFound: videos.length,
      source: 'channel',
      query: cleanQuery,
      notice: parsed.kind === 'video' ? 'Menampilkan channel pemilik video tersebut.' : undefined,
    };
  }

  setCache(cacheKey, result);
  return result;
};
