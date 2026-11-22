import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createDemoChannelData } from '../data/demoChannel';
import { analyzeSchedule } from '../lib/schedule';
import { calculateAllVideoScores } from '../services/performanceScoreService';
import { estimateQuotaCost, getQuotaUsage, isAbortError, markOutliers, validateApiKey } from '../services/youtubeService';
import { TRENDING_REGIONS } from '../config/regions';

describe('demo channel dataset', () => {
  it('provides a complete offline channel with outliers, Shorts, schedule coverage and score variety', () => {
    const now = Date.UTC(2026, 9, 5, 12, 0, 0);
    const demo = createDemoChannelData(now);

    expect(demo.videos.length).toBeGreaterThanOrEqual(25);
    expect(demo.channelStats?.avatar.startsWith('data:image/svg+xml')).toBe(true);
    expect(demo.videos.every(v => v.thumbnail.startsWith('data:image/svg+xml'))).toBe(true);
    expect(demo.videos.some(v => v.isShort)).toBe(true);
    expect(demo.videos.some(v => !v.isShort)).toBe(true);
    expect(demo.videos.some(v => v.likesHidden)).toBe(true);

    const outliers = demo.videos.filter(v => v.isOutlier);
    expect(outliers.length).toBeGreaterThanOrEqual(2);
    expect(outliers.every(v => (v.outlierRatio ?? 0) >= 3)).toBe(true);

    const schedule = analyzeSchedule(demo.videos, now);
    expect(schedule.best.length).toBeGreaterThan(0);
    expect(schedule.bestDay).not.toBeNull();
    expect(schedule.busiestDay).not.toBeNull();

    const scored = calculateAllVideoScores(demo.videos, now);
    const grades = new Set(scored.map(v => v.titleScore.grade));
    expect(grades.size).toBeGreaterThanOrEqual(3);
  });
});

describe('markOutliers ratio', () => {
  it('populates outlierRatio relative to median views', () => {
    const now = Date.now();
    const base = createDemoChannelData(now).videos.slice(0, 5).map((v, i) => ({
      ...v,
      viewCountRaw: [100, 100, 100, 100, 420][i],
    }));
    const out = markOutliers(base);
    expect(out[4].isOutlier).toBe(true);
    expect(out[4].outlierRatio).toBe(4.2);
    expect(out[0].outlierRatio).toBe(1);
  });
});

describe('quota estimation & abort/network resilience', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('estimates unit costs accurately for channel, playlist, and keyword search', () => {
    expect(estimateQuotaCost('@creator', 50)).toBe(4);
    expect(estimateQuotaCost('https://www.youtube.com/playlist?list=PL123', 100)).toBe(5);
    expect(estimateQuotaCost('tutorial editing video', 100)).toBe(202);
    // Pencarian dibatasi 500 hasil (10 halaman × 101)
    expect(estimateQuotaCost('tutorial editing video', 5000)).toBe(1010);
  });

  it('does not track quota when fetch fails offline', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(validateApiKey('test-key')).rejects.toThrow(/Gagal terhubung/);
    expect(getQuotaUsage()).toBe(0);
  });

  it('propagates AbortError and skips quota tracking when already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const spy = vi.fn();
    globalThis.fetch = spy;

    try {
      await validateApiKey('test-key', controller.signal);
      expect.unreachable('should have aborted');
    } catch (err) {
      expect(isAbortError(err)).toBe(true);
    }
    expect(spy).not.toHaveBeenCalled();
    expect(getQuotaUsage()).toBe(0);
  });

  it('tracks quota only after a response resolves', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: [{ id: 'abc' }] }), { status: 200 }));
    await validateApiKey('test-key');
    expect(getQuotaUsage()).toBe(1);
  });
});

describe('shared regions configuration', () => {
  it('exports the full 14 trending regions list', () => {
    expect(TRENDING_REGIONS.length).toBe(14);
    expect(TRENDING_REGIONS.some(r => r.code === 'ID')).toBe(true);
  });
});
