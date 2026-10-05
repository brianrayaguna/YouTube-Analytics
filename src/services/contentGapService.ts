// Content Gap Analysis Service

import { VideoItem } from '../types';

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

const formatPotentialViews = (views: number): string => {
  if (views >= 1000000) return `±${(views / 1000000).toFixed(1)}M views`;
  if (views >= 1000) return `±${(views / 1000).toFixed(0)}K views`;
  return `±${Math.round(views)} views`;
};

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

  // Score missing topics by frequency and views
  const missingTopics = missingTopicsRaw
    .map(topic => {
      const frequency = trendingTopicsMap.get(topic) || 0;
      const potential = calculateTopicPotential(topic, trendingVideos);
      return {
        topic,
        frequency,
        trendScore: Math.round((frequency * 10) + (potential / 10000))
      };
    })
    .sort((a, b) => b.trendScore - a.trendScore)
    .slice(0, 15);

  // Generate recommendations
  const recommendations = missingTopics.slice(0, 5).map(item => {
    const potential = calculateTopicPotential(item.topic, trendingVideos);
    return {
      topic: item.topic,
      reason: `Muncul di ${item.frequency} video trending, belum ada di channel ini`,
      potentialViews: formatPotentialViews(potential)
    };
  });

  return {
    missingTopics,
    channelTopics,
    trendingTopics,
    overlapPercentage,
    recommendations
  };
};

// Categorize topics into content buckets
export const categorizeTopics = (topics: string[]): Map<string, string[]> => {
  const categories = new Map<string, string[]>();
  
  const categoryKeywords: Record<string, string[]> = {
    'Tutorial & How-to': ['tutorial', 'cara', 'how', 'guide', 'tips', 'belajar', 'learn'],
    'Entertainment': ['funny', 'lucu', 'comedy', 'prank', 'challenge', 'reaction'],
    'Gaming': ['game', 'gameplay', 'gaming', 'play', 'minecraft', 'mobile legends', 'ff'],
    'Lifestyle': ['life', 'vlog', 'daily', 'routine', 'day in', 'story'],
    'Technology': ['tech', 'review', 'unboxing', 'gadget', 'phone', 'laptop'],
    'Music': ['music', 'song', 'cover', 'lagu', 'karaoke', 'remix'],
    'Education': ['education', 'learn', 'study', 'school', 'science', 'math'],
    'News & Current': ['news', 'berita', 'update', 'breaking', 'terbaru']
  };

  topics.forEach(topic => {
    let assigned = false;
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(kw => topic.includes(kw))) {
        const existing = categories.get(category) || [];
        existing.push(topic);
        categories.set(category, existing);
        assigned = true;
        break;
      }
    }
    if (!assigned) {
      const existing = categories.get('Other') || [];
      existing.push(topic);
      categories.set('Other', existing);
    }
  });

  return categories;
};
