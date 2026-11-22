// Content Gap Analysis Service

import { VideoItem } from '../types';
import { formatNumber } from '../lib/format';

export interface ContentGapResult {
  missingTopics: Array<{
    topic: string;
    frequency: number;
    trendScore: number;
  }>;
  channelTopics: string[];
  trendingTopics: string[];
  overlapPercentage: number;
  recommendations: Array<{
    topic: string;
    reason: string;
    potentialViews: string;
  }>;
}

// Kata umum yang tidak bermakna sebagai topik (ID + EN)
const STOPWORDS = new Set([
  'yang', 'dan', 'untuk', 'dengan', 'dari', 'ini', 'itu', 'pada', 'adalah', 'atau', 'juga', 'akan', 'bisa',
  'saat', 'kami', 'kita', 'saya', 'kamu', 'mereka', 'tidak', 'sudah', 'lagi', 'jadi', 'buat', 'sama', 'karena',
  'ternyata', 'banget', 'paling', 'semua', 'official', 'video', 'full', 'part', 'episode', 'shorts', 'short',
  'the', 'and', 'for', 'with', 'this', 'that', 'from', 'your', 'you', 'are', 'was', 'what', 'how', 'why',
  'when', 'who', 'will', 'have', 'has', 'just', 'into', 'about', 'they', 'their', 'them', 'out', 'new', 'vs',
]);

const tokenize = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w) && !/^\d+$/.test(w));

// Extract topics from video tags and titles
const extractTopics = (videos: VideoItem[]): Map<string, number> => {
  const topicMap = new Map<string, number>();
  const add = (topic: string) => topicMap.set(topic, (topicMap.get(topic) || 0) + 1);

  videos.forEach(video => {
    const seen = new Set<string>();
    const addOnce = (topic: string) => {
      if (seen.has(topic)) return;
      seen.add(topic);
      add(topic);
    };

    // Tags
    video.tags.forEach(tag => {
      const normalizedTag = tag.toLowerCase().trim();
      if (normalizedTag.length > 2 && !STOPWORDS.has(normalizedTag)) addOnce(normalizedTag);
    });

    // Kata & frasa 2 kata dari judul
    const titleWords = tokenize(video.title);
    titleWords.forEach(w => w.length > 3 && addOnce(w));
    for (let i = 0; i < titleWords.length - 1; i++) {
      addOnce(`${titleWords[i]} ${titleWords[i + 1]}`);
    }
  });

  return topicMap;
};

// Calculate average views for videos with a specific topic
const calculateTopicPotential = (topic: string, trendingVideos: VideoItem[]): number => {
  const matchingVideos = trendingVideos.filter(v => 
    v.tags.some(t => t.toLowerCase().includes(topic.toLowerCase())) ||
    v.title.toLowerCase().includes(topic.toLowerCase())
  );

  if (matchingVideos.length === 0) return 0;

  const avgViews = matchingVideos.reduce((sum, v) => sum + v.viewCountRaw, 0) / matchingVideos.length;
  return avgViews;
};

const formatPotentialViews = (views: number): string => `±${formatNumber(Math.round(views))} views`;

export const analyzeContentGap = (
  channelVideos: VideoItem[],
  trendingVideos: VideoItem[]
): ContentGapResult => {
  const channelTopicsMap = extractTopics(channelVideos);
  const trendingTopicsMap = extractTopics(trendingVideos);

  // Get top topics from each
  const channelTopics = Array.from(channelTopicsMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([topic]) => topic);

  const trendingTopics = Array.from(trendingTopicsMap.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([topic]) => topic);

  // Find gaps: trending topics NOT in channel
  const channelTopicsSet = new Set(channelTopicsMap.keys());
  const missingTopicsRaw = trendingTopics.filter(topic => !channelTopicsSet.has(topic));

  // Calculate overlap
  const overlapCount = trendingTopics.filter(t => channelTopicsSet.has(t)).length;
  const overlapPercentage = trendingTopics.length ? Math.round((overlapCount / trendingTopics.length) * 100) : 0;

  // Score missing topics by frequency and views (hitung potential sekali per topik)
  const scoredMissing = missingTopicsRaw
    .map(topic => {
      const frequency = trendingTopicsMap.get(topic) || 0;
      const potential = calculateTopicPotential(topic, trendingVideos);
      return {
        topic,
        frequency,
        potential,
        trendScore: Math.round((frequency * 10) + (potential / 10000)),
      };
    })
    .sort((a, b) => b.trendScore - a.trendScore)
    .slice(0, 15);

  const missingTopics = scoredMissing.map(({ topic, frequency, trendScore }) => ({ topic, frequency, trendScore }));

  // Generate recommendations
  const recommendations = scoredMissing.slice(0, 5).map(item => ({
    topic: item.topic,
    reason: `Muncul di ${item.frequency} video trending, belum ada di channel ini`,
    potentialViews: formatPotentialViews(item.potential),
  }));

  return {
    missingTopics,
    channelTopics,
    trendingTopics,
    overlapPercentage,
    recommendations,
  };
};
