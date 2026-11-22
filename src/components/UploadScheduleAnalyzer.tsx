import React, { useMemo, useRef, useState } from 'react';
import { Lightbulb, TrendingUp, TrendingDown, Globe, Info, TriangleAlert, CalendarX2, ChevronDown, RefreshCw, X, Clock, ArrowRight } from 'lucide-react';
import { AnalyzedData, FetchLimit, VideoItem } from '../types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageHeader, StatCard, SectionCard, StudioTabs, EmptyState } from './common';
import PeriodPicker from './PeriodPicker';
import { formatNumber, formatFullNumber, formatDate, formatDateWithDay, formatTime, formatDateTimeLong } from '../lib/format';
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
  SlotMatch,
  matchesSlot,
  daypartOf,
} from '../lib/schedule';
import { cn } from '@/lib/utils';

interface UploadScheduleAnalyzerProps {
  data: AnalyzedData;
  /** Pengaturan "Jumlah video yang diambil" saat ini */
  fetchLimit?: FetchLimit;
  /** Analisis ulang channel/playlist dengan jumlah video lebih banyak */
  onFetchMore?: (limit: FetchLimit) => void;
  onPreview?: (video: VideoItem) => void;
}

type ScheduleTab = 'heatmap' | 'ranking' | 'videos';
type ListSort = 'newest' | 'oldest' | 'performance' | 'views' | 'time';

const SCHEDULE_TABS: Array<{ id: ScheduleTab; label: string }> = [
  { id: 'heatmap', label: 'Peta Panas & Ringkasan' },
  { id: 'ranking', label: 'Peringkat Slot' },
  { id: 'videos', label: 'Detail Video' },
];

const LIST_SORTS: Array<[ListSort, string]> = [
  ['newest', 'Terbaru'],
  ['oldest', 'Terlama'],
  ['performance', 'Performa'],
  ['views', 'Views'],
  ['time', 'Jam upload'],
];
const LIST_PAGE = 50;

type Metric = 'performance' | 'views' | 'count';
type FormatFilter = 'all' | 'video' | 'shorts';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const PERIOD_KEY = 'yt_schedule_period';
const CUSTOM_KEY = 'yt_schedule_custom_period';
const FORMAT_KEY = 'yt_schedule_format';
const COUNT_KEY = 'yt_schedule_count';
const GROUPING_KEY = 'yt_schedule_grouping';
const GROUPINGS = Object.keys(GROUPING_LABELS) as ScheduleGrouping[];
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
  return p >= 1 ? `hsl(var(--primary) / ${0.14 + strength * 0.86})` : `hsl(var(--destructive) / ${0.14 + strength * 0.72})`;
};

const UploadScheduleAnalyzer: React.FC<UploadScheduleAnalyzerProps> = ({ data, fetchLimit, onFetchMore, onPreview }) => {
  const [activeTab, setActiveTab] = useState<ScheduleTab>('heatmap');
  const [selectedCell, setSelectedCell] = useState<{ day: number; hour: number } | null>(null);
  const [listFilter, setListFilter] = useState<{ match: SlotMatch; label: string } | null>(null);
  const [listSort, setListSort] = useState<ListSort>('newest');
  const [listLimit, setListLimit] = useState(LIST_PAGE);
  const cellRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  /** Buka tab Detail Video terfilter pada slot tertentu */
  const showSlot = (match: SlotMatch, label: string) => {
    setListFilter({ match, label });
    setListLimit(LIST_PAGE);
    setActiveTab('videos');
  };

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
    const videos =
      count > 0 && matching.length > count
        ? matching.toSorted((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()).slice(0, count)
        : matching;
    const channelTotal = data.source === 'channel' ? data.channelStats?.videoCountRaw : undefined;
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

  // Detail upload per video (waktu lokal)
  const uploadRows = useMemo(() => {
    const reach = new Map(analysis.points.map(p => [p.id, p.reach ?? 1]));
    const now = Date.now();
    return scope.videos
      .map(v => {
        const d = new Date(v.publishedAt);
        return {
          video: v,
          time: d.getTime(),
          day: d.getDay(),
          hour: d.getHours(),
          minuteOfDay: d.getHours() * 60 + d.getMinutes(),
          reach: reach.get(v.id) ?? 1,
          ageDays: Math.max(0, Math.floor((now - d.getTime()) / 86400000)),
        };
      })
      .filter(r => !Number.isNaN(r.time));
  }, [scope.videos, analysis.points]);

  const listRows = useMemo(() => {
    const rows = listFilter ? uploadRows.filter(r => matchesSlot(listFilter.match, r.day, r.hour)) : uploadRows;
    const cmp: Record<ListSort, (a: (typeof rows)[number], b: (typeof rows)[number]) => number> = {
      newest: (a, b) => b.time - a.time,
      oldest: (a, b) => a.time - b.time,
      performance: (a, b) => b.reach - a.reach,
      views: (a, b) => b.video.viewCountRaw - a.video.viewCountRaw,
      time: (a, b) => a.minuteOfDay - b.minuteOfDay || b.time - a.time,
    };
    return rows.toSorted(cmp[listSort]);
  }, [uploadRows, listFilter, listSort]);

  const videos = scope.videos;
  const uploadsPerWeek = scope.days >= 1 ? videos.length / (scope.days / 7) : videos.length;
  const shortsCount = useMemo(() => allVideos.filter(v => v.isShort).length, [allVideos]);

  const cellStyle = (c: Slot): React.CSSProperties | undefined => {
    if (!c.count) return undefined;
    if (metric === 'performance') return { backgroundColor: performanceColor(c.performance) };
    const level = metric === 'views' ? Math.sqrt(c.avgViews / analysis.maxAvgViews) : c.count / analysis.maxCount;
    return { backgroundColor: `hsl(var(--primary) / ${0.16 + level * 0.84})` };
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
        <RefreshCw className="h-3 w-3" aria-hidden="true" /> Ambil {nextFetch.toLocaleString('id-ID')} video
      </button>
    ) : null;

  const inspectedCell = selectedCell ? analysis.cells[selectedCell.day]?.[selectedCell.hour] : null;

  const handleCellKeyDown = (e: React.KeyboardEvent, dayIdx: number, hour: number) => {
    let nextRow = dayIdx;
    let nextCol = hour;
    if (e.key === 'ArrowRight') nextCol = (hour + 1) % 24;
    else if (e.key === 'ArrowLeft') nextCol = (hour + 23) % 24;
    else if (e.key === 'ArrowDown') nextRow = (dayIdx + 1) % DAY_ORDER.length;
    else if (e.key === 'ArrowUp') nextRow = (dayIdx - 1 + DAY_ORDER.length) % DAY_ORDER.length;
    else return;
    e.preventDefault();
    const nextDay = DAY_ORDER[nextRow];
    cellRefs.current[`${nextDay}-${nextCol}`]?.focus();
    setSelectedCell({ day: nextDay, hour: nextCol });
  };

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
              <Globe className="h-3.5 w-3.5" aria-hidden="true" /> Waktu dalam zona waktu Anda ({timeZone})
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
            aria-pressed={format === id}
            data-active={format === id}
            onClick={() => changeFormat(id)}
            disabled={id === 'shorts' ? shortsCount === 0 : id === 'video' ? shortsCount === allVideos.length : false}
          >
            {label}
          </button>
        ))}
        <span className="mx-1 hidden h-6 w-px bg-border sm:block" aria-hidden="true" />
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button type="button" className="yt-chip" data-active={count > 0} aria-label="Jumlah video yang dianalisis">
              {count > 0 ? `${count.toLocaleString('id-ID')} video terbaru` : 'Semua video'}
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
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

      <div className="mb-5 space-y-2 text-xs text-muted-foreground">
        <p className="flex items-start gap-2">
          <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            Dihitung dari {formatFullNumber(allVideos.length)} video{' '}
            {data.source === 'channel' ? (fetchedAll ? '(semua upload channel)' : 'terbaru channel') : 'hasil analisis'} sesuai
            batas jumlah video di kolom pencarian
            {fetchedAll ? '' : `; channel ini punya ${formatFullNumber(scope.channelTotal ?? 0)} video`}
            {fetchMoreButton && <> ({fetchMoreButton})</>}. Performa = views ÷ perkiraan views video seusia (1,0× = rata-rata).
          </span>
        </p>
        {periodId !== 'all' && !scope.coverage.complete && scope.coverage.oldest && (
          <p className="flex items-start gap-2 text-warning">
            <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              Data yang dimuat hanya berisi video sejak {formatDate(scope.coverage.oldest.toISOString())}. Naikkan jumlah video agar
              periode ini terhitung lengkap. {fetchMoreButton}
            </span>
          </p>
        )}
        {lowData && (
          <p className="flex items-start gap-2 text-warning">
            <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Hanya {videos.length} video — pola jadwal belum cukup stabil. Pilih periode lebih panjang atau tambah jumlah video.</span>
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
          <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
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

          <StudioTabs<ScheduleTab>
            tabs={SCHEDULE_TABS}
            value={activeTab}
            onChange={setActiveTab}
            label="Tampilan jadwal upload"
            idPrefix="schedule"
          />

          {activeTab === 'heatmap' && (
            <div id="schedule-panel-heatmap" role="tabpanel" aria-labelledby="schedule-tab-heatmap" className="space-y-6">
              {analysis.best[0] && (
                <div className="flex items-start gap-3.5 rounded-xl border border-primary/20 bg-primary/10 p-4 sm:p-5">
                  <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
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

              <SectionCard
                title="Peta panas upload"
                description={`${METRIC_DESCRIPTION[metric]}. Pilih sel (atau pakai tombol panah) untuk memeriksa detail slot.`}
                actions={
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Metrik peta panas">
                    {([
                      ['performance', 'Performa'],
                      ['views', 'Rata-rata views'],
                      ['count', 'Jumlah upload'],
                    ] as const).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        className="yt-chip"
                        aria-pressed={metric === id}
                        data-active={metric === id}
                        onClick={() => setMetric(id)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                }
              >
                <div
                  tabIndex={0}
                  role="region"
                  aria-label="Peta panas hari kali jam upload"
                  className="-mx-4 overflow-x-auto px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:-mx-6 sm:px-6"
                >
                  <div className="grid min-w-[640px] grid-cols-[44px_repeat(24,minmax(0,1fr))] gap-[3px]">
                    <div />
                    {HOURS.map(h => (
                      <div key={h} className="text-center text-[10px] tabular-nums text-muted-foreground">
                        {h % 3 === 0 ? String(h).padStart(2, '0') : ''}
                      </div>
                    ))}
                    {DAY_ORDER.map((d, dayIdx) => (
                      <React.Fragment key={d}>
                        <div className="flex items-center text-xs text-muted-foreground">{DAYS_SHORT[d]}</div>
                        {HOURS.map(h => {
                          const cell = analysis.cells[d][h];
                          const isSelected = selectedCell?.day === d && selectedCell?.hour === h;
                          return (
                            <button
                              ref={el => {
                                cellRefs.current[`${d}-${h}`] = el;
                              }}
                              type="button"
                              key={h}
                              onClick={() => setSelectedCell({ day: d, hour: h })}
                              onKeyDown={e => handleCellKeyDown(e, dayIdx, h)}
                              className={cn(
                                'aspect-square rounded-[3px] transition-shadow hover:ring-2 hover:ring-foreground/60',
                                !cell.count && 'bg-secondary',
                                isSelected && 'ring-2 ring-foreground'
                              )}
                              style={cellStyle(cell)}
                              aria-pressed={isSelected}
                              aria-label={`${DAYS[d]} ${formatHour(h)}: ${cell.count} video${cell.count ? `, performa ${formatPerformance(cell.performance)}` : ''}`}
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

                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
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
                        {[0.16, 0.36, 0.56, 0.76, 1].map(o => (
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

                {inspectedCell && (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-secondary/50 px-4 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">
                        {DAYS[inspectedCell.day]}, {formatHour(inspectedCell.hour)}–{formatHour(inspectedCell.hour + 1)}
                      </p>
                      <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                        {inspectedCell.count
                          ? `${inspectedCell.count} video • performa ${formatPerformance(inspectedCell.performance)} • median ${formatNumber(inspectedCell.medianViews)} views`
                          : 'Belum ada video diupload pada jam ini'}
                      </p>
                    </div>
                    {inspectedCell.count > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          showSlot(
                            { day: inspectedCell.day, from: inspectedCell.hour, to: inspectedCell.hour + 1 },
                            `${DAYS[inspectedCell.day]}, ${formatHour(inspectedCell.hour)}–${formatHour(inspectedCell.hour + 1)}`
                          )
                        }
                        className="yt-pill-primary"
                      >
                        Lihat {inspectedCell.count} video <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                )}
              </SectionCard>

              <div className="grid gap-6 lg:grid-cols-2">
                <SectionCard title="Performa per hari" description="1,0× = setara video seusia. Batang pudar = kurang dari 2 upload.">
                  <ul className="space-y-2">
                    {DAY_ORDER.map(d => {
                      const row = analysis.byDay[d];
                      const reliable = row.count >= MIN_SLOT_UPLOADS;
                      return (
                        <li key={d}>
                          <button
                            type="button"
                            disabled={!row.count}
                            onClick={() => showSlot({ day: d, from: 0, to: 24 }, DAYS[d])}
                            className="grid min-h-10 w-full grid-cols-[64px_1fr_96px] items-center gap-3 rounded-md px-1.5 text-left text-sm transition-colors enabled:hover:bg-secondary"
                          >
                            <span className="text-muted-foreground">{DAYS[d]}</span>
                            <span className="h-2 overflow-hidden rounded-full bg-secondary">
                              <span
                                className={cn(
                                  'block h-full w-full origin-left rounded-full',
                                  analysis.bestDay?.day === d ? 'bg-outlier' : 'bg-primary',
                                  !reliable && 'opacity-40'
                                )}
                                style={{ transform: `scaleX(${row.count ? row.performance / maxDayPerf : 0})` }}
                              />
                            </span>
                            <span className="text-right tabular-nums text-foreground">
                              {row.count ? formatPerformance(row.performance) : '-'}
                              <span className="ml-1 text-xs text-muted-foreground">({row.count})</span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </SectionCard>

                <SectionCard title="Performa per jam upload" description="Pilih kolom jam untuk melihat daftar videonya.">
                  <div className="flex h-40 items-stretch gap-[3px]">
                    {analysis.byHour.map(h => {
                      const heightPct = h.count ? Math.max(8, (h.performance / maxHourPerf) * 100) : 5;
                      return (
                        <button
                          type="button"
                          key={h.hour}
                          disabled={!h.count}
                          onClick={() => showSlot({ from: h.hour, to: h.hour + 1 }, `Pukul ${formatHour(h.hour)}–${formatHour(h.hour + 1)}`)}
                          aria-label={`${formatHour(h.hour)}: ${h.count} video${h.count ? `, performa ${formatPerformance(h.performance)}` : ''}`}
                          title={`${formatHour(h.hour)} — ${h.count} video${h.count ? `, performa ${formatPerformance(h.performance)}, median ${formatNumber(h.medianViews)} views` : ''}`}
                          className="group flex h-full flex-1 items-end rounded-sm transition-colors enabled:hover:bg-secondary/70"
                        >
                          <span
                            className={cn(
                              'block w-full rounded-t-sm transition-opacity group-hover:opacity-85',
                              h.count ? (analysis.bestHour?.hour === h.hour ? 'bg-outlier' : 'bg-primary') : 'bg-secondary',
                              h.count > 0 && h.count < MIN_SLOT_UPLOADS && 'opacity-40'
                            )}
                            style={{ height: `${heightPct}%` }}
                          />
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-2 flex justify-between text-[10px] tabular-nums text-muted-foreground">
                    <span>00.00</span>
                    <span>06.00</span>
                    <span>12.00</span>
                    <span>18.00</span>
                    <span>23.00</span>
                  </div>
                </SectionCard>
              </div>
            </div>
          )}

          {activeTab === 'ranking' && (
            <div id="schedule-panel-ranking" role="tabpanel" aria-labelledby="schedule-tab-ranking" className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <SectionCard title="Slot terbaik" description={`Blok 3 jam di atas rata-rata, minimal ${MIN_SLOT_UPLOADS} upload`}>
                  {analysis.best.length ? (
                    <SlotList
                      slots={analysis.best}
                      tone="good"
                      onSelect={sl => showSlot({ day: sl.day, from: sl.hour, to: sl.hour + sl.span }, `${DAYS[sl.day]}, ${formatSlotTime(sl)}`)}
                    />
                  ) : (
                    <NotEnough />
                  )}
                </SectionCard>
                <SectionCard title="Slot terendah" description={`Blok 3 jam di bawah rata-rata, minimal ${MIN_SLOT_UPLOADS} upload`}>
                  {analysis.worst.length ? (
                    <SlotList
                      slots={analysis.worst}
                      tone="bad"
                      onSelect={sl => showSlot({ day: sl.day, from: sl.hour, to: sl.hour + sl.span }, `${DAYS[sl.day]}, ${formatSlotTime(sl)}`)}
                    />
                  ) : (
                    <NotEnough />
                  )}
                </SectionCard>
              </div>

              <SectionCard
                title="Peringkat waktu upload"
                description={`Dikelompokkan per ${GROUPING_LABELS[grouping].toLowerCase()}, urut dari performa tertinggi. Kelompok dengan kurang dari ${MIN_SLOT_UPLOADS} upload ditaruh di bawah.`}
              >
                <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 no-scrollbar sm:-mx-6 sm:px-6" role="group" aria-label="Kelompokkan waktu upload">
                  <span className="self-center pr-1 text-sm text-muted-foreground">Kelompokkan:</span>
                  {GROUPINGS.map(g => (
                    <button
                      key={g}
                      type="button"
                      className="yt-chip"
                      aria-pressed={grouping === g}
                      data-active={grouping === g}
                      onClick={() => changeGrouping(g)}
                    >
                      {GROUPING_LABELS[g]}
                    </button>
                  ))}
                </div>
                <div
                  tabIndex={0}
                  role="region"
                  aria-label="Tabel peringkat waktu upload"
                  className="-mx-4 max-h-[480px] overflow-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:-mx-6"
                >
                  <table className="w-full min-w-[560px] text-sm">
                    <caption className="sr-only">Peringkat waktu upload dikelompokkan menurut {GROUPING_LABELS[grouping]}</caption>
                    <thead className="sticky top-0 bg-card">
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th scope="col" className="w-10 px-4 py-2 font-medium sm:pl-6">#</th>
                        <th scope="col" className="px-2 py-2 font-medium">{GROUPING_LABELS[grouping]}</th>
                        <th scope="col" className="px-2 py-2 text-right font-medium">Upload</th>
                        <th scope="col" className="px-2 py-2 text-right font-medium">Median views</th>
                        <th scope="col" className="w-[30%] px-2 py-2 font-medium">Performa</th>
                        <th scope="col" className="px-4 py-2 text-right font-medium sm:pr-6">Keyakinan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupRows.map((r, i) => (
                        <tr key={r.key} className={cn('border-b border-border last:border-0 hover:bg-secondary/60', !r.rankable && 'text-muted-foreground')}>
                          <td className="px-4 py-2 tabular-nums text-muted-foreground sm:pl-6">{r.rankable ? i + 1 : '–'}</td>
                          <td className="whitespace-nowrap px-2 py-2 font-medium">
                            <button type="button" onClick={() => showSlot(r.match, r.label)} className="text-left hover:text-primary hover:underline">
                              {r.label}
                            </button>
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums">{r.count}</td>
                          <td className="px-2 py-2 text-right tabular-nums">{formatNumber(r.medianViews)}</td>
                          <td className="px-2 py-2">
                            <div className="flex items-center gap-2">
                              <span className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                                <span
                                  className={cn('block h-full w-full origin-left rounded-full', r.performance >= 1 ? 'bg-primary' : 'bg-destructive', !r.rankable && 'opacity-40')}
                                  style={{ transform: `scaleX(${r.performance / maxGroupPerf})` }}
                                />
                              </span>
                              <span className="w-12 text-right tabular-nums">{formatPerformance(r.performance)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2 text-right sm:pr-6">
                            <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-medium', CONFIDENCE_STYLE[r.confidence])}>{r.confidence}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </div>
          )}

          {activeTab === 'videos' && (
            <div id="schedule-panel-videos" role="tabpanel" aria-labelledby="schedule-tab-videos">
              <SectionCard
                title="Detail upload per video"
                description={`Hari, tanggal, dan jam upload setiap video (zona waktu ${timeZone}). Performa = views dibanding video seusia.`}
              >
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  {listFilter ? (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-inverse px-3 py-1.5 text-sm font-medium text-inverse-foreground">
                      <Clock className="h-4 w-4" aria-hidden="true" /> {listFilter.label} · {formatFullNumber(listRows.length)} video
                      <button
                        type="button"
                        aria-label="Hapus filter slot"
                        onClick={() => setListFilter(null)}
                        className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full hover:bg-inverse-foreground/15"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ) : (
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {formatFullNumber(listRows.length)} video • pilih slot di Peta Panas atau Peringkat untuk memfilter
                    </span>
                  )}
                  <div className="ml-auto flex flex-wrap items-center gap-2" role="group" aria-label="Urutkan daftar video">
                    {LIST_SORTS.map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        className="yt-chip"
                        aria-pressed={listSort === id}
                        data-active={listSort === id}
                        onClick={() => setListSort(id)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div
                  tabIndex={0}
                  role="region"
                  aria-label="Tabel detail upload per video"
                  className="-mx-4 overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:-mx-6"
                >
                  <table className="w-full text-sm sm:min-w-[820px]">
                    <caption className="sr-only">Detail jadwal upload per video</caption>
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th scope="col" className="px-4 py-2 font-medium sm:pl-6">Video</th>
                        <th scope="col" className="hidden px-2 py-2 font-medium sm:table-cell">Hari & tanggal</th>
                        <th scope="col" className="hidden px-2 py-2 font-medium sm:table-cell">Jam</th>
                        <th scope="col" className="hidden px-2 py-2 font-medium sm:table-cell">Bagian hari</th>
                        <th scope="col" className="hidden px-2 py-2 text-right font-medium sm:table-cell">Umur</th>
                        <th scope="col" className="hidden px-2 py-2 text-right font-medium sm:table-cell">Views</th>
                        <th scope="col" className="hidden px-4 py-2 text-right font-medium sm:table-cell sm:pr-6">Performa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {listRows.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground sm:px-6">
                            Tidak ada video di slot ini untuk periode & format yang dipilih.
                          </td>
                        </tr>
                      )}
                      {listRows.slice(0, listLimit).map(r => (
                        <tr key={r.video.id} className="border-b border-border last:border-0 hover:bg-secondary/60">
                          <td className="px-4 py-2 sm:pl-6">
                            <button
                              type="button"
                              onClick={() => onPreview?.(r.video)}
                              disabled={!onPreview}
                              className="group flex w-full items-center gap-3 text-left"
                            >
                              <img src={r.video.thumbnail} alt="" loading="lazy" className="aspect-video w-24 shrink-0 rounded-lg bg-secondary object-cover" />
                              <span className="min-w-0">
                                <span className="line-clamp-2 block font-medium text-foreground group-hover:text-primary">{r.video.title}</span>
                                <span className="mt-0.5 block text-xs text-muted-foreground">
                                  {r.video.isShort ? 'Shorts' : 'Video'} • {r.video.durationFormatted}
                                </span>
                                <span className="mt-1 block text-xs font-medium text-foreground sm:hidden">
                                  {formatDateWithDay(r.video.publishedAt)} • {formatTime(r.video.publishedAt)} • {daypartOf(r.hour)}
                                </span>
                                <span className="mt-0.5 block text-xs tabular-nums text-muted-foreground sm:hidden">
                                  {formatNumber(r.video.viewCountRaw)} views • performa {formatPerformance(r.reach)} •{' '}
                                  {r.ageDays === 0 ? 'hari ini' : `${formatFullNumber(r.ageDays)} hari lalu`}
                                </span>
                              </span>
                            </button>
                          </td>
                          <td className="hidden whitespace-nowrap px-2 py-2 sm:table-cell" title={formatDateTimeLong(r.video.publishedAt)}>
                            {formatDateWithDay(r.video.publishedAt)}
                          </td>
                          <td className="hidden whitespace-nowrap px-2 py-2 font-medium tabular-nums sm:table-cell">{formatTime(r.video.publishedAt)}</td>
                          <td className="hidden whitespace-nowrap px-2 py-2 text-muted-foreground sm:table-cell">{daypartOf(r.hour)}</td>
                          <td className="hidden whitespace-nowrap px-2 py-2 text-right tabular-nums text-muted-foreground sm:table-cell">
                            {r.ageDays === 0 ? 'hari ini' : `${formatFullNumber(r.ageDays)} hari`}
                          </td>
                          <td className="hidden px-2 py-2 text-right tabular-nums sm:table-cell">{formatNumber(r.video.viewCountRaw)}</td>
                          <td className="hidden px-4 py-2 text-right sm:table-cell sm:pr-6">
                            <span
                              className={cn(
                                'rounded px-1.5 py-0.5 text-xs font-medium tabular-nums',
                                r.reach >= 1.05 ? 'bg-primary/15 text-primary' : r.reach <= 0.95 ? 'bg-destructive/10 text-destructive' : 'bg-secondary text-foreground'
                              )}
                            >
                              {formatPerformance(r.reach)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {listRows.length > listLimit && (
                  <div className="mt-4 flex justify-center">
                    <button type="button" className="yt-pill" onClick={() => setListLimit(l => l + LIST_PAGE * 2)}>
                      Tampilkan lebih banyak ({formatFullNumber(listRows.length - listLimit)} lagi)
                    </button>
                  </div>
                )}
              </SectionCard>
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

const SlotList: React.FC<{ slots: Slot[]; tone: 'good' | 'bad'; onSelect?: (s: Slot) => void }> = ({ slots, tone, onSelect }) => (
  <ul className="divide-y divide-border">
    {slots.map((s, i) => (
      <li key={`${s.day}-${s.hour}`} className="py-1 first:pt-0 last:pb-0">
        <button
          type="button"
          onClick={() => onSelect?.(s)}
          className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-secondary"
        >
          <span
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium',
              tone === 'good' ? 'bg-success/15 text-success' : 'bg-destructive/10 text-destructive'
            )}
          >
            {tone === 'good' ? <TrendingUp className="h-4 w-4" aria-hidden="true" /> : <TrendingDown className="h-4 w-4" aria-hidden="true" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-foreground">
              {i + 1}. {DAYS[s.day]}, {formatSlotTime(s)}
            </span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs tabular-nums text-muted-foreground">
              <span>{s.count} upload</span>
              <span>• median {formatNumber(s.medianViews)} views</span>
              <span className={cn('rounded px-1.5 py-px text-[10px] font-medium', CONFIDENCE_STYLE[s.confidence])}>
                keyakinan {s.confidence}
              </span>
            </span>
          </span>
          <span className="text-right">
            <span className="block text-sm font-semibold tabular-nums text-foreground">{formatPerformance(s.performance)}</span>
            <span className="block text-[11px] text-muted-foreground">performa</span>
          </span>
        </button>
      </li>
    ))}
  </ul>
);

export default UploadScheduleAnalyzer;
