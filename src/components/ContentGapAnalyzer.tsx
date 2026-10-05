import React, { useState } from 'react';
import { Loader2, Lightbulb, Check, Copy } from 'lucide-react';
import { VideoItem, ShowToast } from '../types';
import { analyzeContentGap, ContentGapResult } from '../services/contentGapService';
import { fetchTrendingVideos } from '../services/youtubeService';
import { copyToClipboard } from '../services/exportService';
import { PageHeader, SectionCard, EmptyState } from './common';

interface ContentGapAnalyzerProps {
  channelVideos: VideoItem[];
  channelTitle?: string;
  apiKey: string;
  onToast: ShowToast;
  onRequireApiKey: () => void;
}

const REGIONS = [
  { code: 'ID', name: 'Indonesia' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'US', name: 'Amerika Serikat' },
  { code: 'GB', name: 'Inggris' },
  { code: 'IN', name: 'India' },
  { code: 'PH', name: 'Filipina' },
];

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

  const regionName = REGIONS.find(r => r.code === analyzedRegion)?.name;
  const circumference = 2 * Math.PI * 40;

  return (
    <div>
      <PageHeader
        title="Content Gap"
        subtitle={`Bandingkan topik ${channelTitle ?? 'channel'} (${channelVideos.length} video) dengan video trending untuk menemukan ide konten.`}
        actions={
          <>
            <select
              value={region}
              onChange={e => setRegion(e.target.value)}
              className="h-9 rounded-full border border-border bg-background px-3 text-sm font-medium text-foreground outline-none hover:bg-secondary"
              aria-label="Wilayah trending"
            >
              {REGIONS.map(r => (
                <option key={r.code} value={r.code}>
                  {r.name}
                </option>
              ))}
            </select>
            <button type="button" onClick={runAnalysis} disabled={loading} className="yt-pill-blue">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
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
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Mulai analisis
            </button>
          }
        />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="yt-card flex items-center gap-5 p-5">
              <div className="relative h-24 w-24 shrink-0">
                <svg className="h-24 w-24 -rotate-90" viewBox="0 0 96 96">
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
                <span className="absolute inset-0 flex items-center justify-center text-2xl font-medium text-foreground">
                  {result.overlapPercentage}%
                </span>
              </div>
              <div>
                <p className="font-medium text-foreground">Cakupan tren</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Channel sudah membahas {result.overlapPercentage}% topik yang sedang trending di {regionName}.
                </p>
              </div>
            </div>
            <div className="yt-card flex items-center gap-5 p-5">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-youtube-red/10">
                <span className="text-3xl font-medium text-destructive">{result.missingTopics.length}</span>
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
                  <Copy className="h-4 w-4" /> Salin topik
                </button>
              }
            >
              <ol className="divide-y divide-border">
                {result.recommendations.map((rec, i) => (
                  <li key={rec.topic} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-medium">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium capitalize text-foreground">{rec.topic}</p>
                      <p className="text-sm text-muted-foreground">{rec.reason}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-success/15 px-3 py-1 text-xs font-medium text-success">{rec.potentialViews}</span>
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
                  const trending = result.trendingTopics.includes(topic);
                  return (
                    <span
                      key={topic}
                      className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm capitalize ${
                        trending ? 'bg-success/15 text-success' : 'bg-secondary text-muted-foreground'
                      }`}
                    >
                      {trending && <Check className="h-3.5 w-3.5" />}
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
