import React, { useMemo, useState } from 'react';
import { Loader2, Swords, Crown, ArrowLeftRight } from 'lucide-react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { ChannelStats, VideoItem } from '../types';
import { fetchChannelInfo, fetchChannelUploads, resolveChannelId } from '../services/youtubeService';
import { PageHeader, SectionCard, EmptyState } from './common';
import { ChannelAvatar } from './VideoCard';
import { formatNumber, median } from '../lib/format';
import { cn } from '@/lib/utils';

interface BenchmarkProps {
  apiKey: string;
  onRequireApiKey: () => void;
  defaultChannel?: string;
}

interface ChannelData {
  stats: ChannelStats;
  videos: VideoItem[];
  uploadFrequency: number;
  avgEngagementRate: number;
  avgViews: number;
  medianViews: number;
  shortsShare: number;
  topTags: string[];
}

interface ComparisonResult {
  a: ChannelData;
  b: ChannelData;
  tagOverlap: string[];
  uniqueA: string[];
  uniqueB: string[];
}

const SAMPLE_SIZE = 30;
const COLOR_A = 'hsl(var(--primary))';
const COLOR_B = 'hsl(var(--yt-red))';

const buildChannelData = (stats: ChannelStats, videos: VideoItem[]): ChannelData => {
  const times = videos.map(v => new Date(v.publishedAt).getTime()).filter(Boolean);
  const weeks = times.length > 1 ? (Math.max(...times) - Math.min(...times)) / (7 * 86400000) : 0;
  const tagCounts = new Map<string, number>();
  videos.forEach(v => v.tags.forEach(t => tagCounts.set(t.toLowerCase(), (tagCounts.get(t.toLowerCase()) || 0) + 1)));
  const views = videos.map(v => v.viewCountRaw);
  return {
    stats,
    videos,
    uploadFrequency: weeks > 0 ? videos.length / weeks : 0,
    avgEngagementRate: videos.length ? videos.reduce((s, v) => s + v.engagementRate, 0) / videos.length : 0,
    avgViews: views.length ? views.reduce((a, b) => a + b, 0) / views.length : 0,
    medianViews: median(views),
    shortsShare: videos.length ? (videos.filter(v => v.isShort).length / videos.length) * 100 : 0,
    topTags: Array.from(tagCounts.entries())
      .sort((x, y) => y[1] - x[1])
      .slice(0, 25)
      .map(([t]) => t),
  };
};

const CompetitorBenchmark: React.FC<BenchmarkProps> = ({ apiKey, onRequireApiKey, defaultChannel }) => {
  const [queryA, setQueryA] = useState(defaultChannel ?? '');
  const [queryB, setQueryB] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCompare = async () => {
    if (!apiKey) {
      onRequireApiKey();
      setError('Atur API Key terlebih dahulu.');
      return;
    }
    if (!queryA.trim() || !queryB.trim()) {
      setError('Isi kedua channel (ID, @handle, atau URL).');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [idA, idB] = await Promise.all([resolveChannelId(apiKey, queryA), resolveChannelId(apiKey, queryB)]);
      if (idA === idB) throw new Error('Kedua input mengarah ke channel yang sama.');
      const [statsA, statsB, videosA, videosB] = await Promise.all([
        fetchChannelInfo(apiKey, idA),
        fetchChannelInfo(apiKey, idB),
        fetchChannelUploads(apiKey, idA, SAMPLE_SIZE),
        fetchChannelUploads(apiKey, idB, SAMPLE_SIZE),
      ]);
      if (!statsA || !statsB) throw new Error('Gagal mengambil statistik channel.');
      const a = buildChannelData(statsA, videosA);
      const b = buildChannelData(statsB, videosB);
      const setB = new Set(b.topTags);
      const setA = new Set(a.topTags);
      setResult({
        a,
        b,
        tagOverlap: a.topTags.filter(t => setB.has(t)),
        uniqueA: a.topTags.filter(t => !setB.has(t)),
        uniqueB: b.topTags.filter(t => !setA.has(t)),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membandingkan channel');
    } finally {
      setLoading(false);
    }
  };

  const rows = useMemo(() => {
    if (!result) return [];
    const { a, b } = result;
    return [
      { label: 'Subscriber', a: a.stats.subCountRaw, b: b.stats.subCountRaw, fmt: formatNumber },
      { label: 'Total views', a: a.stats.viewCountRaw ?? 0, b: b.stats.viewCountRaw ?? 0, fmt: formatNumber },
      { label: 'Jumlah video', a: a.stats.videoCountRaw ?? 0, b: b.stats.videoCountRaw ?? 0, fmt: (n: number) => n.toLocaleString('id-ID') },
      { label: `Rata-rata views (${SAMPLE_SIZE} terbaru)`, a: a.avgViews, b: b.avgViews, fmt: formatNumber },
      { label: 'Median views', a: a.medianViews, b: b.medianViews, fmt: formatNumber },
      { label: 'Engagement rate', a: a.avgEngagementRate, b: b.avgEngagementRate, fmt: (n: number) => `${n.toFixed(2)}%` },
      { label: 'Upload / minggu', a: a.uploadFrequency, b: b.uploadFrequency, fmt: (n: number) => n.toFixed(1) },
      {
        label: 'Views per subscriber',
        a: a.stats.subCountRaw ? a.avgViews / a.stats.subCountRaw : 0,
        b: b.stats.subCountRaw ? b.avgViews / b.stats.subCountRaw : 0,
        fmt: (n: number) => `${(n * 100).toFixed(1)}%`,
      },
    ];
  }, [result]);

  const radarData = useMemo(
    () =>
      rows
        .filter(r => r.label !== 'Median views')
        .map(r => {
          const max = Math.max(r.a, r.b) || 1;
          return { metric: r.label.replace(` (${SAMPLE_SIZE} terbaru)`, ''), A: (r.a / max) * 100, B: (r.b / max) * 100 };
        }),
    [rows]
  );

  const nameA = result?.a.stats.title || 'Channel A';
  const nameB = result?.b.stats.title || 'Channel B';
  const winsA = rows.filter(r => r.a > r.b).length;
  const winsB = rows.filter(r => r.b > r.a).length;

  return (
    <div>
      <PageHeader title="Benchmark Kompetitor" subtitle={`Bandingkan dua channel berdasarkan statistik dan ${SAMPLE_SIZE} video terbaru.`} />

      <form
        className="yt-card flex flex-col gap-3 p-4 md:flex-row md:items-center"
        onSubmit={e => {
          e.preventDefault();
          handleCompare();
        }}
      >
        <div className="flex flex-1 items-center gap-2">
          <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: COLOR_A }} />
          <input value={queryA} onChange={e => setQueryA(e.target.value)} placeholder="Channel A — @handle, ID, atau URL" className="yt-input" />
        </div>
        <button
          type="button"
          onClick={() => {
            setQueryA(queryB);
            setQueryB(queryA);
          }}
          className="yt-icon-btn self-center"
          aria-label="Tukar channel"
          title="Tukar"
        >
          <ArrowLeftRight className="h-5 w-5" strokeWidth={1.75} />
        </button>
        <div className="flex flex-1 items-center gap-2">
          <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: COLOR_B }} />
          <input value={queryB} onChange={e => setQueryB(e.target.value)} placeholder="Channel B — @handle, ID, atau URL" className="yt-input" />
        </div>
        <button type="submit" disabled={loading} className="yt-pill-blue">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? 'Membandingkan…' : 'Bandingkan'}
        </button>
      </form>

      {error && <p className="mt-3 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

      {!result && !loading && (
        <EmptyState
          icon={Swords}
          title="Bandingkan dua channel"
          description="Lihat siapa yang unggul dalam subscriber, views, engagement, dan frekuensi upload, plus tag yang sama-sama dipakai."
        />
      )}

      {result && (
        <div className="mt-6 space-y-6">
          <div className="yt-card p-4 sm:p-6">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
              {[result.a, result.b].map((ch, idx) => (
                <div key={idx} className={cn('flex flex-col items-center text-center', idx === 1 && 'col-start-3')}>
                  <div className="relative">
                    <ChannelAvatar name={ch.stats.title || ''} src={ch.stats.avatar} size={80} className="border-4" />
                    <span className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-card" style={{ backgroundColor: idx === 0 ? COLOR_A : COLOR_B }} />
                  </div>
                  <p className="mt-3 line-clamp-1 font-medium text-foreground">{ch.stats.title}</p>
                  <p className="text-xs text-muted-foreground">{ch.stats.customUrl}</p>
                </div>
              ))}
              <div className="col-start-2 row-start-1 flex flex-col items-center">
                <span className="text-3xl font-medium tabular-nums text-foreground">
                  {winsA}<span className="mx-2 text-muted-foreground">:</span>{winsB}
                </span>
                <span className="text-xs text-muted-foreground">metrik unggul</span>
              </div>
            </div>

            <div className="mt-6 divide-y divide-border">
              {rows.map(r => {
                const aWins = r.a > r.b;
                const bWins = r.b > r.a;
                return (
                  <div key={r.label} className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-3 text-sm">
                    <span className={cn('flex items-center justify-end gap-1.5 tabular-nums', aWins ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                      {aWins && <Crown className="h-4 w-4 text-warning" />}
                      {r.fmt(r.a)}
                    </span>
                    <span className="w-36 text-center text-xs text-muted-foreground sm:w-48">{r.label}</span>
                    <span className={cn('flex items-center gap-1.5 tabular-nums', bWins ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                      {r.fmt(r.b)}
                      {bWins && <Crown className="h-4 w-4 text-warning" />}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <SectionCard title="Profil performa" description="Nilai dinormalisasi: channel terbaik di tiap metrik = 100">
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius="72%">
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="metric" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                  <Radar name={nameA} dataKey="A" stroke={COLOR_A} fill={COLOR_A} fillOpacity={0.25} />
                  <Radar name={nameB} dataKey="B" stroke={COLOR_B} fill={COLOR_B} fillOpacity={0.2} />
                  <Tooltip
                    formatter={(v: number) => v.toFixed(0)}
                    contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

          <SectionCard title="Analisis tag" description={`Dari 25 tag teratas masing-masing channel`}>
            <div className="grid gap-6 md:grid-cols-3">
              {[
                { title: `Sama (${result.tagOverlap.length})`, tags: result.tagOverlap, cls: 'bg-secondary text-foreground' },
                { title: `Hanya ${nameA} (${result.uniqueA.length})`, tags: result.uniqueA, cls: 'bg-primary/10 text-primary' },
                { title: `Hanya ${nameB} (${result.uniqueB.length})`, tags: result.uniqueB, cls: 'bg-youtube-red/10 text-destructive' },
              ].map(col => (
                <div key={col.title}>
                  <h3 className="mb-3 line-clamp-1 text-sm font-medium text-foreground">{col.title}</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {col.tags.map(t => (
                      <span key={t} className={cn('rounded-md px-2 py-1 text-xs', col.cls)}>
                        {t}
                      </span>
                    ))}
                    {col.tags.length === 0 && <span className="text-sm text-muted-foreground">—</span>}
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  );
};

export default CompetitorBenchmark;
