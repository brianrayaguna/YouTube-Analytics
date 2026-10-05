import React, { useMemo, useState } from 'react';
import { Lightbulb, TrendingUp, TrendingDown, Globe } from 'lucide-react';
import { VideoItem } from '../types';
import { PageHeader, StatCard, SectionCard } from './common';
import { formatNumber } from '../lib/format';
import { cn } from '@/lib/utils';

interface UploadScheduleAnalyzerProps {
  videos: VideoItem[];
}

interface Cell {
  day: number;
  hour: number;
  count: number;
  totalViews: number;
  avgViews: number;
}

const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const DAYS_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
// Senin di atas, seperti kalender Indonesia
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const formatHour = (h: number) => `${h.toString().padStart(2, '0')}.00`;

type Metric = 'views' | 'count';

const UploadScheduleAnalyzer: React.FC<UploadScheduleAnalyzerProps> = ({ videos }) => {
  const [metric, setMetric] = useState<Metric>('views');
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const analysis = useMemo(() => {
    const grid: Cell[][] = DAYS.map((_, day) => HOURS.map(hour => ({ day, hour, count: 0, totalViews: 0, avgViews: 0 })));
    const byDay = DAYS.map(() => ({ count: 0, views: 0 }));
    const byHour = HOURS.map(() => ({ count: 0, views: 0 }));
    const times: number[] = [];

    videos.forEach(v => {
      const date = new Date(v.publishedAt);
      if (Number.isNaN(date.getTime())) return;
      const d = date.getDay();
      const h = date.getHours();
      grid[d][h].count++;
      grid[d][h].totalViews += v.viewCountRaw;
      byDay[d].count++;
      byDay[d].views += v.viewCountRaw;
      byHour[h].count++;
      byHour[h].views += v.viewCountRaw;
      times.push(date.getTime());
    });

    const cells = grid.flat();
    cells.forEach(c => (c.avgViews = c.count ? c.totalViews / c.count : 0));
    const active = cells.filter(c => c.count > 0);
    // Slot dengan ≥2 upload lebih bisa dipercaya; fallback ke semua slot bila datanya sedikit
    const reliable = active.filter(c => c.count >= 2).length >= 3 ? active.filter(c => c.count >= 2) : active;
    const ranked = [...reliable].sort((a, b) => b.avgViews - a.avgViews);
    const best = ranked.slice(0, 3);
    const worst = ranked.length > 3 ? ranked.slice(-3).reverse() : [];

    const dayAvg = byDay.map((d, i) => ({ day: i, count: d.count, avg: d.count ? d.views / d.count : 0 }));
    const hourAvg = byHour.map((h, i) => ({ hour: i, count: h.count, avg: h.count ? h.views / h.count : 0 }));
    const bestDay = [...dayAvg].filter(d => d.count).sort((a, b) => b.avg - a.avg)[0];
    const bestHour = [...hourAvg].filter(h => h.count).sort((a, b) => b.avg - a.avg)[0];
    const busiestDay = [...dayAvg].sort((a, b) => b.count - a.count)[0];

    const spanWeeks = times.length > 1 ? (Math.max(...times) - Math.min(...times)) / (7 * 86400000) : 0;

    return {
      grid,
      maxCount: Math.max(1, ...cells.map(c => c.count)),
      maxAvg: Math.max(1, ...cells.map(c => c.avgViews)),
      best,
      worst,
      dayAvg,
      hourAvg,
      bestDay,
      bestHour,
      busiestDay,
      uploadsPerWeek: spanWeeks >= 1 ? videos.length / spanWeeks : videos.length,
    };
  }, [videos]);

  const intensity = (c: Cell) => {
    if (!c.count) return 0;
    return metric === 'views' ? Math.sqrt(c.avgViews / analysis.maxAvg) : c.count / analysis.maxCount;
  };

  const maxDayAvg = Math.max(1, ...analysis.dayAvg.map(d => d.avg));
  const maxHourAvg = Math.max(1, ...analysis.hourAvg.map(h => h.avg));

  return (
    <div>
      <PageHeader
        title="Jadwal Upload"
        subtitle={
          <span className="inline-flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5" /> Waktu ditampilkan dalam zona waktu Anda ({timeZone})
          </span>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Video dianalisis" value={videos.length.toLocaleString('id-ID')} />
        <StatCard label="Upload / minggu" value={analysis.uploadsPerWeek.toFixed(1)} hint={analysis.busiestDay?.count ? `Paling sering: ${DAYS[analysis.busiestDay.day]}` : undefined} />
        <StatCard label="Hari terbaik" value={analysis.bestDay ? DAYS[analysis.bestDay.day] : '-'} accent="blue" hint={analysis.bestDay ? `${formatNumber(analysis.bestDay.avg)} rata-rata views` : undefined} />
        <StatCard label="Jam terbaik" value={analysis.bestHour ? formatHour(analysis.bestHour.hour) : '-'} accent="blue" hint={analysis.bestHour ? `${formatNumber(analysis.bestHour.avg)} rata-rata views` : undefined} />
      </div>

      <SectionCard
        className="mt-6"
        title="Peta panas upload"
        description={metric === 'views' ? 'Warna = rata-rata views video yang diupload di slot tersebut' : 'Warna = jumlah video yang diupload'}
        actions={
          <div className="flex gap-2">
            <button type="button" className="yt-chip" data-active={metric === 'views'} onClick={() => setMetric('views')}>
              Rata-rata views
            </button>
            <button type="button" className="yt-chip" data-active={metric === 'count'} onClick={() => setMetric('count')}>
              Jumlah upload
            </button>
          </div>
        }
      >
        <div className="-mx-4 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
          <div className="grid min-w-[640px] grid-cols-[44px_repeat(24,minmax(0,1fr))] gap-[3px]">
            <div />
            {HOURS.map(h => (
              <div key={h} className="text-center text-[10px] text-muted-foreground">
                {h % 3 === 0 ? h.toString().padStart(2, '0') : ''}
              </div>
            ))}
            {DAY_ORDER.map(d => (
              <React.Fragment key={d}>
                <div className="flex items-center text-xs text-muted-foreground">{DAYS_SHORT[d]}</div>
                {HOURS.map(h => {
                  const cell = analysis.grid[d][h];
                  const level = intensity(cell);
                  return (
                    <div
                      key={h}
                      className={cn('aspect-square rounded-[3px]', cell.count ? '' : 'bg-secondary')}
                      style={cell.count ? { backgroundColor: `hsl(var(--primary) / ${0.15 + level * 0.85})` } : undefined}
                      title={`${DAYS[d]} ${formatHour(h)} — ${cell.count} video${cell.count ? `, rata-rata ${formatNumber(cell.avgViews)} views` : ''}`}
                    />
                  );
                })}
              </React.Fragment>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <span>Rendah</span>
            {[0.15, 0.35, 0.55, 0.75, 1].map(o => (
              <span key={o} className="h-3 w-3 rounded-[3px]" style={{ backgroundColor: `hsl(var(--primary) / ${o})` }} />
            ))}
            <span>Tinggi</span>
          </div>
        </div>
      </SectionCard>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <SectionCard title="Rata-rata views per hari">
          <ul className="space-y-2.5">
            {DAY_ORDER.map(d => {
              const row = analysis.dayAvg[d];
              return (
                <li key={d} className="grid grid-cols-[64px_1fr_72px] items-center gap-3 text-sm">
                  <span className="text-muted-foreground">{DAYS[d]}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-secondary">
                    <span className={cn('block h-full rounded-full', analysis.bestDay?.day === d ? 'bg-youtube-red' : 'bg-primary')} style={{ width: `${(row.avg / maxDayAvg) * 100}%` }} />
                  </span>
                  <span className="text-right tabular-nums text-foreground">{row.count ? formatNumber(row.avg) : '-'}</span>
                </li>
              );
            })}
          </ul>
        </SectionCard>

        <SectionCard title="Rata-rata views per jam">
          <div className="flex h-40 items-end gap-[3px]">
            {analysis.hourAvg.map(h => (
              <div
                key={h.hour}
                className={cn('flex-1 rounded-t-sm', h.count ? (analysis.bestHour?.hour === h.hour ? 'bg-youtube-red' : 'bg-primary') : 'bg-secondary')}
                style={{ height: `${h.count ? Math.max(4, (h.avg / maxHourAvg) * 100) : 4}%` }}
                title={`${formatHour(h.hour)} — ${h.count} video, ${formatNumber(h.avg)} rata-rata views`}
              />
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
            <span>00.00</span>
            <span>06.00</span>
            <span>12.00</span>
            <span>18.00</span>
            <span>23.00</span>
          </div>
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <SectionCard title="Slot dengan performa terbaik">
          <SlotList slots={analysis.best} tone="good" />
        </SectionCard>
        <SectionCard title="Slot dengan performa terendah">
          {analysis.worst.length ? <SlotList slots={analysis.worst} tone="bad" /> : <p className="text-sm text-muted-foreground">Data belum cukup.</p>}
        </SectionCard>
      </div>

      {analysis.best[0] && (
        <div className="mt-6 flex items-start gap-4 rounded-xl bg-primary/10 p-4 sm:p-5">
          <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p className="text-sm leading-6 text-foreground">
            Video yang diupload hari <b>{DAYS[analysis.best[0].day]}</b> sekitar pukul <b>{formatHour(analysis.best[0].hour)}</b> mendapat rata-rata{' '}
            <b>{formatNumber(analysis.best[0].avgViews)} views</b>. Uji jadwal ini beberapa kali sebelum menjadikannya patokan — performa juga
            dipengaruhi topik dan umur video.
          </p>
        </div>
      )}
    </div>
  );
};

const SlotList: React.FC<{ slots: Cell[]; tone: 'good' | 'bad' }> = ({ slots, tone }) => (
  <ul className="divide-y divide-border">
    {slots.map((s, i) => (
      <li key={`${s.day}-${s.hour}`} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
        <span
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium',
            tone === 'good' ? 'bg-success/15 text-success' : 'bg-destructive/10 text-destructive'
          )}
        >
          {tone === 'good' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">
            {i + 1}. {DAYS[s.day]}, {formatHour(s.hour)}
          </p>
          <p className="text-xs text-muted-foreground">{s.count} upload</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium tabular-nums text-foreground">{formatNumber(s.avgViews)}</p>
          <p className="text-[11px] text-muted-foreground">rata-rata views</p>
        </div>
      </li>
    ))}
  </ul>
);

export default UploadScheduleAnalyzer;
