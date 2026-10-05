import { describe, it, expect } from 'vitest';
import {
  resolvePeriod,
  filterByPeriod,
  previousPeriod,
  periodDays,
  periodCoverage,
  formatPeriodRange,
  isPeriodId,
} from '../lib/period';

const now = new Date(2026, 9, 5, 12, 0, 0); // 5 Okt 2026 12:00 lokal
const daysAgo = (d: number) => ({ publishedAt: new Date(now.getTime() - d * 86400000).toISOString() });

describe('period', () => {
  const videos = [daysAgo(0.5), daysAgo(2), daysAgo(5), daysAgo(10), daysAgo(40), daysAgo(100), daysAgo(400)];

  it('filters by rolling day windows', () => {
    expect(filterByPeriod(videos, resolvePeriod('1d', now))).toHaveLength(1);
    expect(filterByPeriod(videos, resolvePeriod('3d', now))).toHaveLength(2);
    expect(filterByPeriod(videos, resolvePeriod('7d', now))).toHaveLength(3);
    expect(filterByPeriod(videos, resolvePeriod('28d', now))).toHaveLength(4);
    expect(filterByPeriod(videos, resolvePeriod('all', now))).toHaveLength(7);
  });

  it('uses calendar months and year-to-date', () => {
    const m1 = resolvePeriod('1m', now);
    expect(m1.start?.getMonth()).toBe(8);
    expect(m1.start?.getDate()).toBe(5);
    expect(filterByPeriod(videos, resolvePeriod('3m', now))).toHaveLength(5);
    expect(filterByPeriod(videos, resolvePeriod('1y', now))).toHaveLength(6);
    const ytd = resolvePeriod('ytd', now);
    expect(ytd.start).toEqual(new Date(2026, 0, 1));
  });

  it('custom range covers whole days and swaps reversed input', () => {
    const r = resolvePeriod('custom', now, { from: '2026-09-30', to: '2026-10-03' });
    expect(r.start).toEqual(new Date(2026, 8, 30));
    expect(r.end).toEqual(new Date(2026, 9, 3, 23, 59, 59, 999));
    expect(filterByPeriod(videos, r)).toHaveLength(2); // 3 Okt & 30 Sep
    const swapped = resolvePeriod('custom', now, { from: '2026-10-03', to: '2026-09-30' });
    expect(swapped.start).toEqual(r.start);
    expect(swapped.end).toEqual(r.end);
  });

  it('previous period has the same length and does not overlap', () => {
    const r = resolvePeriod('7d', now);
    const p = previousPeriod(r)!;
    expect(p.end.getTime()).toBe(r.start!.getTime() - 1);
    expect(p.end.getTime() - p.start!.getTime()).toBe(r.end.getTime() - r.start!.getTime());
    expect(filterByPeriod(videos, p)).toHaveLength(1); // 10 hari lalu
    expect(previousPeriod(resolvePeriod('all', now))).toBeNull();
  });

  it('computes period length in days', () => {
    expect(periodDays(resolvePeriod('7d', now), videos)).toBeCloseTo(7);
    expect(periodDays(resolvePeriod('all', now), videos)).toBeCloseTo(399.5);
  });

  it('flags incomplete coverage when older uploads were not loaded', () => {
    const loaded = videos.slice(0, 4); // tertua 10 hari lalu
    expect(periodCoverage(resolvePeriod('7d', now), loaded, 50).complete).toBe(true);
    expect(periodCoverage(resolvePeriod('28d', now), loaded, 50).complete).toBe(false);
    expect(periodCoverage(resolvePeriod('all', now), loaded, 50).complete).toBe(false);
    expect(periodCoverage(resolvePeriod('28d', now), loaded, 4).complete).toBe(true);
    expect(periodCoverage(resolvePeriod('28d', now), loaded).complete).toBe(true);
  });

  it('formats ranges and validates ids', () => {
    expect(formatPeriodRange(resolvePeriod('custom', now, { from: '2026-09-28', to: '2026-10-05' }))).toMatch(/28 Sep.*5 Okt 2026/);
    expect(isPeriodId('3d')).toBe(true);
    expect(isPeriodId('5d')).toBe(false);
  });
});
