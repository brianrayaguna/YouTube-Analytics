export interface VideoItem {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  views: string;
  viewCountRaw: number;
  likes: string;
  likeCountRaw: number;
  comments: string;
  commentCountRaw: number;
  engagementRate: number;
  tags: string[];
  publishedAt: string;
  publishedAtDate: Date;
  publishedTimeAgo: string;
  durationSec: number;
  durationFormatted: string;
  channelTitle: string;
  channelId: string;
  isShort: boolean;
  isOutlier?: boolean;
  /** Jumlah like disembunyikan kreator (likeCount tidak tersedia di API) */
  likesHidden?: boolean;
  /** Komentar dinonaktifkan (commentCount tidak tersedia di API) */
  commentsDisabled?: boolean;
  /** Thumbnail resolusi 1280×720 tersedia (umumnya thumbnail kustom HD) */
  thumbnailHd?: boolean;
}

export interface ChannelStats {
  channelId?: string;
  title?: string;
  subscriberCount: string;
  subCountRaw: number;
  viewCount: string;
  viewCountRaw?: number;
  videoCount: string;
  videoCountRaw?: number;
  customUrl: string;
  description: string;
  avatar: string;
  banner?: string;
  hiddenSubscriberCount?: boolean;
}

export type AnalysisSource = 'channel' | 'playlist' | 'search' | 'trending';

export interface AnalyzedData {
  videos: VideoItem[];
  channelTitle?: string;
  channelId?: string;
  channelStats?: ChannelStats;
  totalFound: number;
  source?: AnalysisSource;
  query?: string;
  /** Pesan informasi tambahan (mis. batas hasil pencarian API) */
  notice?: string;
  /** Jumlah video yang diminta saat analisis (pengaturan "Jumlah video yang diambil") */
  requestedLimit?: number;
}

// Mode navigasi
export type AnalysisMode =
  | 'dashboard'
  | 'trending'
  | 'insights'
  | 'benchmark'
  | 'saved'
  | 'content_gap'
  | 'history'
  | 'schedule'
  | 'title_score'
  | 'downloader';

export type ContentTypeFilter = 'all' | 'long' | 'shorts';

export type FetchLimit = 10 | 50 | 100 | 500 | 1000 | 5000;

export type SortOption = 'newest' | 'oldest' | 'popular' | 'most_liked' | 'highest_er' | 'most_commented';

export type DurationRange = 'all' | 'under_1' | '1_5' | '5_20' | 'over_20';

export type DateRangeFilter = 'all' | '7d' | '30d' | '90d' | '1y';

export type ToastType = 'success' | 'error' | 'loading' | 'info';

export interface ToastState {
  id: number;
  message: string;
  type: ToastType;
}

export type ShowToast = (message: string, type?: ToastType) => void;

export interface TrendingRegion {
  code: string;
  name: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- library global dari CDN tanpa tipe */
declare global {
  interface Window {
    saveAs?: any;
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
