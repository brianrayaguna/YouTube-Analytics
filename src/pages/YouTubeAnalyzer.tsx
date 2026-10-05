import React, { useState, useEffect, useMemo, useRef, useCallback, Suspense, lazy } from 'react';
import {
  SlidersHorizontal,
  Link2,
  ImageDown,
  FileDown,
  CheckSquare,
  X,
  Bookmark,
  BookmarkMinus,
  Search,
  KeyRound,
  Flame,
  BarChart3,
  Gauge,
  CalendarClock,
  Lightbulb,
  ChevronDown,
  Check,
  History as HistoryIcon,
} from 'lucide-react';
import {
  ToastState,
  ToastType,
  AnalyzedData,
  AnalysisMode,
  ContentTypeFilter,
  SortOption,
  FetchLimit,
  VideoItem,
  TrendingRegion,
} from '../types';
import AppHeader from '../components/AppHeader';
import Sidebar from '../components/Sidebar';
import MobileNav from '../components/MobileNav';
import BottomNav from '../components/BottomNav';
import Toast from '../components/Toast';
import SkeletonCard from '../components/SkeletonCard';
import VideoGrid from '../components/VideoGrid';
import ChannelHeader from '../components/ChannelHeader';
import VideoPreviewModal from '../components/VideoPreviewModal';
import SettingsDialog from '../components/SettingsDialog';
import FilterDialog from '../components/FilterDialog';
import { EmptyState, NeedDataState } from '../components/common';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { fetchYouTubeData, fetchTrendingVideos, getQuotaUsage, classifyQuery } from '../services/youtubeService';
import { copyToClipboard } from '../services/exportService';
import ExportDialog, { ExportScope } from '../components/ExportDialog';
import { generateZip } from '../services/zipService';
import { addToSearchHistory, getSearchHistory } from '../services/historyService';
import { applyFilters, countActiveFilters, describeFilters, DEFAULT_FILTERS, SORT_LABELS, VideoFilters } from '../lib/filters';
import { timeAgo, formatFullNumber } from '../lib/format';
import { getNavItem } from '../config/navigation';
import { withShortsClassification } from '../lib/video';
import { cn } from '@/lib/utils';

// Halaman analisis dimuat terpisah (code-splitting) agar bundle awal ringan
const InsightsDashboard = lazy(() => import('../components/InsightsDashboard'));
const CompetitorBenchmark = lazy(() => import('../components/CompetitorBenchmark'));
const ContentGapAnalyzer = lazy(() => import('../components/ContentGapAnalyzer'));
const UploadScheduleAnalyzer = lazy(() => import('../components/UploadScheduleAnalyzer'));
const TitleScoreAnalyzer = lazy(() => import('../components/TitleScoreAnalyzer'));
const SearchHistoryPage = lazy(() => import('../components/SearchHistoryPage'));
const DownloaderPage = lazy(() => import('../components/DownloaderPage'));

const TRENDING_REGIONS: TrendingRegion[] = [
  { code: 'ID', name: 'Indonesia' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'SG', name: 'Singapura' },
  { code: 'US', name: 'Amerika Serikat' },
  { code: 'GB', name: 'Inggris' },
  { code: 'IN', name: 'India' },
  { code: 'PH', name: 'Filipina' },
  { code: 'BR', name: 'Brasil' },
  { code: 'JP', name: 'Jepang' },
  { code: 'KR', name: 'Korea Selatan' },
  { code: 'CA', name: 'Kanada' },
  { code: 'DE', name: 'Jerman' },
  { code: 'AU', name: 'Australia' },
  { code: 'FR', name: 'Prancis' },
];

const GRID_MODES: AnalysisMode[] = ['dashboard', 'trending', 'saved'];
const QUICK_SORTS: SortOption[] = ['popular', 'newest', 'highest_er', 'most_liked'];
const EXAMPLE_QUERIES = ['@MrBeast', '@windahbasudara', 'review hp terbaru', 'https://youtu.be/dQw4w9WgXcQ'];

const readLocal = <T,>(key: string, fallback: T, parse: (raw: string) => T = JSON.parse): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : parse(raw);
  } catch {
    return fallback;
  }
};

const writeLocal = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage penuh — abaikan
  }
};

const PageFallback = () => (
  <div className="flex justify-center py-24">
    <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-secondary border-t-primary" aria-label="Memuat" />
  </div>
);

const YouTubeAnalyzer: React.FC = () => {
  // --- UI state ---
  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains('dark'));
  const [sidebarExpanded, setSidebarExpanded] = useState(() =>
    readLocal('yt_sidebar_expanded', window.innerWidth >= 1280, raw => raw === 'true')
  );
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mode, setMode] = useState<AnalysisMode>('dashboard');

  // --- Data state ---
  const [apiKey, setApiKey] = useState(() => readLocal('yt_api_key_v5', '', raw => raw));
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AnalyzedData | null>(null);
  const [trendingData, setTrendingData] = useState<AnalyzedData | null>(null);
  const [trendingRegion, setTrendingRegion] = useState(() => readLocal('yt_trending_region', 'ID', raw => raw));
  const [savedVideos, setSavedVideos] = useState<VideoItem[]>(() =>
    readLocal<VideoItem[]>('yt_saved_videos', []).map(v => withShortsClassification({ ...v, publishedTimeAgo: timeAgo(v.publishedAt) }))
  );
  const [filters, setFilters] = useState<VideoFilters>(DEFAULT_FILTERS);
  const [fetchLimit, setFetchLimit] = useState<FetchLimit>(() =>
    readLocal('yt_fetch_limit', 50 as FetchLimit, raw => (Number(raw) || 50) as FetchLimit)
  );
  const [quotaUsed, setQuotaUsed] = useState(getQuotaUsage);

  // --- Toast ---
  const [toast, setToast] = useState<ToastState | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  const toastId = useRef(0);

  // --- Preview & selection ---
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportScope, setExportScope] = useState<ExportScope>('filtered');

  const searchInputRef = useRef<HTMLInputElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    clearTimeout(toastTimer.current);
    setToast(prev => ({
      // Toast "loading" berturut-turut memakai id yang sama agar tidak berkedip
      id: prev && prev.type === 'loading' && type === 'loading' ? prev.id : ++toastId.current,
      message,
      type,
    }));
    if (type !== 'loading') {
      toastTimer.current = setTimeout(() => setToast(null), type === 'error' ? 6000 : 3500);
    }
  }, []);

  const focusSearch = useCallback(() => {
    const input = searchInputRef.current;
    if (input && input.offsetParent !== null) {
      input.focus();
      input.select();
    } else {
      // Mobile: kolom pencarian tersembunyi — buka mode pencarian lewat tombol header
      document.querySelector<HTMLButtonElement>('button[aria-label="Cari"]')?.click();
    }
  }, []);

  useKeyboardShortcuts({
    onSearch: focusSearch,
    onEscape: () => {
      setMobileNavOpen(false);
      if (selectMode) {
        setSelectMode(false);
        setSelectedIds(new Set());
      }
    },
    onToggleTheme: () => setDarkMode(d => !d),
    enabled: !previewId && !settingsOpen && !filtersOpen,
  });

  // --- Effects ---
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    writeLocal('yt_dark_mode', String(darkMode));
    document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute('content', darkMode ? '#0f0f0f' : '#ffffff'));
  }, [darkMode]);

  useEffect(() => writeLocal('yt_sidebar_expanded', String(sidebarExpanded)), [sidebarExpanded]);
  useEffect(() => writeLocal('yt_fetch_limit', String(fetchLimit)), [fetchLimit]);
  useEffect(() => writeLocal('yt_trending_region', trendingRegion), [trendingRegion]);
  useEffect(() => writeLocal('yt_saved_videos', JSON.stringify(savedVideos)), [savedVideos]);

  useEffect(() => {
    const update = () => setQuotaUsed(getQuotaUsage());
    const onStorage = (e: StorageEvent) => e.key === 'yt_quota_usage_v1' && update();
    window.addEventListener('quotaUpdated', update);
    window.addEventListener('storage', onStorage);
    const interval = setInterval(update, 60000); // reset harian
    return () => {
      window.removeEventListener('quotaUpdated', update);
      window.removeEventListener('storage', onStorage);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // Judul tab dinamis
  useEffect(() => {
    const page = mode === 'dashboard' && data ? data.channelTitle : getNavItem(mode)?.label;
    document.title = page ? `${page} - YT Analyzer Pro` : 'YT Analyzer Pro';
  }, [mode, data]);

  const scrollTop = () => window.scrollTo({ top: 0 });

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setSelectMode(false);
  }, []);

  // --- Data loading ---
  const ensureApiKey = useCallback(() => {
    if (apiKey) return true;
    setSettingsOpen(true);
    showToast('Masukkan YouTube API Key terlebih dahulu', 'error');
    return false;
  }, [apiKey, showToast]);

  const handleAnalyze = useCallback(
    async (searchQuery: string) => {
      const q = searchQuery.trim();
      if (!q || !ensureApiKey()) return;
      setLoading(true);
      clearSelection();
      // Tetap di halaman analisis yang sedang dibuka, selain itu pindah ke Beranda
      setMode(m => (getNavItem(m)?.needsData ? m : 'dashboard'));
      scrollTop();
      try {
        const result = await fetchYouTubeData(apiKey, q, fetchLimit);
        setData(result);
        setFilters(f => ({ ...DEFAULT_FILTERS, sort: f.sort }));
        addToSearchHistory({ query: q, type: classifyQuery(q), resultCount: result.videos.length, title: result.channelTitle });
        showToast(`${formatFullNumber(result.videos.length)} video berhasil dianalisis`, 'success');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Gagal mengambil data', 'error');
      } finally {
        setLoading(false);
      }
    },
    [apiKey, fetchLimit, ensureApiKey, clearSelection, showToast]
  );

  const handleTrending = useCallback(
    async (region: string = trendingRegion, force = false) => {
      setMode('trending');
      clearSelection();
      scrollTop();
      if (!force && trendingData?.query === region) return;
      if (!ensureApiKey()) return;
      setLoading(true);
      try {
        const result = await fetchTrendingVideos(apiKey, Math.min(fetchLimit, 200), region);
        setTrendingData(result);
        showToast(`Trending ${TRENDING_REGIONS.find(r => r.code === region)?.name ?? region} dimuat`, 'success');
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Gagal memuat trending', 'error');
      } finally {
        setLoading(false);
      }
    },
    [apiKey, fetchLimit, trendingRegion, trendingData, ensureApiKey, clearSelection, showToast]
  );

  const handleNavigate = useCallback(
    (next: AnalysisMode) => {
      if (next === 'trending') {
        handleTrending();
        return;
      }
      setMode(next);
      clearSelection();
      scrollTop();
    },
    [handleTrending, clearSelection]
  );

  const saveApiKey = (key: string) => {
    setApiKey(key);
    writeLocal('yt_api_key_v5', key);
  };

  // --- Daftar video aktif ---
  const sourceVideos = useMemo(() => {
    if (mode === 'saved') return savedVideos;
    if (mode === 'trending') return trendingData?.videos ?? [];
    return data?.videos ?? [];
  }, [mode, savedVideos, trendingData, data]);

  const filteredVideos = useMemo(() => applyFilters(sourceVideos, filters), [sourceVideos, filters]);
  const savedIds = useMemo(() => new Set(savedVideos.map(v => v.id)), [savedVideos]);
  const activeFilterCount = countActiveFilters(filters);

  const exportName = useMemo(() => {
    if (mode === 'saved') return 'Tersimpan';
    if (mode === 'trending') return `Trending_${trendingData?.query ?? trendingRegion}`;
    return data?.channelTitle || 'YouTube';
  }, [mode, data, trendingData, trendingRegion]);

  // --- Aksi video ---
  const handleSaveToggle = useCallback((video: VideoItem) => {
    setSavedVideos(prev => (prev.some(v => v.id === video.id) ? prev.filter(v => v.id !== video.id) : [video, ...prev]));
  }, []);

  const handleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handlePreview = useCallback((video: VideoItem) => setPreviewId(video.id), []);

  const selectedList = useMemo(() => filteredVideos.filter(v => selectedIds.has(v.id)), [filteredVideos, selectedIds]);
  const allSelected = filteredVideos.length > 0 && selectedList.length === filteredVideos.length;

  const copyLinks = async (list: VideoItem[]) => {
    if (!list.length) return;
    try {
      await copyToClipboard(list.map(v => `https://www.youtube.com/watch?v=${v.id}`).join('\n'));
      showToast(`${formatFullNumber(list.length)} link disalin`, 'success');
    } catch {
      showToast('Gagal menyalin link', 'error');
    }
  };

  const downloadZip = async (list: VideoItem[], name: string) => {
    if (!list.length || busy) return;
    setBusy(true);
    showToast(`Menyiapkan ${formatFullNumber(list.length)} thumbnail…`, 'loading');
    try {
      const { failed } = await generateZip(list, name, p => p > 0 && p < 100 && showToast(`Membuat ZIP… ${p}%`, 'loading'));
      showToast(failed ? `ZIP diunduh (${failed} thumbnail gagal)` : 'ZIP thumbnail diunduh', failed ? 'info' : 'success');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Gagal membuat ZIP', 'error');
    } finally {
      setBusy(false);
    }
  };

  const openExport = (scope: ExportScope) => {
    setExportScope(scope);
    setExportOpen(true);
  };

  const handleBatchSave = () => {
    if (mode === 'saved') {
      setSavedVideos(prev => prev.filter(v => !selectedIds.has(v.id)));
      showToast(`${selectedList.length} video dihapus dari Tersimpan`, 'success');
    } else {
      const fresh = selectedList.filter(v => !savedIds.has(v.id));
      setSavedVideos(prev => [...fresh, ...prev]);
      showToast(fresh.length ? `${fresh.length} video disimpan` : 'Semua video terpilih sudah tersimpan', 'success');
    }
    clearSelection();
  };

  // --- Preview navigation ---
  const previewIndex = previewId ? filteredVideos.findIndex(v => v.id === previewId) : -1;
  const previewVideo =
    previewIndex >= 0 ? filteredVideos[previewIndex] : previewId ? sourceVideos.find(v => v.id === previewId) ?? null : null;

  const handleAnalyzeChannel = (channelId: string) => {
    setPreviewId(null);
    setQuery(channelId);
    handleAnalyze(channelId);
  };

  // --- Render helpers ---
  const regionName = TRENDING_REGIONS.find(r => r.code === (trendingData?.query ?? trendingRegion))?.name;
  const hasGridData = mode === 'saved' ? savedVideos.length > 0 : mode === 'trending' ? !!trendingData : !!data;

  const chipBar = (
    <div className="sticky top-14 z-30 -mx-4 mb-4 bg-background px-4 py-3 sm:-mx-6 sm:px-6">
      <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
        {mode === 'trending' && (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button type="button" className="yt-chip" data-active="true">
                <Flame className="h-4 w-4" /> {regionName ?? trendingRegion} <ChevronDown className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-80 w-56 overflow-y-auto rounded-xl py-2 shadow-popover">
              {TRENDING_REGIONS.map(r => (
                <DropdownMenuItem
                  key={r.code}
                  className="h-9 gap-3 rounded-none px-4"
                  onSelect={() => {
                    setTrendingRegion(r.code);
                    handleTrending(r.code);
                  }}
                >
                  <span className="w-5">{r.code === (trendingData?.query ?? trendingRegion) && <Check className="h-4 w-4" />}</span>
                  {r.name}
                  <span className="ml-auto text-xs text-muted-foreground">{r.code}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {(['all', 'long', 'shorts'] as ContentTypeFilter[]).map(type => (
          <button
            key={type}
            type="button"
            className="yt-chip"
            data-active={filters.contentType === type}
            onClick={() => setFilters(f => ({ ...f, contentType: type }))}
          >
            {type === 'all' ? 'Semua' : type === 'long' ? 'Video' : 'Shorts'}
          </button>
        ))}
        <span className="h-6 w-px shrink-0 bg-border" aria-hidden="true" />
        {QUICK_SORTS.map(sort => (
          <button
            key={sort}
            type="button"
            className="yt-chip"
            data-active={filters.sort === sort}
            onClick={() => setFilters(f => ({ ...f, sort }))}
          >
            {SORT_LABELS[sort]}
          </button>
        ))}
        {!QUICK_SORTS.includes(filters.sort) && (
          <button type="button" className="yt-chip" data-active="true" onClick={() => setFiltersOpen(true)}>
            {SORT_LABELS[filters.sort]}
          </button>
        )}
        {filters.outliersOnly ? (
          <button type="button" className="yt-chip" data-active="true" onClick={() => setFilters(f => ({ ...f, outliersOnly: false }))}>
            Outlier <X className="h-4 w-4" />
          </button>
        ) : (
          <button type="button" className="yt-chip" onClick={() => setFilters(f => ({ ...f, outliersOnly: true }))}>
            Outlier
          </button>
        )}
        <button type="button" className="yt-chip ml-auto" data-active={activeFilterCount > 0} onClick={() => setFiltersOpen(true)}>
          <SlidersHorizontal className="h-4 w-4" />
          Filter{activeFilterCount > 0 && ` · ${activeFilterCount}`}
        </button>
      </div>
    </div>
  );

  const resultsToolbar = (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        Menampilkan <span className="font-medium text-foreground">{formatFullNumber(filteredVideos.length)}</span> dari{' '}
        {formatFullNumber(sourceVideos.length)} video
        {activeFilterCount > 0 && (
          <button type="button" className="ml-2 text-primary hover:underline" onClick={() => setFilters(f => ({ ...DEFAULT_FILTERS, contentType: f.contentType, sort: f.sort }))}>
            Reset filter
          </button>
        )}
      </p>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:px-0">
        <button type="button" className="yt-pill" onClick={() => copyLinks(filteredVideos)} disabled={!filteredVideos.length}>
          <Link2 className="h-5 w-5" strokeWidth={1.75} /> Salin semua link
        </button>
        <button
          type="button"
          className="yt-pill"
          onClick={() => downloadZip(filteredVideos, exportName)}
          disabled={!filteredVideos.length || busy}
        >
          <ImageDown className="h-5 w-5" strokeWidth={1.75} /> Thumbnail (ZIP)
        </button>
        <button
          type="button"
          className="yt-pill"
          onClick={() => openExport('filtered')}
          disabled={!filteredVideos.length}
        >
          <FileDown className="h-5 w-5" strokeWidth={1.75} /> Ekspor
        </button>
        <button
          type="button"
          className={cn('yt-pill', selectMode && 'bg-inverse text-inverse-foreground hover:bg-inverse')}
          onClick={() => (selectMode ? clearSelection() : setSelectMode(true))}
          disabled={!filteredVideos.length}
        >
          <CheckSquare className="h-5 w-5" strokeWidth={1.75} /> {selectMode ? 'Batal pilih' : 'Pilih'}
        </button>
      </div>
    </div>
  );

  const homeEmpty = (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-12 text-center sm:py-20">
      <svg viewBox="0 0 28 20" className="h-14 w-20" aria-hidden="true">
        <rect width="28" height="20" rx="5.5" fill="hsl(var(--yt-red))" />
        <path d="M11.2 5.6v8.8l7.6-4.4z" fill="#fff" />
      </svg>
      <h1 className="mt-6 text-2xl font-bold text-foreground sm:text-[28px]">Analisis channel YouTube apa pun</h1>
      <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
        Tempel <b className="font-medium text-foreground">@handle</b>, URL channel, URL playlist, URL video, atau ketik kata kunci di kolom
        pencarian. Dapatkan statistik, skor judul &amp; thumbnail, jadwal upload terbaik, dan ekspor data.
      </p>

      {!apiKey ? (
        <div className="yt-card mt-8 w-full max-w-md p-5 text-left">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-medium text-foreground">Langkah pertama: atur API Key</h2>
              <p className="mt-1 text-sm text-muted-foreground">Aplikasi butuh YouTube Data API v3 key (gratis, 10.000 unit/hari).</p>
              <button type="button" className="yt-pill-blue mt-4" onClick={() => setSettingsOpen(true)}>
                Atur API Key
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {EXAMPLE_QUERIES.map(q => (
              <button
                key={q}
                type="button"
                className="yt-chip"
                onClick={() => {
                  setQuery(q);
                  handleAnalyze(q);
                }}
              >
                <Search className="h-4 w-4" /> {q.length > 28 ? `${q.slice(0, 28)}…` : q}
              </button>
            ))}
          </div>
          {getSearchHistory().length > 0 && (
            <div className="mt-8 w-full max-w-md text-left">
              <h2 className="mb-2 text-sm font-medium text-foreground">Lanjutkan dari riwayat</h2>
              <ul className="yt-card divide-y divide-border overflow-hidden">
                {getSearchHistory().slice(0, 4).map(h => (
                  <li key={h.timestamp}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-secondary"
                      onClick={() => {
                        setQuery(h.query);
                        handleAnalyze(h.query);
                      }}
                    >
                      <HistoryIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1 truncate">{h.title || h.query}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(h.timestamp)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <div className="mt-12 grid w-full grid-cols-2 gap-3 text-left sm:grid-cols-4">
        {[
          { icon: BarChart3, title: 'Statistik', text: 'Views, ER, outlier, tag' },
          { icon: Gauge, title: 'Skor', text: 'Judul & thumbnail A–F' },
          { icon: CalendarClock, title: 'Jadwal', text: 'Hari & jam upload terbaik' },
          { icon: Lightbulb, title: 'Content Gap', text: 'Topik trending terlewat' },
        ].map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-xl bg-secondary p-4">
            <Icon className="h-5 w-5 text-foreground" strokeWidth={1.75} />
            <p className="mt-3 text-sm font-medium text-foreground">{title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{text}</p>
          </div>
        ))}
      </div>
    </div>
  );

  const renderGridMode = () => {
    if (loading) {
      return (
        <div className="grid grid-cols-1 gap-x-4 gap-y-10 pt-16 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      );
    }

    if (mode === 'dashboard' && !data) return homeEmpty;
    if (mode === 'trending' && !trendingData) {
      return (
        <EmptyState
          icon={Flame}
          title="Trending belum dimuat"
          description={apiKey ? 'Pilih wilayah lalu muat video yang sedang trending.' : 'Atur API Key untuk memuat video trending.'}
          action={
            <button type="button" className="yt-pill-primary" onClick={() => (apiKey ? handleTrending(trendingRegion, true) : setSettingsOpen(true))}>
              {apiKey ? 'Muat trending' : 'Atur API Key'}
            </button>
          }
        />
      );
    }
    if (mode === 'saved' && savedVideos.length === 0) {
      return (
        <EmptyState
          icon={Bookmark}
          title="Belum ada video tersimpan"
          description="Simpan video lewat ikon bookmark di thumbnail, menu ⋮, atau pilih beberapa sekaligus dengan tombol Pilih."
        />
      );
    }

    return (
      <>
        {mode === 'dashboard' && data && <ChannelHeader data={data} />}
        {mode === 'trending' && trendingData && <ChannelHeader data={trendingData} regionName={regionName} />}
        {mode === 'saved' && (
          <div className="mb-4">
            <h1 className="yt-page-title">Tersimpan</h1>
            <p className="mt-1 text-sm text-muted-foreground">{formatFullNumber(savedVideos.length)} video • disimpan di browser ini</p>
          </div>
        )}
        {chipBar}
        {resultsToolbar}
        {filteredVideos.length === 0 ? (
          <EmptyState
            icon={SlidersHorizontal}
            title="Tidak ada video yang cocok"
            description="Coba ubah jenis konten atau longgarkan filter."
            action={
              <button type="button" className="yt-pill" onClick={() => setFilters(DEFAULT_FILTERS)}>
                Reset semua filter
              </button>
            }
          />
        ) : (
          <VideoGrid
            videos={filteredVideos}
            contentType={filters.contentType}
            onShowAllShorts={() => {
              setFilters(f => ({ ...f, contentType: 'shorts' }));
              scrollTop();
            }}
            onToast={showToast}
            savedIds={savedIds}
            onSaveToggle={handleSaveToggle}
            onPreview={handlePreview}
            selectable={selectMode}
            selectedIds={selectedIds}
            onSelect={handleSelect}
          />
        )}
      </>
    );
  };

  const renderAnalysisMode = () => {
    const needData = (icon: typeof BarChart3, feature: string) => <NeedDataState icon={icon} feature={feature} onFocusSearch={focusSearch} />;
    if (loading) return <PageFallback />;
    switch (mode) {
      case 'insights':
        return data ? <InsightsDashboard data={data} onPreview={handlePreview} /> : needData(BarChart3, 'Statistik Channel');
      case 'title_score':
        return data?.videos.length ? <TitleScoreAnalyzer videos={data.videos} onPreview={handlePreview} /> : needData(Gauge, 'Skor Judul & Thumbnail');
      case 'schedule':
        return data?.videos.length ? <UploadScheduleAnalyzer videos={data.videos} /> : needData(CalendarClock, 'Jadwal Upload');
      case 'content_gap':
        return data?.videos.length ? (
          <ContentGapAnalyzer channelVideos={data.videos} channelTitle={data.channelTitle} apiKey={apiKey} onToast={showToast} onRequireApiKey={() => setSettingsOpen(true)} />
        ) : (
          needData(Lightbulb, 'Content Gap')
        );
      case 'benchmark':
        return <CompetitorBenchmark apiKey={apiKey} onRequireApiKey={() => setSettingsOpen(true)} defaultChannel={data?.source === 'channel' ? data.channelStats?.customUrl || data.channelId : undefined} />;
      case 'history':
        return (
          <SearchHistoryPage
            onSearch={q => {
              setQuery(q);
              handleAnalyze(q);
            }}
            onToast={showToast}
          />
        );
      case 'downloader':
        return <DownloaderPage onToast={showToast} />;
      default:
        return null;
    }
  };

  const mainOffset = sidebarExpanded ? 'md:pl-60' : 'md:pl-[72px]';

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        onMenu={() => (window.matchMedia('(min-width: 768px)').matches ? setSidebarExpanded(x => !x) : setMobileNavOpen(true))}
        onLogo={() => handleNavigate('dashboard')}
        query={query}
        setQuery={setQuery}
        onSearch={handleAnalyze}
        onToast={showToast}
        searchInputRef={searchInputRef}
        darkMode={darkMode}
        onToggleTheme={() => setDarkMode(d => !d)}
        onOpenSettings={() => setSettingsOpen(true)}
        quotaUsed={quotaUsed}
        hasApiKey={!!apiKey}
      />

      {loading && (
        <div className="fixed left-0 right-0 top-0 z-[160] h-0.5 overflow-hidden" role="progressbar" aria-label="Memuat">
          <div className="h-full w-1/3 animate-loading-bar bg-youtube-red" />
        </div>
      )}

      <Sidebar
        expanded={sidebarExpanded}
        currentMode={mode}
        onNavigate={handleNavigate}
        savedCount={savedVideos.length}
        hasData={!!data}
      />

      <MobileNav
        isOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        currentMode={mode}
        onNavigate={handleNavigate}
        savedCount={savedVideos.length}
        hasData={!!data}
      />

      <main ref={mainRef} className={cn('pb-24 pt-14 md:pb-10', mainOffset)}>
        <div className="mx-auto max-w-[2400px] px-4 pt-2 sm:px-6">
          {GRID_MODES.includes(mode) ? (
            renderGridMode()
          ) : (
            <Suspense fallback={<PageFallback />}>
              <div className="pt-4">{renderAnalysisMode()}</div>
            </Suspense>
          )}
        </div>
      </main>

      <BottomNav currentMode={mode} onNavigate={handleNavigate} onOpenMore={() => setMobileNavOpen(true)} />

      {/* Bar seleksi (multi-select) */}
      {selectMode && GRID_MODES.includes(mode) && (
        <div className="fixed bottom-[68px] left-1/2 z-[200] w-[calc(100%-24px)] max-w-3xl -translate-x-1/2 md:bottom-6">
          <div className="flex items-center gap-2 overflow-x-auto rounded-xl bg-inverse px-2 py-2 text-inverse-foreground shadow-popover no-scrollbar">
            <button type="button" onClick={clearSelection} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-white/10 dark:hover:bg-black/10" aria-label="Batal">
              <X className="h-5 w-5" />
            </button>
            <span className="shrink-0 pr-2 text-sm font-medium">{selectedList.length} dipilih</span>
            <button
              type="button"
              onClick={() => setSelectedIds(allSelected ? new Set() : new Set(filteredVideos.map(v => v.id)))}
              className="h-9 shrink-0 rounded-full px-3 text-sm font-medium text-[#3ea6ff] hover:bg-white/10 dark:text-primary dark:hover:bg-black/10"
            >
              {allSelected ? 'Batalkan semua' : 'Pilih semua'}
            </button>
            <div className="ml-auto flex shrink-0 items-center gap-1">
              {[
                {
                  label: mode === 'saved' ? 'Hapus' : 'Simpan',
                  icon: mode === 'saved' ? BookmarkMinus : Bookmark,
                  onClick: handleBatchSave,
                },
                { label: 'Salin link', icon: Link2, onClick: () => copyLinks(selectedList) },
                { label: 'ZIP', icon: ImageDown, onClick: () => downloadZip(selectedList, `${exportName}_terpilih`) },
                { label: 'Ekspor', icon: FileDown, onClick: () => openExport('selected') },
              ].map(({ label, icon: Icon, onClick }) => (
                <button
                  key={label}
                  type="button"
                  onClick={onClick}
                  disabled={!selectedList.length || busy}
                  className="flex h-9 items-center gap-2 rounded-full px-3 text-sm font-medium hover:bg-white/10 disabled:opacity-40 dark:hover:bg-black/10"
                >
                  <Icon className="h-4 w-4" /> <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <VideoPreviewModal
        video={previewVideo}
        isOpen={!!previewVideo}
        onClose={() => setPreviewId(null)}
        onNext={() => previewIndex < filteredVideos.length - 1 && setPreviewId(filteredVideos[previewIndex + 1].id)}
        onPrev={() => previewIndex > 0 && setPreviewId(filteredVideos[previewIndex - 1].id)}
        hasNext={previewIndex >= 0 && previewIndex < filteredVideos.length - 1}
        hasPrev={previewIndex > 0}
        position={previewIndex >= 0 ? { index: previewIndex, total: filteredVideos.length } : undefined}
        onSaveToggle={handleSaveToggle}
        onAnalyzeChannel={handleAnalyzeChannel}
        isSaved={previewVideo ? savedIds.has(previewVideo.id) : false}
        onToast={showToast}
      />

      <ExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        scopes={{ filtered: filteredVideos, all: sourceVideos, selected: selectMode ? selectedList : [] }}
        defaultScope={exportScope}
        context={{
          title: mode === 'saved' ? 'Video tersimpan' : mode === 'trending' ? `Trending ${regionName ?? ''}`.trim() : data?.channelTitle || 'Analisis YouTube',
          source: mode === 'saved' ? 'saved' : mode === 'trending' ? 'trending' : data?.source,
          query: mode === 'trending' ? trendingData?.query : data?.query,
          channelStats: mode === 'dashboard' && data?.source === 'channel' ? data.channelStats : undefined,
        }}
        filterNote={describeFilters(filters)}
        onToast={showToast}
      />

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} apiKey={apiKey} onSave={saveApiKey} onToast={showToast} />

      <FilterDialog
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        filters={filters}
        onChange={setFilters}
        fetchLimit={fetchLimit}
        onFetchLimitChange={setFetchLimit}
      />

      <Toast toast={toast} onDismiss={() => setToast(null)} raised={selectMode && GRID_MODES.includes(mode)} />
    </div>
  );
};

export default YouTubeAnalyzer;
