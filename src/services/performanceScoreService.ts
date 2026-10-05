// Mesin skor Judul & Thumbnail (v2)
//
// Prinsip (hasil audit v1):
// 1. Jangkauan disesuaikan UMUR video. v1 memakai views mentah, sehingga video lama selalu menang
//    (video 3 hari dengan views/hari 10× lebih tinggi mendapat F, video 3 tahun mendapat B).
//    v2: perkiraan views video seusia = baseline × t/(t+τ) (kurva pertumbuhan views: cepat di
//    awal lalu mendatar; τ = 7 hari untuk video, 4 hari untuk Shorts). Baseline = median
//    views/g(t) kelompok. Rasio jangkauan = views aktual ÷ perkiraan.
// 2. Kelompok terpisah: Shorts dibandingkan dengan Shorts, Video dengan Video (fallback ke semua
//    bila kelompok < 5 video).
// 3. Persentil mid-rank (nilai kembar mendapat posisi tengah), bukan "strictly below".
// 4. Engagement rate dihaluskan (Bayesian, K = 1.000 views) agar video ber-views kecil tidak
//    melonjak/terjun; like yang DISEMBUNYIKAN tidak lagi dianggap 0 — komponennya dilewati dan
//    bobot dibagi ulang.
// 5. Likes tidak dihitung terpisah dari views (v1 menghitung popularitas dua kali).
// 6. Skor judul memakai analisis teks v2; skor thumbnail memakai ketersediaan thumbnail HD.
// 7. Setiap skor disertai tingkat keyakinan (data sedikit / video terlalu baru).

import { VideoItem } from '../types';
import { analyzeTitleScore } from './titleScoreService';

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';
export type Confidence = 'tinggi' | 'sedang' | 'rendah';

export interface ScoreComponent {
  key: 'reach' | 'engagement' | 'text' | 'technical';
  label: string;
  /** Nilai komponen 0–100 */
  value: number;
  /** Bobot efektif (sudah dinormalisasi, total = 100) */
  weight: number;
  /** Kontribusi ke skor total = value × weight / 100 */
  points: number;
  detail: string;
}

export interface PerformanceScore {
  totalScore: number;
  grade: Grade;
  components: ScoreComponent[];
  confidence: Confidence;
  confidenceNote?: string;
}

export interface VideoMetrics {
  cohort: 'Shorts' | 'Video' | 'Semua';
  cohortSize: number;
  ageDays: number;
  viewsPerDay: number;
  /** Rasio views terhadap perkiraan views video seusia di kelompok yang sama (1 = sesuai) */
  reachRatio: number;
  reachPercentile: number;
  engagementRate: number | null;
  engagementPercentile: number | null;
  textScore: number;
}

export interface VideoWithScores extends VideoItem {
  titleScore: PerformanceScore;
  thumbnailScore: PerformanceScore;
  metrics: VideoMetrics;
}

export const SCORE_MODEL = {
  version: 2,
  title: { reach: 45, engagement: 15, text: 40 },
  thumbnail: { reach: 70, engagement: 15, technical: 15 },
  grades: { A: 80, B: 65, C: 50, D: 35 },
  erPseudoViews: 1000,
  minCohort: 5,
  /** Konstanta kurva pertumbuhan views g(t) = t / (t + τ), dalam hari */
  growthTauDays: { video: 7, shorts: 4 },
} as const;

const DAY_MS = 86400000;

export const gradeFromScore = (score: number): Grade =>
  score >= SCORE_MODEL.grades.A ? 'A' : score >= SCORE_MODEL.grades.B ? 'B' : score >= SCORE_MODEL.grades.C ? 'C' : score >= SCORE_MODEL.grades.D ? 'D' : 'F';

/** Persentil mid-rank (0–100) dari `value` dalam array terurut naik. */
export const midRankPercentile = (value: number, sorted: number[]): number => {
  const n = sorted.length;
  if (n === 0) return 50;
  if (n === 1) return 50;
  const lower = (target: number, strict: boolean) => {
    let lo = 0;
    let hi = n;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (strict ? sorted[mid] < target : sorted[mid] <= target) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  const below = lower(value, true);
  const equal = lower(value, false) - below;
  return Math.round(((below + equal / 2) / n) * 100);
};

const medianOf = (nums: number[]) => {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Porsi views "jangka panjang" yang biasanya sudah dicapai video berumur t hari. */
export const growthFraction = (ageDays: number, isShort: boolean) => {
  const tau = isShort ? SCORE_MODEL.growthTauDays.shorts : SCORE_MODEL.growthTauDays.video;
  return ageDays / (ageDays + tau);
};

const ageDaysOf = (v: VideoItem, now: number) => Math.max(1, (now - (new Date(v.publishedAt).getTime() || now)) / DAY_MS);

const combine = (parts: Array<Omit<ScoreComponent, 'weight' | 'points'> & { baseWeight: number; available: boolean }>) => {
  const active = parts.filter(p => p.available);
  const totalWeight = active.reduce((s, p) => s + p.baseWeight, 0) || 1;
  const components: ScoreComponent[] = active.map(p => {
    const weight = (p.baseWeight / totalWeight) * 100;
    return { key: p.key, label: p.label, value: Math.round(p.value), detail: p.detail, weight: Math.round(weight), points: (p.value * weight) / 100 };
  });
  const totalScore = Math.round(components.reduce((s, c) => s + c.points, 0));
  components.forEach(c => (c.points = Math.round(c.points)));
  return { totalScore, grade: gradeFromScore(totalScore), components };
};

const describeRatio = (ratio: number) => {
  if (ratio >= 1.05) return `${ratio.toFixed(ratio >= 10 ? 0 : 1)}× video seusia`;
  if (ratio <= 0.95) return `${Math.round(ratio * 100)}% dari video seusia`;
  return 'Setara video seusia';
};

/** Hitung skor untuk seluruh daftar (O(n log n)). */
export const calculateAllVideoScores = (videos: VideoItem[], now = Date.now()): VideoWithScores[] => {
  if (!videos.length) return [];

  const shorts = videos.filter(v => v.isShort);
  const longs = videos.filter(v => !v.isShort);
  const cohortOf = (v: VideoItem): { name: VideoMetrics['cohort']; members: VideoItem[] } => {
    const own = v.isShort ? shorts : longs;
    return own.length >= SCORE_MODEL.minCohort ? { name: v.isShort ? 'Shorts' : 'Video', members: own } : { name: 'Semua', members: videos };
  };

  // Statistik per kelompok (dihitung sekali)
  type CohortStats = {
    baseline: number;
    residualsSorted: number[];
    erSorted: number[];
    priorEr: number;
  };
  const cache = new Map<VideoItem[], CohortStats>();
  const smoothedEr = (v: VideoItem, prior: number) =>
    ((v.likeCountRaw + v.commentCountRaw + SCORE_MODEL.erPseudoViews * prior) / (v.viewCountRaw + SCORE_MODEL.erPseudoViews)) * 100;
  const statsFor = (members: VideoItem[]): CohortStats => {
    const hit = cache.get(members);
    if (hit) return hit;
    // Baseline = median views yang "dinormalisasi umur"; residual = log rasio terhadap perkiraan
    const baseline = Math.max(1, medianOf(members.map(v => (v.viewCountRaw + 1) / growthFraction(ageDaysOf(v, now), v.isShort))));
    const residualsSorted = members
      .map(v => Math.log10((v.viewCountRaw + 1) / (baseline * growthFraction(ageDaysOf(v, now), v.isShort))))
      .sort((a, b) => a - b);
    const visible = members.filter(v => !v.likesHidden && v.viewCountRaw > 0);
    const priorEr = medianOf(visible.map(v => (v.likeCountRaw + v.commentCountRaw) / v.viewCountRaw));
    const erSorted = visible.map(v => smoothedEr(v, priorEr)).sort((a, b) => a - b);
    const stats = { baseline, residualsSorted, erSorted, priorEr };
    cache.set(members, stats);
    return stats;
  };

  return videos.map(video => {
    const { name: cohortName, members } = cohortOf(video);
    const stats = statsFor(members);
    const ageDays = ageDaysOf(video, now);
    const expected = stats.baseline * growthFraction(ageDays, video.isShort);
    const residual = Math.log10((video.viewCountRaw + 1) / expected);
    const reachPercentile = midRankPercentile(residual, stats.residualsSorted);
    const reachRatio = 10 ** residual;

    const erAvailable = !video.likesHidden && video.viewCountRaw > 0 && stats.erSorted.length >= 3;
    const er = erAvailable ? smoothedEr(video, stats.priorEr) : null;
    const engagementPercentile = er !== null ? midRankPercentile(er, stats.erSorted) : null;

    const text = analyzeTitleScore(video.title, { isShort: video.isShort });

    // Keyakinan
    let confidence: Confidence = 'tinggi';
    let confidenceNote: string | undefined;
    if (ageDays < 2 || video.viewCountRaw < 100) {
      confidence = 'rendah';
      confidenceNote = ageDays < 2 ? 'Video < 2 hari — views belum stabil' : 'Views < 100 — data belum cukup';
    } else if (members.length < 8 || cohortName === 'Semua') {
      confidence = 'sedang';
      confidenceNote = cohortName === 'Semua' ? `Kelompok ${video.isShort ? 'Shorts' : 'Video'} < ${SCORE_MODEL.minCohort} — dibandingkan dengan semua video` : 'Pembanding sedikit (< 8 video)';
    }

    const reachPart = {
      key: 'reach' as const,
      label: 'Jangkauan (vs video seusia)',
      value: reachPercentile,
      detail: `${describeRatio(reachRatio)} • ${Math.round(video.viewCountRaw / ageDays).toLocaleString('id-ID')} views/hari`,
      available: true,
    };
    const engagementPart = {
      key: 'engagement' as const,
      label: 'Engagement',
      value: engagementPercentile ?? 0,
      detail: video.likesHidden
        ? 'Like disembunyikan — tidak dinilai'
        : er !== null
          ? `ER ${er.toFixed(2)}% (dihaluskan) • persentil ${engagementPercentile}`
          : 'Data tidak cukup',
      available: engagementPercentile !== null,
    };

    const titleScore = combine([
      { ...reachPart, baseWeight: SCORE_MODEL.title.reach },
      { ...engagementPart, baseWeight: SCORE_MODEL.title.engagement },
      {
        key: 'text',
        label: 'Kualitas teks judul',
        value: text.totalScore,
        detail: text.suggestions[0] ?? 'Judul sudah rapi dan jelas',
        available: true,
        baseWeight: SCORE_MODEL.title.text,
      },
    ]);

    // Thumbnail: Shorts jarang punya maxres, jadi komponen teknis hanya dinilai untuk video panjang
    const technicalAvailable = !video.isShort && typeof video.thumbnailHd === 'boolean';
    const thumbnailScore = combine([
      { ...reachPart, label: 'Daya klik (jangkauan vs video seusia)', baseWeight: SCORE_MODEL.thumbnail.reach },
      { ...engagementPart, label: 'Kesesuaian dengan isi (engagement)', baseWeight: SCORE_MODEL.thumbnail.engagement },
      {
        key: 'technical',
        label: 'Kualitas teknis',
        value: video.thumbnailHd ? 100 : 30,
        detail: video.thumbnailHd ? 'Thumbnail HD 1280×720 tersedia' : 'Tidak ada versi HD 1280×720 — unggah thumbnail kustom HD',
        available: technicalAvailable,
        baseWeight: SCORE_MODEL.thumbnail.technical,
      },
    ]);

    return {
      ...video,
      titleScore: { ...titleScore, confidence, confidenceNote },
      thumbnailScore: { ...thumbnailScore, confidence, confidenceNote },
      metrics: {
        cohort: cohortName,
        cohortSize: members.length,
        ageDays,
        viewsPerDay: video.viewCountRaw / ageDays,
        reachRatio,
        reachPercentile,
        engagementRate: er,
        engagementPercentile,
        textScore: text.totalScore,
      },
    };
  });
};

export const getAverageScores = (scored: VideoWithScores[]): { avgTitleScore: number; avgThumbnailScore: number } => {
  if (!scored.length) return { avgTitleScore: 0, avgThumbnailScore: 0 };
  const avg = (f: (v: VideoWithScores) => number) => Math.round(scored.reduce((s, v) => s + f(v), 0) / scored.length);
  return { avgTitleScore: avg(v => v.titleScore.totalScore), avgThumbnailScore: avg(v => v.thumbnailScore.totalScore) };
};

export const getGradeDistribution = (scores: PerformanceScore[]): Record<Grade, number> => {
  const distribution: Record<Grade, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  scores.forEach(s => distribution[s.grade]++);
  return distribution;
};
