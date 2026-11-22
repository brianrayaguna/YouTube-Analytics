import React, { useMemo, useState } from 'react';
import { Loader2, Lightbulb, Check, Copy, ChevronDown, Globe } from 'lucide-react';
import { VideoItem, ShowToast } from '../types';
import { analyzeContentGap, ContentGapResult } from '../services/contentGapService';
import { fetchTrendingVideos } from '../services/youtubeService';
import { copyToClipboard } from '../services/exportService';
import { TRENDING_REGIONS } from '../config/regions';
import { PageHeader, SectionCard, EmptyState } from './common';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

interface ContentGapAnalyzerProps {
  channelVideos: VideoItem[];
  channelTitle?: string;
  apiKey: string;
  onToast: ShowToast;
  onRequireApiKey: () => void;
}

const ContentGapAnalyzer: React.FC<ContentGapAnalyzerProps> = ({ channelVideos, channelTitle, apiKey, onToast, onRequireApiKey }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ContentGapResult | null>(null);
  const [region, setRegion] = useState('ID');
  const [analyzedRegion, setAnalyzedRegion] = useState<string | null>(null);

  const runAnalysis = async () => {
    if (!apiKey) {
      onToast('Atur API Key terlebih dahulu', 'error');
      onRequireApiKey();
      return;
    }
    setLoading(true);
    try {
      const trending = await fetchTrendingVideos(apiKey, 100, region);
      const analysis = analyzeContentGap(channelVideos, trending.videos);
      setResult(analysis);
      setAnalyzedRegion(region);
      onToast('Analisis content gap selesai', 'success');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Gagal menganalisis', 'error');
    } finally {
      setLoading(false);
    }
  };

  const copyIdeas = async () => {
    if (!result) return;
    try {
      await copyToClipboard(result.missingTopics.map(t => t.topic).join('\n'));
      onToast('Daftar topik disalin', 'success');
    } catch {
      onToast('Gagal menyalin', 'error');
    }
  };

  const trendingSet = useMemo(() => new Set(result?.trendingTopics ?? []), [result]);
  const selectedRegionName = TRENDING_REGIONS.find(r => r.code === region)?.name ?? region;
  const analyzedRegionName = TRENDING_REGIONS.find(r => r.code === analyzedRegion)?.name ?? analyzedRegion;
  const circumference = 2 * Math.PI * 40;

  return (
    <div>
      <PageHeader
        title="Content Gap"
        subtitle={`Bandingkan topik ${channelTitle ?? 'channel'} (${channelVideos.length} video) dengan video trending untuk menemukan ide konten.`}
        actions={
          <>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <button type="button" className="yt-pill" aria-label={`Wilayah trending: ${selectedRegionName}`}>
                  <Globe className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <span>{selectedRegionName}</span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-72 w-56 overflow-y-auto">
                {TRENDING_REGIONS.map(r => (
                  <DropdownMenuItem key={r.code} onSelect={() => setRegion(r.code)} className="gap-2.5 py-2">
                    <span className="w-4">{r.code === region && <Check className="h-4 w-4" />}</span>
                    <span>{r.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{r.code}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <button type="button" onClick={runAnalysis} disabled={loading} className="yt-pill-blue">
              {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {loading ? 'Menganalisis…' : result ? 'Analisis ulang' : 'Analisis gap'}
            </button>
          </>
        }
      />

      {!result ? (
        <EmptyState
          icon={Lightbulb}
          title="Temukan topik yang belum Anda garap"
          description="Kami mengambil 100 video trending di wilayah pilihan (±2 unit kuota), mengekstrak topik dari judul & tag, lalu membandingkannya dengan topik channel Anda."
          action={
            <button type="button" onClick={runAnalysis} disabled={loading} className="yt-pill-primary">
              {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Mulai analisis
            </button>
          }
        />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="yt-card flex items-center gap-5 p-5">
              <div className="relative h-24 w-24 shrink-0">
                <svg className="h-24 w-24 -rotate-90" viewBox="0 0 96 96" aria-hidden="true">
                  <circle cx="48" cy="48" r="40" strokeWidth="8" fill="none" className="stroke-secondary" />
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    strokeWidth="8"
                    fill="none"
                    strokeLinecap="round"
                    className="stroke-primary transition-[stroke-dasharray] duration-700"
                    strokeDasharray={`${(result.overlapPercentage / 100) * circumference} ${circumference}`}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-2xl font-semibold tabular-nums text-foreground">
                  {result.overlapPercentage}%
                </span>
              </div>
              <div>
                <p className="font-medium text-foreground">Cakupan tren</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Channel sudah membahas {result.overlapPercentage}% topik yang sedang trending di {analyzedRegionName}.
                </p>
              </div>
            </div>
            <div className="yt-card flex items-center gap-5 p-5">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-outlier/15">
                <span className="text-3xl font-semibold tabular-nums text-outlier">{result.missingTopics.length}</span>
              </div>
              <div>
                <p className="font-medium text-foreground">Peluang topik</p>
                <p className="mt-1 text-sm text-muted-foreground">Topik trending yang belum muncul di judul maupun tag channel.</p>
              </div>
            </div>
          </div>

          {result.recommendations.length === 0 ? (
            <SectionCard title="Rekomendasi">
              <p className="text-sm text-muted-foreground">
                Tidak ditemukan topik trending yang berulang di wilayah ini. Coba wilayah lain.
              </p>
            </SectionCard>
          ) : (
            <SectionCard
              title="Rekomendasi teratas"
              description="Diurutkan menurut frekuensi kemunculan dan rata-rata views video trending"
              actions={
                <button type="button" className="yt-pill" onClick={copyIdeas}>
                  <Copy className="h-4 w-4" aria-hidden="true" /> Salin topik
                </button>
              }
            >
              <ol className="divide-y divide-border">
                {result.recommendations.map((rec, i) => (
                  <li key={rec.topic} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-medium tabular-nums">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium capitalize text-foreground">{rec.topic}</p>
                      <p className="text-sm text-muted-foreground">{rec.reason}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-success/15 px-3 py-1 text-xs font-medium tabular-nums text-success">
                      {rec.potentialViews}
                    </span>
                  </li>
                ))}
              </ol>
            </SectionCard>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard title="Topik trending yang terlewat">
              <div className="flex flex-wrap gap-2">
                {result.missingTopics.map(t => (
                  <span key={t.topic} className="rounded-lg bg-secondary px-3 py-1.5 text-sm capitalize text-foreground" title={`Skor tren ${t.trendScore}`}>
                    {t.topic}
                  </span>
                ))}
                {result.missingTopics.length === 0 && <p className="text-sm text-muted-foreground">Tidak ada — channel sudah mencakup semua topik trending.</p>}
              </div>
            </SectionCard>
            <SectionCard title="Topik utama channel" description="Centang = juga sedang trending">
              <div className="flex flex-wrap gap-2">
                {result.channelTopics.slice(0, 30).map(topic => {
                  const trending = trendingSet.has(topic);
                  return (
                    <span
                      key={topic}
                      className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm capitalize ${
                        trending ? 'bg-success/15 text-success' : 'bg-secondary text-muted-foreground'
                      }`}
                    >
                      {trending && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                      {topic}
                    </span>
                  );
                })}
              </div>
            </SectionCard>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContentGapAnalyzer;
