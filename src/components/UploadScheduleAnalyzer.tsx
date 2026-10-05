import React, { useMemo, useState } from 'react';
import { Lightbulb, TrendingUp, TrendingDown, Globe, Info, TriangleAlert, CalendarX2, ChevronDown, RefreshCw } from 'lucide-react';
import { AnalyzedData, FetchLimit } from '../types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageHeader, StatCard, SectionCard, EmptyState } from './common';
import PeriodPicker from './PeriodPicker';
import { formatNumber, formatFullNumber, formatDate } from '../lib/format';
import {
  PeriodId,
  CustomPeriod,
  isPeriodId,
  resolvePeriod,
  filterByPeriod,
  periodDays,
  periodCoverage,
  defaultCustomPeriod,
  formatPeriodRange,
} from '../lib/period';
import {
  analyzeSchedule,
  DAYS,
  DAYS_SHORT,
  DAY_ORDER,
  formatHour,
  formatSlotTime,
  formatPerformance,
  MIN_SLOT_UPLOADS,
  Slot,
  SlotConfidence,
  groupSchedule,
  GROUPING_LABELS,
  ScheduleGrouping,
} from '../lib/schedule';
import { cn } from '@/lib/utils';

interface UploadScheduleAnalyzerProps {
  data: AnalyzedData;
  /** Pengaturan "Jumlah video yang diambil" saat ini */
  fetchLimit?: FetchLimit;
  /** Analisis ulang channel/playlist dengan jumlah video lebih banyak */
  onFetchMore?: (limit: FetchLimit) => void;
}

type Metric = 'performance' | 'views' | 'count';
type FormatFilter = 'all' | 'video' | 'shorts';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const PERIOD_KEY = 'yt_schedule_period';
const CUSTOM_KEY = 'yt_schedule_custom_period';
const FORMAT_KEY = 'yt_schedule_format';
const COUNT_KEY = 'yt_schedule_count';
const GROUPING_KEY = 'yt_schedule_grouping';
const GROUPINGS = Object.keys(GROUPING_LABELS) as ScheduleGrouping[];
/** Pilihan "N video terbaru" (0 = semua yang cocok) */
const COUNT_OPTIONS = [10, 25, 50, 100, 250, 500, 1000, 0];
const FETCH_STEPS: FetchLimit[] = [50, 100, 500, 1000, 5000];

const readLocal = <T,>(key: string, parse: (raw: string | null) => T): T => {
  try {
    return parse(localStorage.getItem(key));
  } catch {
    return parse(null);
  }
};
const writeLocal = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // abaikan
  }
};

const METRIC_DESCRIPTION: Record<Metric, string> = {
  performance: 'Warna = performa video di slot itu dibanding video seusia (biru di atas rata-rata, merah di bawah)',
  views: 'Warna = rata-rata views video yang diupload di slot tersebut',
  count: 'Warna = jumlah video yang diupload',
};

const CONFIDENCE_STYLE: Record<SlotConfidence, string> = {
  tinggi: 'bg-success/15 text-success',
  sedang: 'bg-warning/15 text-warning',
  rendah: 'bg-secondary text-muted-foreground',
};

/** Warna sel untuk metrik performa: biru (> 1×) atau merah (< 1×), makin pekat makin jauh dari rata-rata. */
const performanceColor = (p: number) => {
  const strength = Math.min(1, Math.abs(Math.log10(p)) / 0.6);
  return p >= 1 ? `hsl(var(--primary) / ${0.12 + strength * 0.88})` : `hsl(var(--yt-red) / ${0.12 + strength * 0.75})`;
};

const UploadScheduleAnalyzer: React.FC<UploadScheduleAnalyzerProps> = ({ data, fetchLimit, onFetchMore }) => {
  const [metric, setMetric] = useState<Metric>('performance');
  const [periodId, setPeriodId] = useState<PeriodId>(() => readLocal(PERIOD_KEY, v => (isPeriodId(v) ? v : 'all')));
  const [custom, setCustom] = useState<CustomPeriod>(() =>
    readLocal(CUSTOM_KEY, v => {
      try {
        const c = JSON.parse(v || 'null');
        if (c && typeof c.from === 'string' && typeof c.to === 'string') return c;
      } catch {
        // abaikan
      }
      return defaultCustomPeriod();
    })
  );
  const [format, setFormat] = useState<FormatFilter>(() =>
    readLocal(FORMAT_KEY, v => (v === 'video' || v === 'shorts' ? v : 'all'))
  );
  const [count, setCount] = useState<number>(() =>
    readLocal(COUNT_KEY, v => (COUNT_OPTIONS.includes(Number(v)) && v !== null ? Number(v) : 0))
  );
  const [grouping, setGrouping] = useState<ScheduleGrouping>(() =>
    readLocal(GROUPING_KEY, v => (GROUPINGS.includes(v as ScheduleGrouping) ? (v as ScheduleGrouping) : 'day'))
  );
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const allVideos = data.videos;

  const changePeriod = (id: PeriodId) => {
    setPeriodId(id);
    writeLocal(PERIOD_KEY, id);
  };
  const changeCustom = (c: CustomPeriod) => {
    setCustom(c);
    writeLocal(CUSTOM_KEY, JSON.stringify(c));
  };
  const changeFormat = (f: FormatFilter) => {
    setFormat(f);
    writeLocal(FORMAT_KEY, f);
  };
  const changeGrouping = (g: ScheduleGrouping) => {
    setGrouping(g);
    writeLocal(GROUPING_KEY, g);
  };
  const changeCount = (n: number) => {
    setCount(n);
    writeLocal(COUNT_KEY, String(n));
  };

  const scope = useMemo(() => {
    const range = resolvePeriod(periodId, new Date(), custom);
    const inPeriod = filterByPeriod(allVideos, range);
    const matching = format === 'all' ? inPeriod : inPeriod.filter(v => (format === 'shorts' ? v.isShort : !v.isShort));
    // N video terbaru dari yang cocok
    const videos =
      count > 0 && matching.length > count
        ? [...matching].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()).slice(0, count)
        : matching;
    const channelTotal = data.source === 'channel' ? data.channelStats?.videoCountRaw : undefined;
    // "N terbaru" mempersempit rentang waktu sebenarnya → hitung upload/minggu dari rentang video itu sendiri
    const limited = videos.length < matching.length;
    return {
      range,
      matching: matching.length,
      limited,
      videos,
      days: periodDays(limited ? { ...range, start: null } : range, videos),
      coverage: periodCoverage(range, allVideos, channelTotal),
      channelTotal,
    };
  }, [periodId, custom, format, count, allVideos, data.source, data.channelStats?.videoCountRaw]);

  const analysis = useMemo(() => analyzeSchedule(scope.videos), [scope.videos]);
  const groupRows = useMemo(() => groupSchedule(analysis.points, grouping), [analysis.points, grouping]);
  const maxGroupPerf = Math.max(1, ...groupRows.map(r => r.performance));
  const videos = scope.videos;
  const uploadsPerWeek = scope.days >= 1 ? videos.length / (scope.days / 7) : videos.length;
  const shortsCount = useMemo(() => allVideos.filter(v => v.isShort).length, [allVideos]);

  const cellStyle = (c: Slot): React.CSSProperties | undefined => {
    if (!c.count) return undefined;
    if (metric === 'performance') return { backgroundColor: performanceColor(c.performance) };
    const level = metric === 'views' ? Math.sqrt(c.avgViews / analysis.maxAvgViews) : c.count / analysis.maxCount;
    return { backgroundColor: `hsl(var(--primary) / ${0.15 + level * 0.85})` };
  };

  const maxDayPerf = Math.max(1, ...analysis.byDay.map(d => d.performance));
  const maxHourPerf = Math.max(1, ...analysis.byHour.map(h => h.performance));
  const lowData = videos.length > 0 && videos.length < 20;
  const fetchedAll = !scope.channelTotal || allVideos.length >= scope.channelTotal;
  const nextFetch = FETCH_STEPS.find(l => l > allVideos.length && l > (fetchLimit ?? 0));
  const fetchMoreButton =
    onFetchMore && !fetchedAll && nextFetch ? (
      <button
        type="button"
        onClick={() => onFetchMore(nextFetch)}
        className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
      >
        <RefreshCw className="h-3 w-3" /> Ambil {nextFetch.toLocaleString('id-ID')} video
      </button>
    ) : null;

  return (
    <div>
      <PageHeader
        title="Jadwal Upload"
        subtitle={
          <span className="flex flex-col gap-1">
            <span>
              {data.channelTitle ?? 'Hasil analisis'} • {formatFullNumber(videos.length)}
              {videos.length !== allVideos.length && ` dari ${formatFullNumber(allVideos.length)}`} video •{' '}
              {formatPeriodRange(scope.range, videos.length ? videos : allVideos)}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs">
              <Globe className="h-3.5 w-3.5" /> Waktu dalam zona waktu Anda ({timeZone})
            </span>
          </span>
        }
        actions={
          <PeriodPicker
            value={periodId}
            range={scope.range}
            custom={custom}
            videos={allVideos}
            onChange={changePeriod}
            onCustomChange={changeCustom}
          />
        }
      />

      <div className="-mt-2 mb-5 flex flex-wrap items-center gap-2" role="group" aria-label="Format video">
        {([
          ['all', 'Semua format'],
          ['video', 'Video'],
          ['shorts', 'Shorts'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className="yt-chip"
            data-active={format === id}
            onClick={() => changeFormat(id)}
            disabled={id === 'shorts' ? shortsCount === 0 : id === 'video' ? shortsCount === allVideos.length : false}
          >
            {label}
          </button>
        ))}
        <span className="mx-1 hidden h-6 w-px bg-border sm:block" />
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button type="button" className="yt-chip" data-active={count > 0} aria-label="Jumlah video yang dianalisis">
              {count > 0 ? `${count.toLocaleString('id-ID')} video terbaru` : 'Semua video'}
              <ChevronDown className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 rounded-xl py-2 shadow-popover">
            <DropdownMenuLabel className="px-4 text-xs font-normal text-muted-foreground">
              {formatFullNumber(scope.matching)} video cocok dengan periode & format
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup value={String(count)} onValueChange={v => changeCount(Number(v))}>
              {COUNT_OPTIONS.filter(n => n === 0 || n === count || n < scope.matching).map(n => (
                <DropdownMenuRadioItem key={n} value={String(n)} className="h-9 rounded-none text-sm">
                  {n === 0 ? `Semua (${formatFullNumber(scope.matching)})` : `${n.toLocaleString('id-ID')} video terbaru`}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mb-6 space-y-2 text-xs text-muted-foreground">
        <p className="flex items-start gap-2">
          <Info className="mt-px h-3.5 w-3.5 shrink-0" />
          <span>
            Dihitung dari {formatFullNumber(allVideos.length)} video{' '}
            {data.source === 'channel' ? (fetchedAll ? '(semua upload channel)' : 'terbaru channel') : 'hasil analisis'}. Jumlah ini mengikuti
            pengaturan <b className="font-medium text-foreground">Filter → Jumlah video yang diambil</b>
            {fetchedAll ? '' : `; channel ini punya ${formatFullNumber(scope.channelTotal ?? 0)} video`}
            {fetchMoreButton && <> ({fetchMoreButton})</>}. Performa = views ÷ perkiraan views video
            seusia (1,0× = rata-rata channel), jadi video lama tidak unggul hanya karena umurnya.
          </span>
        </p>
        {periodId !== 'all' && !scope.coverage.complete && scope.coverage.oldest && (
          <p className="flex items-start gap-2 text-warning">
            <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" />
            <span>
              Data yang dimuat hanya berisi video sejak {formatDate(scope.coverage.oldest.toISOString())}. Naikkan jumlah video yang diambil
              agar periode ini terhitung lengkap. {fetchMoreButton}
            </span>
          </p>
        )}
        {lowData && (
          <p className="flex items-start gap-2 text-warning">
            <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" />
            Hanya {videos.length} video — pola jadwal belum bisa dipercaya. Pilih periode lebih panjang atau tambah jumlah video.
          </p>
        )}
      </div>

      {videos.length === 0 ? (
        <EmptyState
          icon={CalendarX2}
          title="Tidak ada video di periode ini"
          description="Pilih periode yang lebih panjang atau format lain."
          action={
            <button
              type="button"
              className="yt-pill-primary"
              onClick={() => {
                changePeriod('all');
                changeFormat('all');
                changeCount(0);
              }}
            >
              Tampilkan semua video
            </button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard
              label="Video dianalisis"
              value={formatFullNumber(videos.length)}
              hint={`${formatFullNumber(videos.filter(v => !v.isShort).length)} video • ${formatFullNumber(videos.filter(v => v.isShort).length)} Shorts`}
            />
            <StatCard
              label="Upload / minggu"
              value={uploadsPerWeek.toFixed(1)}
              hint={analysis.busiestDay ? `Paling sering: ${DAYS[analysis.busiestDay.day]}` : undefined}
            />
            <StatCard
              label="Hari terbaik"
              value={analysis.bestDay ? DAYS[analysis.bestDay.day] : '-'}
              accent="blue"
              hint={
                analysis.bestDay
                  ? `${formatPerformance(analysis.bestDay.performance)} performa • ${analysis.bestDay.count} upload`
                  : `Butuh ≥ ${MIN_SLOT_UPLOADS} upload per hari`
              }
            />
            <StatCard
              label="Jam terbaik"
              value={analysis.bestHour ? formatHour(analysis.bestHour.hour) : '-'}
              accent="blue"
              hint={
                analysis.bestHour
                  ? `${formatPerformance(analysis.bestHour.performance)} performa • ${analysis.bestHour.count} upload`
                  : `Butuh ≥ ${MIN_SLOT_UPLOADS} upload per jam`
              }
            />
          </div>

          <SectionCard
            className="mt-6"
            title="Peta panas upload"
            description={METRIC_DESCRIPTION[metric]}
            actions={
              <div className="flex flex-wrap gap-2">
                {([
                  ['performance', 'Performa'],
                  ['views', 'Rata-rata views'],
                  ['count', 'Jumlah upload'],
                ] as const).map(([id, label]) => (
                  <button key={id} type="button" className="yt-chip" data-active={metric === id} onClick={() => setMetric(id)}>
                    {label}
                  </button>
                ))}
              </div>
            }
          >
            <div className="-mx-4 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
              <div className="grid min-w-[640px] grid-cols-[44px_repeat(24,minmax(0,1fr))] gap-[3px]">
                <div />
                {HOURS.map(h => (
                  <div key={h} className="text-center text-[10px] text-muted-foreground">
                    {h % 3 === 0 ? String(h).padStart(2, '0') : ''}
                  </div>
                ))}
                {DAY_ORDER.map(d => (
                  <React.Fragment key={d}>
                    <div className="flex items-center text-xs text-muted-foreground">{DAYS_SHORT[d]}</div>
                    {HOURS.map(h => {
                      const cell = analysis.cells[d][h];
                      return (
                        <div
                          key={h}
                          className={cn('aspect-square rounded-[3px]', !cell.count && 'bg-secondary')}
                          style={cellStyle(cell)}
                          title={
                            cell.count
                              ? `${DAYS[d]} ${formatHour(h)} — ${cell.count} video • performa ${formatPerformance(cell.performance)} • median ${formatNumber(cell.medianViews)} views`
                              : `${DAYS[d]} ${formatHour(h)} — belum ada upload`
                          }
                        />
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                {metric === 'performance' ? (
                  <>
                    <span>Di bawah rata-rata</span>
                    {[0.4, 0.7, 1, 1.5, 2.5].map(p => (
                      <span key={p} className="h-3 w-3 rounded-[3px]" style={{ backgroundColor: performanceColor(p) }} />
                    ))}
                    <span>Di atas rata-rata</span>
                  </>
                ) : (
                  <>
                    <span>Rendah</span>
                    {[0.15, 0.35, 0.55, 0.75, 1].map(o => (
                      <span key={o} className="h-3 w-3 rounded-[3px]" style={{ backgroundColor: `hsl(var(--primary) / ${o})` }} />
                    ))}
                    <span>Tinggi</span>
                  </>
                )}
                <span className="ml-auto flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-[3px] bg-secondary" /> Belum ada upload
                </span>
              </div>
            </div>
          </SectionCard>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <SectionCard title="Performa per hari" description="1,0× = setara video seusia. Batang pudar = kurang dari 2 upload.">
              <ul className="space-y-2.5">
                {DAY_ORDER.map(d => {
                  const row = analysis.byDay[d];
                  const reliable = row.count >= MIN_SLOT_UPLOADS;
                  return (
                    <li key={d} className="grid grid-cols-[64px_1fr_96px] items-center gap-3 text-sm">
                      <span className="text-muted-foreground">{DAYS[d]}</span>
                      <span className="h-2 overflow-hidden rounded-full bg-secondary">
                        <span
                          className={cn(
                            'block h-full rounded-full',
                            analysis.bestDay?.day === d ? 'bg-youtube-red' : 'bg-primary',
                            !reliable && 'opacity-40'
                          )}
                          style={{ width: `${row.count ? (row.performance / maxDayPerf) * 100 : 0}%` }}
                        />
                      </span>
                      <span className="text-right tabular-nums text-foreground">
                        {row.count ? formatPerformance(row.performance) : '-'}
                        <span className="ml-1 text-xs text-muted-foreground">({row.count})</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </SectionCard>

            <SectionCard title="Performa per jam upload" description="Arahkan kursor ke batang untuk detail.">
              <div className="flex h-40 items-end gap-[3px]">
                {analysis.byHour.map(h => (
                  <div
                    key={h.hour}
                    className={cn(
                      'flex-1 rounded-t-sm',
                      h.count ? (analysis.bestHour?.hour === h.hour ? 'bg-youtube-red' : 'bg-primary') : 'bg-secondary',
                      h.count > 0 && h.count < MIN_SLOT_UPLOADS && 'opacity-40'
                    )}
                    style={{ height: `${h.count ? Math.max(4, (h.performance / maxHourPerf) * 100) : 4}%` }}
                    title={`${formatHour(h.hour)} — ${h.count} video${h.count ? `, performa ${formatPerformance(h.performance)}, median ${formatNumber(h.medianViews)} views` : ''}`}
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
            <SectionCard title="Slot terbaik" description={`Blok 3 jam di atas rata-rata, minimal ${MIN_SLOT_UPLOADS} upload`}>
              {analysis.best.length ? <SlotList slots={analysis.best} tone="good" /> : <NotEnough />}
            </SectionCard>
            <SectionCard title="Slot terendah" description={`Blok 3 jam di bawah rata-rata, minimal ${MIN_SLOT_UPLOADS} upload`}>
              {analysis.worst.length ? <SlotList slots={analysis.worst} tone="bad" /> : <NotEnough />}
            </SectionCard>
          </div>

          <SectionCard
            className="mt-6"
            title="Peringkat waktu upload"
            description={`Dikelompokkan per ${GROUPING_LABELS[grouping].toLowerCase()}, urut dari performa tertinggi. Kelompok dengan kurang dari ${MIN_SLOT_UPLOADS} upload ditaruh di bawah.`}
          >
            <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 no-scrollbar sm:-mx-6 sm:px-6" role="group" aria-label="Kelompokkan">
              <span className="self-center pr-1 text-sm text-muted-foreground">Kelompokkan:</span>
              {GROUPINGS.map(g => (
                <button key={g} type="button" className="yt-chip" data-active={grouping === g} onClick={() => changeGrouping(g)}>
                  {GROUPING_LABELS[g]}
                </button>
              ))}
            </div>
            <div className="-mx-4 max-h-[480px] overflow-auto sm:-mx-6">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="w-10 px-4 py-2 font-normal sm:pl-6">#</th>
                    <th className="px-2 py-2 font-normal">{GROUPING_LABELS[grouping]}</th>
                    <th className="px-2 py-2 text-right font-normal">Upload</th>
                    <th className="px-2 py-2 text-right font-normal">Median views</th>
                    <th className="w-[30%] px-2 py-2 font-normal">Performa</th>
                    <th className="px-4 py-2 text-right font-normal sm:pr-6">Keyakinan</th>
                  </tr>
                </thead>
                <tbody>
                  {groupRows.map((r, i) => (
                    <tr key={r.key} className={cn('border-b border-border last:border-0', !r.rankable && 'text-muted-foreground')}>
                      <td className="px-4 py-2 text-muted-foreground sm:pl-6">{r.rankable ? i + 1 : '–'}</td>
                      <td className="whitespace-nowrap px-2 py-2 font-medium">{r.label}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{r.count}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatNumber(r.medianViews)}</td>
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-2">
                          <span className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                            <span
                              className={cn('block h-full rounded-full', r.performance >= 1 ? 'bg-primary' : 'bg-youtube-red', !r.rankable && 'opacity-40')}
                              style={{ width: `${(r.performance / maxGroupPerf) * 100}%` }}
                            />
                          </span>
                          <span className="w-12 text-right tabular-nums">{formatPerformance(r.performance)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right sm:pr-6">
                        <span className={cn('rounded px-1.5 py-px text-[10px] font-medium', CONFIDENCE_STYLE[r.confidence])}>{r.confidence}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          {analysis.best[0] && (
            <div className="mt-6 flex items-start gap-4 rounded-xl bg-primary/10 p-4 sm:p-5">
              <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <p className="text-sm leading-6 text-foreground">
                Upload hari <b>{DAYS[analysis.best[0].day]}</b> pukul <b>{formatSlotTime(analysis.best[0])}</b> rata-rata mendapat{' '}
                <b>{formatPerformance(analysis.best[0].performance)}</b> views video seusia ({analysis.best[0].count} upload, keyakinan{' '}
                {analysis.best[0].confidence}).
                {analysis.best[0].confidence === 'rendah'
                  ? ' Sampelnya masih sedikit — uji jadwal ini beberapa kali sebelum menjadikannya patokan.'
                  : ' Topik dan judul tetap berpengaruh besar, jadi gunakan sebagai patokan awal lalu uji.'}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const NotEnough = () => (
  <p className="text-sm text-muted-foreground">Data belum cukup — butuh beberapa upload di jam yang sama.</p>
);

const SlotList: React.FC<{ slots: Slot[]; tone: 'good' | 'bad' }> = ({ slots, tone }) => (
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
            {i + 1}. {DAYS[s.day]}, {formatSlotTime(s)}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>{s.count} upload</span>
            <span>• median {formatNumber(s.medianViews)} views</span>
            <span className={cn('rounded px-1.5 py-px text-[10px] font-medium', CONFIDENCE_STYLE[s.confidence])}>
              keyakinan {s.confidence}
            </span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium tabular-nums text-foreground">{formatPerformance(s.performance)}</p>
          <p className="text-[11px] text-muted-foreground">performa</p>
        </div>
      </li>
    ))}
  </ul>
);

export default UploadScheduleAnalyzer;
