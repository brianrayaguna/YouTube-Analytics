import React, { useMemo, useState, useEffect } from 'react';
import { Play, Lightbulb, Search, ShieldCheck, ShieldAlert, Info } from 'lucide-react';
import { VideoItem } from '../types';
import { calculateAllVideoScores, getGradeDistribution, VideoWithScores, PerformanceScore, SCORE_MODEL } from '../services/performanceScoreService';
import { analyzeTitleScore } from '../services/titleScoreService';
import { PageHeader, StatCard, SectionCard, StudioTabs } from './common';
import { cn } from '@/lib/utils';

interface TitleScoreAnalyzerProps {
  videos: VideoItem[];
  onPreview?: (video: VideoItem) => void;
}

type Tab = 'title' | 'thumbnail';
type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

const GRADES: Grade[] = ['A', 'B', 'C', 'D', 'F'];

const GRADE_STYLE: Record<Grade, { text: string; bg: string; bar: string }> = {
  A: { text: 'text-[#0b8043] dark:text-[#4ade80]', bg: 'bg-[#0b8043]/10 dark:bg-[#4ade80]/15', bar: 'bg-[#0b8043] dark:bg-[#4ade80]' },
  B: { text: 'text-primary', bg: 'bg-primary/10', bar: 'bg-primary' },
  C: { text: 'text-[#b06000] dark:text-[#fbbf24]', bg: 'bg-[#f9ab00]/15', bar: 'bg-[#f9ab00]' },
  D: { text: 'text-[#e8710a] dark:text-[#fb923c]', bg: 'bg-[#e8710a]/10', bar: 'bg-[#e8710a]' },
  F: { text: 'text-destructive', bg: 'bg-destructive/10', bar: 'bg-destructive' },
};

const PAGE = 100;

const GradeBadge: React.FC<{ grade: Grade; size?: 'sm' | 'lg' }> = ({ grade, size = 'sm' }) => (
  <span
    className={cn(
      'inline-flex shrink-0 items-center justify-center rounded-lg font-bold',
      GRADE_STYLE[grade].text,
      GRADE_STYLE[grade].bg,
      size === 'lg' ? 'h-14 w-14 text-3xl' : 'h-9 w-9 text-base'
    )}
  >
    {grade}
  </span>
);

const TitleScoreAnalyzer: React.FC<TitleScoreAnalyzerProps> = ({ videos, onPreview }) => {
  const [tab, setTab] = useState<Tab>('title');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [gradeFilter, setGradeFilter] = useState<Grade | 'all'>('all');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(PAGE);

  const scored = useMemo(() => calculateAllVideoScores(videos), [videos]);
  const scoreOf = (v: VideoWithScores): PerformanceScore => (tab === 'title' ? v.titleScore : v.thumbnailScore);

  const sorted = useMemo(
    () => [...scored].sort((a, b) => (tab === 'title' ? b.titleScore.totalScore - a.titleScore.totalScore : b.thumbnailScore.totalScore - a.thumbnailScore.totalScore)),
    [scored, tab]
  );

  const avgScore = useMemo(
    () => (scored.length ? Math.round(scored.reduce((s, v) => s + (tab === 'title' ? v.titleScore.totalScore : v.thumbnailScore.totalScore), 0) / scored.length) : 0),
    [scored, tab]
  );

  const distribution = useMemo(
    () => getGradeDistribution(scored.map(v => (tab === 'title' ? v.titleScore : v.thumbnailScore))) as Record<Grade, number>,
    [scored, tab]
  );

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sorted.filter(v => {
      const grade = (tab === 'title' ? v.titleScore : v.thumbnailScore).grade;
      return (gradeFilter === 'all' || grade === gradeFilter) && (!q || v.title.toLowerCase().includes(q));
    });
  }, [sorted, gradeFilter, search, tab]);

  useEffect(() => setLimit(PAGE), [tab, gradeFilter, search]);

  const selected = scored.find(v => v.id === selectedId) ?? sorted[0] ?? null;
  const selectedScore = selected ? scoreOf(selected) : null;
  const textAnalysis = useMemo(() => (selected ? analyzeTitleScore(selected.title, { isShort: selected.isShort }) : null), [selected]);
  const best = sorted[0];

  return (
    <div>
      <PageHeader
        title="Skor Judul & Thumbnail"
        subtitle="Skor 0–100: jangkauan dibanding video seusia (Shorts vs Shorts, Video vs Video), engagement, dan kualitas judul/thumbnail."
      />
      <StudioTabs<Tab>
        tabs={[
          { id: 'title', label: 'Skor judul' },
          { id: 'thumbnail', label: 'Skor thumbnail' },
        ]}
        value={tab}
        onChange={setTab}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label={`Rata-rata skor ${tab === 'title' ? 'judul' : 'thumbnail'}`} value={`${avgScore}`} hint="dari 100" />
        <div className="yt-card col-span-2 p-4 sm:p-5 lg:col-span-1">
          <p className="text-sm text-muted-foreground">Distribusi nilai</p>
          <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-secondary">
            {GRADES.map(g =>
              distribution[g] ? (
                <div key={g} className={GRADE_STYLE[g].bar} style={{ width: `${(distribution[g] / scored.length) * 100}%` }} title={`${g}: ${distribution[g]}`} />
              ) : null
            )}
          </div>
          <div className="mt-2 flex justify-between text-xs">
            {GRADES.map(g => (
              <span key={g} className={GRADE_STYLE[g].text}>
                <b>{g}</b> <span className="text-muted-foreground">{distribution[g]}</span>
              </span>
            ))}
          </div>
          <p className="mt-2 flex items-start gap-1 text-[11px] leading-4 text-muted-foreground">
            <Info className="mt-px h-3 w-3 shrink-0" /> A ≥{SCORE_MODEL.grades.A} • B ≥{SCORE_MODEL.grades.B} • C ≥{SCORE_MODEL.grades.C} • D ≥{SCORE_MODEL.grades.D} • C ≈ rata-rata
          </p>
        </div>
        <div className="yt-card p-4 sm:p-5">
          <p className="text-sm text-muted-foreground">Bobot penilaian (model v{SCORE_MODEL.version})</p>
          <ul className="mt-2 space-y-1 text-xs">
            {(tab === 'title'
              ? [
                  ['Jangkauan vs video seusia', `${SCORE_MODEL.title.reach}%`],
                  ['Engagement (dihaluskan)', `${SCORE_MODEL.title.engagement}%`],
                  ['Kualitas teks judul', `${SCORE_MODEL.title.text}%`],
                ]
              : [
                  ['Daya klik (jangkauan)', `${SCORE_MODEL.thumbnail.reach}%`],
                  ['Kesesuaian isi (engagement)', `${SCORE_MODEL.thumbnail.engagement}%`],
                  ['Kualitas teknis (HD)', `${SCORE_MODEL.thumbnail.technical}%`],
                ]
            ).map(([k, v]) => (
              <li key={k} className="flex justify-between">
                <span className="text-muted-foreground">{k}</span>
                <span className="font-medium text-foreground">{v}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="yt-card p-4 sm:p-5">
          <p className="text-sm text-muted-foreground">Terbaik</p>
          {best && (
            <button type="button" className="mt-2 flex w-full items-center gap-3 text-left" onClick={() => setSelectedId(best.id)}>
              <img src={best.thumbnail} alt="" className="aspect-video w-20 shrink-0 rounded-lg object-cover" />
              <span className="line-clamp-2 text-sm font-medium text-foreground">{best.title}</span>
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <SectionCard title={`Peringkat ${tab === 'title' ? 'judul' : 'thumbnail'}`} description={`${list.length} video`}>
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari judul…" className="yt-input pl-9" />
            </div>
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
              {(['all', ...GRADES] as const).map(g => (
                <button key={g} type="button" className="yt-chip h-8 px-2.5" data-active={gradeFilter === g} onClick={() => setGradeFilter(g)}>
                  {g === 'all' ? 'Semua' : g}
                </button>
              ))}
            </div>
          </div>

          <ul className="-mx-2 max-h-[640px] overflow-y-auto">
            {list.slice(0, limit).map(v => {
              const s = scoreOf(v);
              const rank = sorted.indexOf(v) + 1;
              return (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(v.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors',
                      selected?.id === v.id ? 'bg-primary/10' : 'hover:bg-secondary'
                    )}
                  >
                    <span className="w-7 shrink-0 text-right text-xs text-muted-foreground">{rank}</span>
                    {tab === 'thumbnail' && <img src={v.thumbnail} alt="" loading="lazy" className="aspect-video w-20 shrink-0 rounded-md object-cover" />}
                    <GradeBadge grade={s.grade as Grade} />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-sm font-medium text-foreground">{v.title}</span>
                      <span className="mt-1 flex items-center gap-2">
                        <span className="h-1 flex-1 overflow-hidden rounded-full bg-secondary">
                          <span className={cn('block h-full rounded-full', GRADE_STYLE[s.grade as Grade].bar)} style={{ width: `${s.totalScore}%` }} />
                        </span>
                        <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{s.totalScore}/100</span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {list.length > limit && (
            <button type="button" className="yt-pill mt-3 w-full" onClick={() => setLimit(l => l + PAGE)}>
              Tampilkan {Math.min(PAGE, list.length - limit)} lagi
            </button>
          )}
        </SectionCard>

        {selected && selectedScore && (
          <div className="lg:sticky lg:top-20 lg:self-start">
            <SectionCard title="Rincian skor">
              <div className="relative overflow-hidden rounded-xl bg-secondary">
                <img src={selected.thumbnail} alt="" className="aspect-video w-full object-cover" />
                {onPreview && (
                  <button
                    type="button"
                    onClick={() => onPreview(selected)}
                    className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition hover:bg-black/30 hover:opacity-100"
                    aria-label="Putar pratinjau"
                  >
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/70 text-white">
                      <Play className="h-7 w-7 fill-current" />
                    </span>
                  </button>
                )}
              </div>
              <p className="mt-3 text-base font-medium leading-6 text-foreground">{selected.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {selected.views} x ditonton • {selected.likes} likes • ER {selected.engagementRate}%
              </p>

              <div className="mt-4 flex items-center gap-4">
                <GradeBadge grade={selectedScore.grade as Grade} size="lg" />
                <div>
                  <p className="text-3xl font-medium text-foreground">
                    {selectedScore.totalScore}
                    <span className="text-base text-muted-foreground">/100</span>
                  </p>
                  <p className={cn('text-sm', selectedScore.totalScore >= avgScore ? 'text-success' : 'text-destructive')}>
                    {selectedScore.totalScore >= avgScore ? '+' : ''}
                    {selectedScore.totalScore - avgScore} dari rata-rata ({avgScore})
                  </p>
                </div>
              </div>

              <div
                className={cn(
                  'mt-4 flex items-start gap-2 rounded-lg px-3 py-2 text-xs',
                  selectedScore.confidence === 'tinggi' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                )}
              >
                {selectedScore.confidence === 'tinggi' ? <ShieldCheck className="h-4 w-4 shrink-0" /> : <ShieldAlert className="h-4 w-4 shrink-0" />}
                <span>
                  Keyakinan {selectedScore.confidence}
                  {selectedScore.confidenceNote ? ` — ${selectedScore.confidenceNote}` : ''} • dibandingkan dengan {selected.metrics.cohortSize}{' '}
                  {selected.metrics.cohort === 'Semua' ? 'video' : selected.metrics.cohort}
                </span>
              </div>

              <div className="mt-5 space-y-4">
                {selectedScore.components.map(c => (
                  <div key={c.key}>
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="font-medium text-foreground">{c.label}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {c.points}/{c.weight} poin
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div
                        className={cn('h-full rounded-full', c.value >= 75 ? 'bg-success' : c.value >= 50 ? 'bg-primary' : c.value >= 30 ? 'bg-warning' : 'bg-destructive')}
                        style={{ width: `${c.value}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Nilai {c.value}/100 • {c.detail}
                    </p>
                  </div>
                ))}
              </div>

              {tab === 'title' && textAnalysis && (
                <div className="mt-6">
                  <p className="text-sm font-medium text-foreground">Cek teks judul ({textAnalysis.totalScore}/100)</p>
                  <ul className="mt-2 divide-y divide-border rounded-xl border border-border text-sm">
                    {textAnalysis.checks.map(ch => (
                      <li key={ch.key} className="flex items-center gap-3 px-3 py-2">
                        <span
                          className={cn(
                            'h-2 w-2 shrink-0 rounded-full',
                            ch.score / ch.max >= 0.8 ? 'bg-success' : ch.score / ch.max >= 0.5 ? 'bg-warning' : 'bg-destructive'
                          )}
                        />
                        <span className="w-28 shrink-0 text-foreground">{ch.label}</span>
                        <span className="min-w-0 flex-1 truncate text-muted-foreground" title={ch.feedback}>
                          {ch.feedback}
                        </span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {ch.score}/{ch.max}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {tab === 'title' && textAnalysis && textAnalysis.suggestions.length > 0 && (
                <div className="mt-6 rounded-xl bg-secondary p-4">
                  <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Lightbulb className="h-4 w-4 text-warning" /> Saran perbaikan judul
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {textAnalysis.suggestions.map(s => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
            </SectionCard>
          </div>
        )}
      </div>
    </div>
  );
};

export default TitleScoreAnalyzer;
