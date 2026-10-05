// Performance Score Service - Calculate title and thumbnail scores based on actual video performance

import { VideoItem } from '../types';
import { analyzeTitleScore } from './titleScoreService';

export interface PerformanceScore {
  totalScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  viewsPercentile: number;
  likesPercentile: number;
  erPercentile: number;
  textScore?: number;
  recencyBonus?: number;
  breakdown: {
    views: { score: number; max: number; label: string };
    likes: { score: number; max: number; label: string };
    engagement: { score: number; max: number; label: string };
    text?: { score: number; max: number; label: string };
    recency?: { score: number; max: number; label: string };
  };
}

export interface VideoWithScores extends VideoItem {
  titleScore: PerformanceScore;
  thumbnailScore: PerformanceScore;
}

// Percentile = share of values strictly below `value` (binary search on a pre-sorted array)
const percentileInSorted = (value: number, sorted: number[]): number => {
  if (sorted.length === 0) return 50;
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  return Math.round((lo / sorted.length) * 100);
};

interface SortedMetrics {
  views: number[];
  likes: number[];
  er: number[];
}

const buildSortedMetrics = (videos: VideoItem[]): SortedMetrics => {
  const asc = (a: number, b: number) => a - b;
  return {
    views: videos.map(v => v.viewCountRaw).sort(asc),
    likes: videos.map(v => v.likeCountRaw).sort(asc),
    er: videos.map(v => v.engagementRate).sort(asc),
  };
};

// Calculate recency bonus based on how quickly video gained views
const calculateRecencyBonus = (video: VideoItem): number => {
  const now = new Date();
  const publishedDate = new Date(video.publishedAt);
  const daysSincePublish = Math.max(1, Math.floor((now.getTime() - publishedDate.getTime()) / (1000 * 60 * 60 * 24)));
  
  // Views per day
  const viewsPerDay = video.viewCountRaw / daysSincePublish;
  
  // Score based on views per day (normalized)
  if (viewsPerDay >= 100000) return 100;
  if (viewsPerDay >= 50000) return 90;
  if (viewsPerDay >= 10000) return 80;
  if (viewsPerDay >= 5000) return 70;
  if (viewsPerDay >= 1000) return 60;
  if (viewsPerDay >= 500) return 50;
  if (viewsPerDay >= 100) return 40;
  return 30;
};

// Get grade from score
const getGrade = (score: number): 'A' | 'B' | 'C' | 'D' | 'F' => {
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  if (score >= 20) return 'D';
  return 'F';
};

// Calculate Title Performance Score
export const calculateTitlePerformanceScore = (
  video: VideoItem,
  allVideos: VideoItem[],
  metrics: SortedMetrics = buildSortedMetrics(allVideos)
): PerformanceScore => {
  const viewsPercentile = percentileInSorted(video.viewCountRaw, metrics.views);
  const likesPercentile = percentileInSorted(video.likeCountRaw, metrics.likes);
  const erPercentile = percentileInSorted(video.engagementRate, metrics.er);
  
  // Get text analysis score (from existing titleScoreService)
  const textAnalysis = analyzeTitleScore(video.title);
  const textScore = Math.round((textAnalysis.totalScore / 80) * 100); // Normalize to 0-100
  
  // Weighted formula: Views 35%, Likes 25%, ER 20%, Text 20%
  const totalScore = Math.round(
    (viewsPercentile * 0.35) +
    (likesPercentile * 0.25) +
    (erPercentile * 0.20) +
    (textScore * 0.20)
  );
  
  return {
    totalScore,
    grade: getGrade(totalScore),
    viewsPercentile,
    likesPercentile,
    erPercentile,
    textScore,
    breakdown: {
      views: { score: Math.round(viewsPercentile * 0.35), max: 35, label: `Top ${Math.max(1, 100 - viewsPercentile)}% views` },
      likes: { score: Math.round(likesPercentile * 0.25), max: 25, label: `Top ${Math.max(1, 100 - likesPercentile)}% likes` },
      engagement: { score: Math.round(erPercentile * 0.20), max: 20, label: `Engagement rate ${video.engagementRate}%` },
      text: { score: Math.round(textScore * 0.20), max: 20, label: textAnalysis.suggestions[0] || 'Struktur judul sudah baik' }
    }
  };
};

// Calculate Thumbnail Performance Score
export const calculateThumbnailPerformanceScore = (
  video: VideoItem,
  allVideos: VideoItem[],
  metrics: SortedMetrics = buildSortedMetrics(allVideos)
): PerformanceScore => {
  const viewsPercentile = percentileInSorted(video.viewCountRaw, metrics.views);
  const erPercentile = percentileInSorted(video.engagementRate, metrics.er);
  const recencyBonus = calculateRecencyBonus(video);
  
  // Weighted formula: Views 40%, ER 30%, Recency 30%
  const totalScore = Math.round(
    (viewsPercentile * 0.40) +
    (erPercentile * 0.30) +
    (recencyBonus * 0.30)
  );
  
  return {
    totalScore,
    grade: getGrade(totalScore),
    viewsPercentile,
    likesPercentile: 0, // Not used for thumbnail
    erPercentile,
    recencyBonus,
    breakdown: {
      views: { score: Math.round(viewsPercentile * 0.40), max: 40, label: `Top ${Math.max(1, 100 - viewsPercentile)}% views (proksi CTR)` },
      likes: { score: 0, max: 0, label: '' }, // Not displayed
      engagement: { score: Math.round(erPercentile * 0.30), max: 30, label: `ER ${video.engagementRate}% — penonton tetap terlibat` },
      recency: { score: Math.round(recencyBonus * 0.30), max: 30, label: `Bonus kecepatan mendapatkan views` }
    }
  };
};

// Calculate scores for all videos
export const calculateAllVideoScores = (videos: VideoItem[]): VideoWithScores[] => {
  const metrics = buildSortedMetrics(videos);
  return videos.map(video => ({
    ...video,
    titleScore: calculateTitlePerformanceScore(video, videos, metrics),
    thumbnailScore: calculateThumbnailPerformanceScore(video, videos, metrics)
  }));
};

// Get top performing titles
export const getTopTitles = (videos: VideoItem[], count: number = 10): VideoWithScores[] => {
  const scored = calculateAllVideoScores(videos);
  return scored.sort((a, b) => b.titleScore.totalScore - a.titleScore.totalScore).slice(0, count);
};

// Get top performing thumbnails  
export const getTopThumbnails = (videos: VideoItem[], count: number = 10): VideoWithScores[] => {
  const scored = calculateAllVideoScores(videos);
  return scored.sort((a, b) => b.thumbnailScore.totalScore - a.thumbnailScore.totalScore).slice(0, count);
};

// Get average scores
export const getAverageScores = (videos: VideoItem[]): { avgTitleScore: number; avgThumbnailScore: number } => {
  if (videos.length === 0) return { avgTitleScore: 0, avgThumbnailScore: 0 };
  
  const scored = calculateAllVideoScores(videos);
  const avgTitleScore = Math.round(scored.reduce((sum, v) => sum + v.titleScore.totalScore, 0) / scored.length);
  const avgThumbnailScore = Math.round(scored.reduce((sum, v) => sum + v.thumbnailScore.totalScore, 0) / scored.length);
  
  return { avgTitleScore, avgThumbnailScore };
};

// Get grade distribution
export const getGradeDistribution = (scores: PerformanceScore[]): Record<string, number> => {
  const distribution = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  scores.forEach(s => {
    distribution[s.grade]++;
  });
  return distribution;
};
