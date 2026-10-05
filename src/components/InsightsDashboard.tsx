import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import { Eye, Users, Activity, Flame, Upload, Clapperboard, CalendarX2, Info, TriangleAlert } from 'lucide-react';
import { AnalyzedData, VideoItem } from '../types';
import { PageHeader, StatCard, SectionCard, StudioTabs, EmptyState } from './common';
import PeriodPicker from './PeriodPicker';
import { formatNumber, formatFullNumber, formatDate, median } from '../lib/format';
import {
  PeriodId,
  CustomPeriod,
  isPeriodId,
  resolvePeriod,
  filterByPeriod,
  previousPeriod,
  periodDays,
  periodCoverage,
  defaultCustomPeriod,
  formatPeriodRange,
} from '../lib/period';
import { cn } from '@/lib/utils';

interface InsightsProps {
  data: AnalyzedData;
  onPreview: (video: VideoItem) => void;
}

type Tab = 'overview' | 'content' | 'tags';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: 'Ringkasan' },
  { id: 'content', label: 'Konten' },
  { id: 'tags', label: 'Tag & SEO' },
];

const avg = (nums: number[]) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0);

const tooltipStyle = {
  backgroundColor: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  color: 'hsl(var(--popover-foreground))',
  fontSize: 12,
};

const PERIOD_KEY = 'yt_stats_period';
const CUSTOM_KEY = 'yt_stats_custom_period';

const loadPeriod = (): PeriodId => {
  try {
    const v = localStorage.getItem(PERIOD_KEY);
    return isPeriodId(v) ? v : 'all';
  } catch {
    return 'all';
  }
};

const loadCustom = (): CustomPeriod => {
  try {
    const c = JSON.parse(localStorage.getItem(CUSTOM_KEY) || 'null');
    if (c && typeof c.from === 'string' && typeof c.to === 'string') return c;
  } catch {
    // abaikan
  }
  return defaultCustomPeriod();
};

const save = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // abaikan
  }
};

/** Selisih terhadap periode sebelumnya ala Studio (▲/▼). */
const Delta: React.FC<{ value: number; suffix?: string; digits?: number }> = ({ value, suffix = '', digits = 0 }) => {
  const rounded = Number(value.toFixed(digits));
  if (rounded === 0) return <span>Sama dengan periode sebelumnya</span>;
  const up = rounded > 0;
  return (
    <span>
      <span className={cn('font-medium', up ? 'text-success' : 'text-destructive')}>
        {up ? '▲' : '▼'} {Math.abs(rounded).toLocaleString('id-ID', { maximumFractionDigits: digits })}
        {suffix}
      </span>{' '}
      vs periode sebelumnya
    </span>
  );
};

const InsightsDashboard: React.FC<InsightsProps> = ({ data, onPreview }) => {
  const [tab, setTab] = useState<Tab>('overview');
  const [contentSort, setContentSort] = useState<'views' | 'er' | 'recent'>('views');
  const [periodId, setPeriodId] = useState<PeriodId>(loadPeriod);
  const [custom, setCustom] = useState<CustomPeriod>(loadCustom);
  const allVideos = data.videos;
  const stats = data.channelStats;

  const changePeriod = (id: PeriodId) => {
    setPeriodId(id);
    save(PERIOD_KEY, id);
  };
  const changeCustom = (c: CustomPeriod) => {
    setCustom(c);
    save(CUSTOM_KEY, JSON.stringify(c));
  };

  const period = useMemo(() => {
    const range = resolvePeriod(periodId, new Date(), custom);
    const prev = previousPeriod(range);
    // Channel: hanya N upload terbaru yang dimuat — periksa apakah periode tercakup penuh
    const channelTotal = data.source === 'channel' ? stats?.videoCountRaw : undefined;
    const prevCoverage = prev ? periodCoverage(prev, allVideos, channelTotal) : null;
    return {
      range,
      videos: filterByPeriod(allVideos, range),
      prevVideos: prev && prevCoverage?.complete ? filterByPeriod(allVideos, prev) : null,
      coverage: periodCoverage(range, allVideos, channelTotal),
    };
  }, [periodId, custom, allVideos, data.source, stats?.videoCountRaw]);

  const videos = period.videos;

  const metrics = useMemo(() => {
    const views = videos.map(v => v.viewCountRaw);
    const longs = videos.filter(v => !v.isShort);
    const shorts = videos.filter(v => v.isShort);
    const days = periodDays(period.range, videos);
    const prev = period.prevVideos;
    return {
      totalViews: views.reduce((a, b) => a + b, 0),
      avgViews: avg(views),
      medianViews: median(views),
      avgER: avg(videos.map(v => v.engagementRate)),
      totalLikes: videos.reduce((a, v) => a + v.likeCountRaw, 0),
      totalComments: videos.reduce((a, v) => a + v.commentCountRaw, 0),
      outliers: videos.filter(v => v.isOutlier).length,
      uploadsPerWeek: days > 0 ? videos.length / (days / 7) : 0,
      uploadsDelta: prev ? videos.length - prev.length : null,
      erDelta: prev?.length && videos.length ? avg(videos.map(v => v.engagementRate)) - avg(prev.map(v => v.engagementRate)) : null,
      formats: [
        { label: 'Video', count: longs.length, avgViews: avg(longs.map(v => v.viewCountRaw)), avgER: avg(longs.map(v => v.engagementRate)) },
        { label: 'Shorts', count: shorts.length, avgViews: avg(shorts.map(v => v.viewCountRaw)), avgER: avg(shorts.map(v => v.engagementRate)) },
      ],
    };
  }, [videos, period.range, period.prevVideos]);

  // 50 video terbaru, urut kronologis
  const timeline = useMemo(
    () =>
      [...videos]
        .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
        .slice(0, 50)
        .reverse()
        .map(v => ({
          id: v.id,
          date: new Date(v.publishedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
          views: v.viewCountRaw,
          er: v.engagementRate,
          title: v.title,
          outlier: !!v.isOutlier,
        })),
    [videos]
  );

  const topContent = useMemo(() => {
    const list = [...videos];
    if (contentSort === 'views') list.sort((a, b) => b.viewCountRaw - a.viewCountRaw);
    else if (contentSort === 'er') list.sort((a, b) => b.engagementRate - a.engagementRate);
    else list.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    return list.slice(0, 25);
  }, [videos, contentSort]);

  const tagStats = useMemo(() => {
    const map = new Map<string, { tag: string; count: number; views: number }>();
    videos.forEach(v =>
      v.tags.forEach(raw => {
        const key = raw.toLowerCase().trim();
        if (!key) return;
        const entry = map.get(key) ?? { tag: raw, count: 0, views: 0 };
        entry.count += 1;
        entry.views += v.viewCountRaw;
        map.set(key, entry);
      })
    );
    const list = Array.from(map.values()).map(t => ({ ...t, avgViews: t.views / t.count }));
    const withTags = videos.filter(v => v.tags.length > 0).length;
    return {
      unique: list.length,
      top: list.sort((a, b) => b.count - a.count || b.avgViews - a.avgViews).slice(0, 40),
      coverage: videos.length ? (withTags / videos.length) * 100 : 0,
      avgTags: avg(videos.map(v => v.tags.length)),
      avgTitleLength: avg(videos.map(v => v.title.length)),
    };
  }, [videos]);

  const maxTagCount = tagStats.top[0]?.count ?? 1;

  const isAll = period.range.start === null;

  return (
    <div>
      <PageHeader
        title="Statistik Channel"
        subtitle={`${data.channelTitle ?? 'Hasil analisis'} • ${formatFullNumber(videos.length)}${
          isAll ? '' : ` dari ${formatFullNumber(allVideos.length)}`
        } video dianalisis`}
        actions={
          <PeriodPicker
            value={periodId}
            range={period.range}
            custom={custom}
            videos={allVideos}
            onChange={changePeriod}
            onCustomChange={changeCustom}
          />
        }
      />

      {!isAll && (
        <div className="-mt-3 mb-5 space-y-2 text-xs text-muted-foreground">
          <p className="flex items-start gap-2">
            <Info className="mt-px h-3.5 w-3.5 shrink-0" />
            Menampilkan video yang diupload pada periode ini. Views, likes, dan komentar adalah total sepanjang umur video
            (YouTube Data API tidak menyediakan statistik per tanggal).
          </p>
          {!period.coverage.complete && period.coverage.oldest && (
            <p className="flex items-start gap-2 text-warning">
              <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" />
              Data yang dimuat hanya berisi video sejak {formatDate(period.coverage.oldest.toISOString())}. Naikkan jumlah video
              yang dianalisis di Beranda agar periode ini terhitung lengkap.
            </p>
          )}
        </div>
      )}

      <StudioTabs<Tab> tabs={TABS} value={tab} onChange={setTab} />

      {videos.length === 0 ? (
        <EmptyState
          icon={CalendarX2}
          title="Tidak ada video di periode ini"
          description={`Tidak ada video yang diupload pada ${
            periodId === 'custom' ? formatPeriodRange(period.range) : period.range.label.toLowerCase()
          }. Pilih periode yang lebih panjang.`}
          action={
            <button type="button" className="yt-pill-primary" onClick={() => changePeriod('all')}>
              Tampilkan semua waktu
            </button>
          }
        />
      ) : (
        <>
          {tab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
                {stats && !stats.hiddenSubscriberCount && (
                  <StatCard label="Subscriber" value={stats.subscriberCount} icon={Users} hint={`${stats.viewCount} total views channel`} />
                )}
                <StatCard label={isAll ? 'Views (dianalisis)' : 'Views video periode ini'} value={formatNumber(metrics.totalViews)} icon={Eye} hint={`${formatNumber(metrics.totalLikes)} likes • ${formatNumber(metrics.totalComments)} komentar`} />
                <StatCard label="Rata-rata views" value={formatNumber(metrics.avgViews)} hint={`Median ${formatNumber(metrics.medianViews)}`} />
                <StatCard
                  label="Engagement rate"
                  value={`${metrics.avgER.toFixed(2)}%`}
                  icon={Activity}
                  accent={metrics.avgER >= 4 ? 'green' : 'default'}
                  hint={metrics.erDelta !== null ? <Delta value={metrics.erDelta} suffix=" poin" digits={2} /> : '(likes + komentar) / views'}
                />
                <StatCard label="Outlier" value={metrics.outliers} icon={Flame} accent={metrics.outliers ? 'red' : 'default'} hint="Views ≥ 3× median" />
                {isAll ? (
                  <StatCard label="Upload / minggu" value={metrics.uploadsPerWeek ? metrics.uploadsPerWeek.toFixed(1) : '-'} icon={Upload} hint="Rentang video dianalisis" />
                ) : (
                  <StatCard
                    label="Upload"
                    value={formatFullNumber(videos.length)}
                    icon={Upload}
                    hint={
                      metrics.uploadsDelta !== null ? (
                        <Delta value={metrics.uploadsDelta} suffix=" video" />
                      ) : (
                        `${metrics.uploadsPerWeek.toFixed(1)} / minggu`
                      )
                    }
                  />
                )}
              </div>

              <SectionCard title="Views per video" description={`Hingga 50 video terbaru${isAll ? '' : ' di periode ini'}, urut tanggal upload. Merah = outlier.`}>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={timeline} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={16} />
                      <YAxis tickFormatter={v => formatNumber(v)} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickLine={false} axisLine={false} width={56} />
                      <Tooltip
                        cursor={{ fill: 'hsl(var(--secondary))' }}
                        contentStyle={tooltipStyle}
                        formatter={(value: number) => [formatFullNumber(value), 'Views']}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.title ?? ''}
                      />
                      <Bar
                        dataKey="views"
                        maxBarSize={56}
                        radius={[4, 4, 0, 0]}
                        cursor="pointer"
                        onClick={(entry: { id?: string }) => {
                          const v = videos.find(x => x.id === entry?.id);
                          if (v) onPreview(v);
                        }}
                      >
                        {timeline.map(d => (
                          <Cell key={d.id} fill={d.outlier ? 'hsl(var(--yt-red))' : 'hsl(var(--primary))'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>

              <div className="grid gap-6 lg:grid-cols-2">
                <SectionCard title="Engagement rate per video" description="Tren ER dari waktu ke waktu">
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={timeline} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={16} />
                        <YAxis tickFormatter={v => `${v}%`} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} tickLine={false} axisLine={false} width={48} />
                        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v}%`, 'ER']} labelFormatter={(_, p) => p?.[0]?.payload?.title ?? ''} />
                        <Line type="monotone" dataKey="er" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </SectionCard>

                <SectionCard title="Format konten" description="Video panjang (> 3 menit) vs Shorts (≤ 3 menit)">
                  <div className="space-y-5">
                    {metrics.formats.map(f => {
                      const share = videos.length ? (f.count / videos.length) * 100 : 0;
                      return (
                        <div key={f.label}>
                          <div className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-2 font-medium text-foreground">
                              <Clapperboard className="h-4 w-4 text-muted-foreground" /> {f.label}
                            </span>
                            <span className="text-muted-foreground">
                              {f.count} video ({share.toFixed(0)}%)
                            </span>
                          </div>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
                            <div className={cn('h-full rounded-full', f.label === 'Shorts' ? 'bg-youtube-red' : 'bg-primary')} style={{ width: `${share}%` }} />
                          </div>
                          <div className="mt-2 flex gap-6 text-xs text-muted-foreground">
                            <span>
                              Rata-rata views <b className="font-medium text-foreground">{formatNumber(f.avgViews)}</b>
                            </span>
                            <span>
                              ER <b className="font-medium text-foreground">{f.avgER.toFixed(2)}%</b>
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </SectionCard>
              </div>
            </div>
          )}

          {tab === 'content' && (
            <SectionCard
              title="Konten teratas"
              description="Klik baris untuk memutar pratinjau"
              actions={
                <div className="flex gap-2">
                  {([
                    ['views', 'Views'],
                    ['er', 'ER'],
                    ['recent', 'Terbaru'],
                  ] as const).map(([id, label]) => (
                    <button key={id} type="button" className="yt-chip" data-active={contentSort === id} onClick={() => setContentSort(id)}>
                      {label}
                    </button>
                  ))}
                </div>
              }
            >
              <div className="-mx-4 overflow-x-auto sm:-mx-6">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="w-10 px-4 py-2 font-normal sm:pl-6">#</th>
                      <th className="px-2 py-2 font-normal">Video</th>
                      <th className="px-2 py-2 text-right font-normal">Views</th>
                      <th className="px-2 py-2 text-right font-normal">Likes</th>
                      <th className="px-2 py-2 text-right font-normal">ER</th>
                      <th className="px-4 py-2 text-right font-normal sm:pr-6">Tanggal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topContent.map((v, i) => (
                      <tr key={v.id} onClick={() => onPreview(v)} className="cursor-pointer border-b border-border last:border-0 hover:bg-secondary">
                        <td className="px-4 py-2 text-muted-foreground sm:pl-6">{i + 1}</td>
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-3">
                            <img src={v.thumbnail} alt="" loading="lazy" className="aspect-video w-24 shrink-0 rounded-lg bg-secondary object-cover" />
                            <div className="min-w-0">
                              <p className="line-clamp-2 font-medium text-foreground">{v.title}</p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {v.durationFormatted}
                                {v.isShort && ' • Shorts'}
                                {v.isOutlier && <span className="text-destructive"> • Outlier</span>}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-right font-medium tabular-nums">{formatNumber(v.viewCountRaw)}</td>
                        <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{formatNumber(v.likeCountRaw)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{v.engagementRate}%</td>
                        <td className="whitespace-nowrap px-4 py-2 text-right text-muted-foreground sm:pr-6">{formatDate(v.publishedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

          {tab === 'tags' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                <StatCard label="Video dengan tag" value={`${tagStats.coverage.toFixed(0)}%`} />
                <StatCard label="Rata-rata tag/video" value={tagStats.avgTags.toFixed(1)} />
                <StatCard label="Tag unik" value={formatFullNumber(tagStats.unique)} hint={tagStats.unique > 40 ? '40 teratas ditampilkan' : undefined} />
                <StatCard label="Panjang judul" value={`${tagStats.avgTitleLength.toFixed(0)}`} hint="karakter rata-rata (ideal 40–60)" />
              </div>
              <SectionCard title="Tag paling sering dipakai" description="Frekuensi dan rata-rata views video yang memakai tag tersebut">
                {tagStats.top.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Video tidak memiliki tag publik.</p>
                ) : (
                  <ul className="grid gap-x-8 gap-y-3 md:grid-cols-2">
                    {tagStats.top.map(t => (
                      <li key={t.tag}>
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="truncate font-medium text-foreground">{t.tag}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {t.count}× • {formatNumber(t.avgViews)} views
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${(t.count / maxTagCount) * 100}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </SectionCard>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default InsightsDashboard;
