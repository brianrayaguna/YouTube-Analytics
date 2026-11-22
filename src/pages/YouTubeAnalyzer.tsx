import React, { useState, useEffect, useMemo, useRef, useCallback, Suspense, lazy } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  Sparkles,
  LayoutGrid,
  Table2,
  ArrowUpDown,
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
  ThemePreference,
  VideoViewMode,
} from '../types';
import AppHeader from '../components/AppHeader';
import Sidebar from '../components/Sidebar';
import MobileNav from '../components/MobileNav';
import BottomNav from '../components/BottomNav';
import Toast from '../components/Toast';
import SkeletonCard from '../components/SkeletonCard';
import VideoGrid from '../components/VideoGrid';
import VideoTable from '../components/VideoTable';
import ChannelHeader from '../components/ChannelHeader';
import { EmptyState, NeedDataState, PageHeader } from '../components/common';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import {
  fetchYouTubeData,
  fetchTrendingVideos,
  getQuotaUsage,
  classifyQuery,
  markOutliers,
  isAbortError,
  SEARCH_RESULT_CAP,
  TRENDING_RESULT_CAP,
} from '../services/youtubeService';
import { copyToClipboard } from '../services/exportService';
import type { ExportScope } from '../components/ExportDialog';
import { generateZip } from '../services/zipService';
import { addToSearchHistory, getSearchHistory, subscribeSearchHistory, SearchHistoryItem } from '../services/historyService';
import {
  applyFilters,
  countActiveFilters,
  describeFilters,
  DEFAULT_FILTERS,
  SORT_LABELS,
  DURATION_LABELS,
  DATE_LABELS,
  VideoFilters,
} from '../lib/filters';
import { timeAgo, formatFullNumber, formatNumber } from '../lib/format';
import { getNavItem, ALL_NAV_ITEMS } from '../config/navigation';
import { TRENDING_REGIONS } from '../config/regions';
import { withShortsClassification } from '../lib/video';
import { cn } from '@/lib/utils';

// Halaman analisis & dialog dimuat terpisah (code-splitting) agar bundle awal ringan
const InsightsDashboard = lazy(() => import('../components/InsightsDashboard'));
const CompetitorBenchmark = lazy(() => import('../components/CompetitorBenchmark'));
const ContentGapAnalyzer = lazy(() => import('../components/ContentGapAnalyzer'));
const UploadScheduleAnalyzer = lazy(() => import('../components/UploadScheduleAnalyzer'));
const TitleScoreAnalyzer = lazy(() => import('../components/TitleScoreAnalyzer'));
const SearchHistoryPage = lazy(() => import('../components/SearchHistoryPage'));
const DownloaderPage = lazy(() => import('../components/DownloaderPage'));
const VideoPreviewModal = lazy(() => import('../components/VideoPreviewModal'));
const ExportDialog = lazy(() => import('../components/ExportDialog'));
const SettingsDialog = lazy(() => import('../components/SettingsDialog'));
const FilterDialog = lazy(() => import('../components/FilterDialog'));

const GRID_MODES: AnalysisMode[] = ['dashboard', 'trending', 'saved'];
const ALL_MODES = new Set<AnalysisMode>(ALL_NAV_ITEMS.map(i => i.mode));
const ALL_SORTS: SortOption[] = ['popular', 'newest', 'oldest', 'highest_er', 'most_liked', 'most_commented'];
const EXAMPLE_QUERIES = ['@MrBeast', '@windahbasudara', 'review hp terbaru'];
const THEME_PREF_KEY = 'yt_theme_pref';

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

const removeLocal = (key: string) => {
  try {
    localStorage.removeItem(key);
  } catch {
    // abaikan
  }
};

const readInitialThemePref = (): ThemePreference => {
  try {
    const pref = localStorage.getItem(THEME_PREF_KEY);
    if (pref === 'light' || pref === 'dark') return pref;
    const legacy = localStorage.getItem('yt_dark_mode');
    if (legacy === 'true') return 'dark';
    if (legacy === 'false') return 'light';
  } catch {
    // abaikan
  }
  return 'system';
};

const getSystemDark = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;

const PageFallback = () => (
  <div className="flex justify-center py-24">
    <span className="h-9 w-9 animate-spin rounded-full border-[3px] border-secondary border-t-primary" role="status" aria-label="Memuat halaman" />
  </div>
);

const YouTubeAnalyzer: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // --- Theme (mengikuti preferensi sistem secara default tanpa mematok localStorage saat mount) ---
  const [themePref, setThemePref] = useState<ThemePreference>(readInitialThemePref);
  const [systemDark, setSystemDark] = useState<boolean>(getSystemDark);
  const darkMode = themePref === 'system' ? systemDark : themePref === 'dark';

  // --- UI state ---
  const [sidebarExpanded, setSidebarExpanded] = useState(() =>
    readLocal('yt_sidebar_expanded', window.innerWidth >= 1280, raw => raw === 'true')
  );
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mode, setMode] = useState<AnalysisMode>(() => {
    const paramMode = searchParams.get('mode') as AnalysisMode | null;
    return paramMode && ALL_MODES.has(paramMode) ? paramMode : 'dashboard';
  });
  const [viewMode, setViewMode] = useState<VideoViewMode>(() => {
    const paramView = searchParams.get('view');
    if (paramView === 'table' || paramView === 'grid') return paramView;
    return readLocal('yt_view_mode', 'grid' as VideoViewMode, raw => (raw === 'table' ? 'table' : 'grid'));
  });

  // --- Data state ---
  const [apiKey, setApiKey] = useState(() => readLocal('yt_api_key_v5', '', raw => raw));
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AnalyzedData | null>(null);
  const [trendingData, setTrendingData] = useState<AnalyzedData | null>(null);
  const [trendingRegion, setTrendingRegion] = useState(() => readLocal('yt_trending_region', 'ID', raw => raw));
  const [savedVideos, setSavedVideos] = useState<VideoItem[]>(() =>
    readLocal<VideoItem[]>('yt_saved_videos', []).map(v => withShortsClassification({ ...v, publishedTimeAgo: timeAgo(v.publishedAt) }))
  );
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>(getSearchHistory);
  const [filters, setFilters] = useState<VideoFilters>(() => {
    const typeParam = searchParams.get('type');
    const sortParam = searchParams.get('sort') as SortOption | null;
    return {
      ...DEFAULT_FILTERS,
      contentType: typeParam === 'long' || typeParam === 'shorts' ? typeParam : 'all',
      sort: sortParam && ALL_SORTS.includes(sortParam) ? sortParam : DEFAULT_FILTERS.sort,
    };
  });
  const [fetchLimit, setFetchLimit] = useState<FetchLimit>(() =>
    readLocal('yt_fetch_limit', 50 as FetchLimit, raw =>
      ([10, 50, 100, 500, 1000, 5000].includes(Number(raw)) ? Number(raw) : 50) as FetchLimit
    )
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
  const fetchAbortRef = useRef<AbortController | null>(null);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    clearTimeout(toastTimer.current);
    setToast(prev => ({
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
      document.querySelector<HTMLButtonElement>('button[aria-label="Cari channel atau topik"]')?.click();
    }
  }, []);

  const applyThemePreference = useCallback((next: ThemePreference) => {
    setThemePref(next);
    removeLocal('yt_dark_mode');
    if (next === 'system') removeLocal(THEME_PREF_KEY);
    else writeLocal(THEME_PREF_KEY, next);
  }, []);

  const toggleDarkMode = useCallback(() => {
    const target: 'light' | 'dark' = darkMode ? 'light' : 'dark';
    const matchesSystem = (target === 'dark') === systemDark;
    applyThemePreference(matchesSystem ? 'system' : target);
  }, [applyThemePreference, darkMode, systemDark]);

  useKeyboardShortcuts({
    onSearch: focusSearch,
    onEscape: () => {
      setMobileNavOpen(false);
      if (selectMode) {
        setSelectMode(false);
        setSelectedIds(new Set());
      }
    },
    onToggleTheme: toggleDarkMode,
    enabled: !previewId && !settingsOpen && !filtersOpen && !exportOpen && !mobileNavOpen,
  });

  // --- Effects: Theme sync with OS + cross-tab ---
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_PREF_KEY) setThemePref(readInitialThemePref());
    };
    window.addEventListener('storage', onStorage);
    return () => {
      mq.removeEventListener('change', onChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    const scheme = themePref === 'system' ? 'light dark' : themePref;
    const csMeta = document.querySelector('meta[name="color-scheme"]');
    if (csMeta) csMeta.setAttribute('content', scheme);
    document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute('content', darkMode ? '#0F1115' : '#FFFFFF'));
  }, [darkMode, themePref]);

  // --- Effects: URL searchParams sync ---
  useEffect(() => {
    const next = new URLSearchParams();
    if (mode !== 'dashboard') next.set('mode', mode);
    if (filters.contentType !== 'all') next.set('type', filters.contentType);
    if (filters.sort !== DEFAULT_FILTERS.sort) next.set('sort', filters.sort);
    if (viewMode !== 'grid') next.set('view', viewMode);
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [mode, filters.contentType, filters.sort, viewMode, searchParams, setSearchParams]);

  useEffect(() => writeLocal('yt_sidebar_expanded', String(sidebarExpanded)), [sidebarExpanded]);
  useEffect(() => writeLocal('yt_fetch_limit', String(fetchLimit)), [fetchLimit]);
  useEffect(() => writeLocal('yt_trending_region', trendingRegion), [trendingRegion]);
  useEffect(() => writeLocal('yt_saved_videos', JSON.stringify(savedVideos)), [savedVideos]);
  useEffect(() => writeLocal('yt_view_mode', viewMode), [viewMode]);
  useEffect(() => subscribeSearchHistory(() => setSearchHistory(getSearchHistory())), []);

  useEffect(() => {
    const update = () => setQuotaUsed(getQuotaUsage());
    const onStorage = (e: StorageEvent) => e.key === 'yt_quota_usage_v1' && update();
    window.addEventListener('quotaUpdated', update);
    window.addEventListener('storage', onStorage);
    const interval = setInterval(update, 60000);
    return () => {
      window.removeEventListener('quotaUpdated', update);
      window.removeEventListener('storage', onStorage);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    return () => {
      clearTimeout(toastTimer.current);
      fetchAbortRef.current?.abort();
    };
  }, []);

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

  // --- Demo dataset ---
  const loadDemoData = useCallback(
    async (targetMode: AnalysisMode = 'dashboard') => {
      fetchAbortRef.current?.abort();
      setLoading(false);
      clearSelection();
      const { createDemoChannelData } = await import('../data/demoChannel');
      const demo = createDemoChannelData();
      setData(demo);
      setQuery(demo.query ?? '@nusatechlab');
      setFilters(f => ({ ...DEFAULT_FILTERS, sort: f.sort }));
      setMode(targetMode);
      scrollTop();
      showToast('Data contoh Nusa Tech Lab dimuat — siap dieksplorasi', 'success');
    },
    [clearSelection, showToast]
  );

  // --- Data loading ---
  const ensureApiKey = useCallback(() => {
    if (apiKey) return true;
    setSettingsOpen(true);
    showToast('Masukkan YouTube API Key terlebih dahulu', 'error');
    return false;
  }, [apiKey, showToast]);

  const handleAnalyze = useCallback(
    async (searchQuery: string, opts: { limit?: FetchLimit; keepFilters?: boolean } = {}) => {
      const q = searchQuery.trim();
      if (!q || !ensureApiKey()) return;
      const limit = opts.limit ?? fetchLimit;
      fetchAbortRef.current?.abort();
      const controller = new AbortController();
      fetchAbortRef.current = controller;

      setLoading(true);
      clearSelection();
      setMode(m => (getNavItem(m)?.needsData ? m : 'dashboard'));
      if (!opts.keepFilters) scrollTop();
      try {
        const result = await fetchYouTubeData(apiKey, q, limit, controller.signal);
        if (controller.signal.aborted) return;
        setData({ ...result, requestedLimit: limit });
        if (!opts.keepFilters) {
          setFilters(f => ({ ...DEFAULT_FILTERS, sort: f.sort }));
          addToSearchHistory({ query: q, type: classifyQuery(q), resultCount: result.videos.length, title: result.channelTitle });
        }
        showToast(`${formatFullNumber(result.videos.length)} video berhasil dianalisis`, 'success');
      } catch (err) {
        if (isAbortError(err)) return;
        showToast(err instanceof Error ? err.message : 'Gagal mengambil data', 'error');
      } finally {
        if (fetchAbortRef.current === controller) setLoading(false);
      }
    },
    [apiKey, fetchLimit, ensureApiKey, clearSelection, showToast]
  );

  const handleTrending = useCallback(
    async (region: string = trendingRegion, force = false, limitOverride?: FetchLimit) => {
      setMode('trending');
      clearSelection();
      if (!limitOverride) scrollTop();
      if (!force && trendingData?.query === region) return;
      if (!apiKey) return;

      fetchAbortRef.current?.abort();
      const controller = new AbortController();
      fetchAbortRef.current = controller;

      setLoading(true);
      try {
        const result = await fetchTrendingVideos(
          apiKey,
          Math.min(limitOverride ?? fetchLimit, TRENDING_RESULT_CAP),
          region,
          controller.signal
        );
        if (controller.signal.aborted) return;
        setTrendingData(result);
        showToast(`Trending ${TRENDING_REGIONS.find(r => r.code === region)?.name ?? region} dimuat`, 'success');
      } catch (err) {
        if (isAbortError(err)) return;
        showToast(err instanceof Error ? err.message : 'Gagal memuat trending', 'error');
      } finally {
        if (fetchAbortRef.current === controller) setLoading(false);
      }
    },
    [apiKey, fetchLimit, trendingRegion, trendingData, clearSelection, showToast]
  );

  const handleFetchLimitChange = useCallback(
    (limit: FetchLimit) => {
      setFetchLimit(limit);
      if (mode === 'trending') {
        if (trendingData && Math.min(limit, TRENDING_RESULT_CAP) !== trendingData.videos.length) handleTrending(trendingRegion, true, limit);
        return;
      }
      if (!data?.query || loading || data.channelId?.startsWith('UCdemo')) return;
      const loaded = data.videos.length;
      const requested = data.requestedLimit ?? loaded;
      if (limit < loaded) {
        const videos = markOutliers(data.videos.slice(0, limit));
        setData({ ...data, videos, totalFound: videos.length, requestedLimit: limit });
        clearSelection();
        showToast(`Menampilkan ${formatFullNumber(limit)} video${data.source === 'search' ? ' teratas' : ' terbaru'}`, 'success');
        return;
      }
      if (limit === loaded) {
        setData({ ...data, requestedLimit: limit });
        return;
      }
      const exhausted = loaded < requested || (data.source === 'search' && loaded >= SEARCH_RESULT_CAP);
      if (exhausted) {
        setData({ ...data, requestedLimit: limit });
        showToast(
          data.source === 'search' && loaded >= SEARCH_RESULT_CAP
            ? `Pencarian kata kunci dibatasi ${SEARCH_RESULT_CAP} video oleh YouTube API`
            : `Semua ${formatFullNumber(loaded)} video sudah dimuat`,
          'info'
        );
        return;
      }
      handleAnalyze(data.query, { limit, keepFilters: true });
    },
    [mode, trendingData, trendingRegion, handleTrending, data, loading, clearSelection, showToast, handleAnalyze]
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

  const removeApiKey = () => {
    setApiKey('');
    removeLocal('yt_api_key_v5');
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

  const activeFilterPills = useMemo(() => {
    const pills: Array<{ key: string; label: string; clear: () => void }> = [];
    if (filters.dateRange !== 'all') {
      pills.push({ key: 'date', label: DATE_LABELS[filters.dateRange], clear: () => setFilters(f => ({ ...f, dateRange: 'all' })) });
    }
    if (filters.duration !== 'all') {
      pills.push({ key: 'duration', label: DURATION_LABELS[filters.duration], clear: () => setFilters(f => ({ ...f, duration: 'all' })) });
    }
    if (filters.minViews > 0) {
      pills.push({ key: 'views', label: `Views ≥ ${formatNumber(filters.minViews)}`, clear: () => setFilters(f => ({ ...f, minViews: 0 })) });
    }
    if (filters.minLikes > 0) {
      pills.push({ key: 'likes', label: `Likes ≥ ${formatNumber(filters.minLikes)}`, clear: () => setFilters(f => ({ ...f, minLikes: 0 })) });
    }
    if (filters.minER > 0) {
      pills.push({ key: 'er', label: `ER ≥ ${filters.minER}%`, clear: () => setFilters(f => ({ ...f, minER: 0 })) });
    }
    if (filters.keyword.trim()) {
      pills.push({ key: 'kw', label: `"${filters.keyword.trim()}"`, clear: () => setFilters(f => ({ ...f, keyword: '' })) });
    }
    if (filters.outliersOnly) {
      pills.push({ key: 'outlier', label: 'Hanya outlier', clear: () => setFilters(f => ({ ...f, outliersOnly: false })) });
    }
    return pills;
  }, [filters]);

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

  const regionName = TRENDING_REGIONS.find(r => r.code === (trendingData?.query ?? trendingRegion))?.name;
  const canFetchMore =
    Boolean(data?.query && !data.channelId?.startsWith('UCdemo') && (data.source === 'channel' || data.source === 'playlist'));
  const handleFetchMore = canFetchMore
    ? (limit: FetchLimit) => {
        setFetchLimit(limit);
        handleAnalyze(data!.query!, { limit, keepFilters: true });
      }
    : undefined;

  const chipBar = (
    <div className="sticky top-14 z-30 -mx-4 mb-4 border-b border-border/60 bg-background/95 px-4 py-2.5 backdrop-blur-sm sm:-mx-6 sm:px-6">
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
        {mode === 'trending' && (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button type="button" className="yt-chip" data-active="true">
                <Flame className="h-4 w-4" aria-hidden="true" /> {regionName ?? trendingRegion} <ChevronDown className="h-4 w-4" aria-hidden="true" />
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
                  <span className="w-4">{r.code === (trendingData?.query ?? trendingRegion) && <Check className="h-4 w-4" />}</span>
                  {r.name}
                  <span className="ml-auto text-xs text-muted-foreground">{r.code}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Segmented Format Control */}
        <div className="inline-flex shrink-0 items-center rounded-lg bg-secondary p-0.5" role="group" aria-label="Jenis konten">
          {(['all', 'long', 'shorts'] as ContentTypeFilter[]).map(type => {
            const active = filters.contentType === type;
            return (
              <button
                key={type}
                type="button"
                aria-pressed={active}
                onClick={() => setFilters(f => ({ ...f, contentType: type }))}
                className={cn(
                  'min-h-10 rounded-md px-3 text-sm font-medium transition-colors sm:min-h-8',
                  active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {type === 'all' ? 'Semua' : type === 'long' ? 'Video' : 'Shorts'}
              </button>
            );
          })}
        </div>

        {/* Sort Dropdown */}
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button type="button" className="yt-chip" aria-label={`Urutan: ${SORT_LABELS[filters.sort]}`}>
              <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              <span>{SORT_LABELS[filters.sort]}</span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            {ALL_SORTS.map(sort => (
              <DropdownMenuItem key={sort} onSelect={() => setFilters(f => ({ ...f, sort }))} className="gap-2.5 py-2">
                <span className="w-4">{filters.sort === sort && <Check className="h-4 w-4" />}</span>
                <span>{SORT_LABELS[sort]}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Outlier toggle */}
        <button
          type="button"
          className="yt-chip"
          aria-pressed={filters.outliersOnly}
          data-active={filters.outliersOnly}
          onClick={() => setFilters(f => ({ ...f, outliersOnly: !f.outliersOnly }))}
        >
          Outlier {filters.outliersOnly && <X className="h-3.5 w-3.5" aria-hidden="true" />}
        </button>

        {/* Filter modal trigger */}
        <button type="button" className="yt-chip" data-active={activeFilterCount > 0} onClick={() => setFiltersOpen(true)}>
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          Filter{activeFilterCount > 0 && ` · ${activeFilterCount}`}
        </button>

        {/* Grid / Table view switcher */}
        <div className="ml-auto inline-flex shrink-0 items-center rounded-lg bg-secondary p-0.5" role="group" aria-label="Tampilan daftar video">
          <button
            type="button"
            aria-pressed={viewMode === 'grid'}
            aria-label="Tampilan grid"
            title="Tampilan grid"
            onClick={() => setViewMode('grid')}
            className={cn(
              'inline-flex h-10 w-10 items-center justify-center rounded-md transition-colors sm:h-8 sm:w-8',
              viewMode === 'grid' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <LayoutGrid className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-pressed={viewMode === 'table'}
            aria-label="Tampilan tabel"
            title="Tampilan tabel"
            onClick={() => setViewMode('table')}
            className={cn(
              'inline-flex h-10 w-10 items-center justify-center rounded-md transition-colors sm:h-8 sm:w-8',
              viewMode === 'table' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Table2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );

  const resultsToolbar = (
    <div className="mb-5 space-y-2.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm tabular-nums text-muted-foreground">
          Menampilkan <span className="font-medium text-foreground">{formatFullNumber(filteredVideos.length)}</span> dari{' '}
          {formatFullNumber(sourceVideos.length)} video
        </p>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:px-0">
          <button type="button" className="yt-pill" onClick={() => copyLinks(filteredVideos)} disabled={!filteredVideos.length}>
            <Link2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> Salin link
          </button>
          <button
            type="button"
            className="yt-pill"
            onClick={() => downloadZip(filteredVideos, exportName)}
            disabled={!filteredVideos.length || busy}
          >
            <ImageDown className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> Thumbnail ZIP
          </button>
          <button
            type="button"
            className={cn('yt-pill', selectMode && 'bg-inverse text-inverse-foreground hover:bg-inverse')}
            onClick={() => (selectMode ? clearSelection() : setSelectMode(true))}
            disabled={!filteredVideos.length}
          >
            <CheckSquare className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> {selectMode ? 'Batal pilih' : 'Pilih'}
          </button>
          <button
            type="button"
            className="yt-pill-blue"
            onClick={() => openExport('filtered')}
            disabled={!filteredVideos.length}
          >
            <FileDown className="h-4 w-4" strokeWidth={1.85} aria-hidden="true" /> Ekspor
          </button>
        </div>
      </div>

      {activeFilterPills.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Filter aktif">
          {activeFilterPills.map(p => (
            <button
              key={p.key}
              type="button"
              onClick={p.clear}
              aria-label={`Hapus filter ${p.label}`}
              className="inline-flex min-h-8 items-center gap-1 rounded-full border border-border bg-secondary/70 px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
            >
              <span>{p.label}</span>
              <X className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            </button>
          ))}
          <button
            type="button"
            onClick={() => setFilters(f => ({ ...DEFAULT_FILTERS, contentType: f.contentType, sort: f.sort }))}
            className="ml-1 text-xs font-medium text-primary hover:underline"
          >
            Reset semua
          </button>
        </div>
      )}
    </div>
  );

  const homeEmpty = (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-2 py-10 text-center sm:px-4 sm:py-16">
      <svg viewBox="0 0 32 32" className="h-14 w-14 shadow-sm" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#0F172A" />
        <rect x="6.5" y="18" width="4.5" height="7.5" rx="1.6" fill="#3DA5FF" />
        <rect x="13.75" y="12.5" width="4.5" height="13" rx="1.6" fill="#2DD4BF" />
        <rect x="21" y="6.5" width="4.5" height="19" rx="1.6" fill="#FF3B30" />
      </svg>

      <h1 className="mt-6 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        Analitik channel YouTube berbasis data nyata
      </h1>
      <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
        Tempel <b className="font-medium text-foreground">@handle</b>, URL channel, playlist, atau kata kunci di kolom
        pencarian. Dapatkan deteksi outlier, skor judul &amp; thumbnail <span className="whitespace-nowrap">A–F</span>, peta panas jadwal upload, dan ekspor laporan.
      </p>

      {!apiKey ? (
        <div className="yt-card mt-7 w-full max-w-lg p-5 text-left">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <KeyRound className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-foreground">Mulai langsung atau hubungkan API Key</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Jelajahi seluruh fitur dengan data contoh luring, atau masukkan YouTube Data API v3 key gratis (10.000 unit/hari) untuk menganalisis channel mana pun.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className="yt-pill-blue" onClick={() => loadDemoData('dashboard')}>
                  <Sparkles className="h-4 w-4" aria-hidden="true" /> Coba data contoh
                </button>
                <button type="button" className="yt-pill" onClick={() => setSettingsOpen(true)}>
                  <KeyRound className="h-4 w-4" aria-hidden="true" /> Atur API Key
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-7 flex flex-wrap justify-center gap-2">
            <button type="button" className="yt-pill-blue" onClick={() => loadDemoData('dashboard')}>
              <Sparkles className="h-4 w-4" aria-hidden="true" /> Coba data contoh
            </button>
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
                <Search className="h-3.5 w-3.5" aria-hidden="true" /> {q}
              </button>
            ))}
          </div>
          {searchHistory.length > 0 && (
            <div className="mt-7 w-full max-w-md text-left">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lanjutkan dari riwayat</h2>
              <ul className="yt-card divide-y divide-border overflow-hidden">
                {searchHistory.slice(0, 4).map(h => (
                  <li key={h.timestamp}>
                    <button
                      type="button"
                      className="flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-secondary"
                      onClick={() => {
                        setQuery(h.query);
                        handleAnalyze(h.query);
                      }}
                    >
                      <HistoryIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="flex-1 truncate font-medium">{h.title || h.query}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(h.timestamp)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <div className="mt-10 grid w-full grid-cols-2 gap-3 text-left sm:grid-cols-4">
        {([
          { icon: BarChart3, title: 'Statistik', text: 'Views, ER, outlier & tag', target: 'insights' as AnalysisMode },
          {
            icon: Gauge,
            title: 'Skor Konten',
            text: (
              <>
                Judul &amp; thumbnail <span className="whitespace-nowrap">A–F</span>
              </>
            ),
            target: 'title_score' as AnalysisMode,
          },
          { icon: CalendarClock, title: 'Jadwal Upload', text: 'Peta panas 7×24 jam', target: 'schedule' as AnalysisMode },
          { icon: Lightbulb, title: 'Content Gap', text: 'Topik trending terlewat', target: 'content_gap' as AnalysisMode },
        ]).map(({ icon: Icon, title, text, target }) => (
          <button
            key={title}
            type="button"
            onClick={() => (data ? handleNavigate(target) : loadDemoData(target))}
            className="group rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-secondary/60"
          >
            <Icon className="h-5 w-5 text-primary" strokeWidth={1.75} aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-foreground">{title}</p>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{text}</p>
          </button>
        ))}
      </div>
    </div>
  );

  const renderGridMode = () => {
    if (loading) {
      return (
        <div className="grid grid-cols-1 gap-x-4 gap-y-10 pt-10 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
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
          description={apiKey ? 'Pilih wilayah lalu muat video yang sedang trending saat ini.' : 'Atur API Key untuk memuat video trending, atau jelajahi data contoh lebih dulu.'}
          action={
            <>
              <button
                type="button"
                className="yt-pill-blue"
                onClick={() => (apiKey ? handleTrending(trendingRegion, true) : setSettingsOpen(true))}
              >
                {apiKey ? 'Muat trending' : 'Atur API Key'}
              </button>
              {!apiKey && (
                <button type="button" className="yt-pill" onClick={() => loadDemoData('dashboard')}>
                  <Sparkles className="h-4 w-4" aria-hidden="true" /> Coba data contoh
                </button>
              )}
            </>
          }
        />
      );
    }
    if (mode === 'saved' && savedVideos.length === 0) {
      return (
        <>
          <PageHeader title="Tersimpan" subtitle="0 video • disimpan di browser ini" className="pt-2" />
          <EmptyState
            icon={Bookmark}
            title="Belum ada video tersimpan"
            description="Simpan video lewat ikon bookmark di thumbnail, menu ⋮, atau pilih beberapa sekaligus dengan tombol Pilih."
            action={
              <button type="button" className="yt-pill-primary" onClick={() => handleNavigate('dashboard')}>
                Kembali ke Beranda
              </button>
            }
          />
        </>
      );
    }

    return (
      <>
        {mode === 'dashboard' && data && <ChannelHeader data={data} />}
        {mode === 'trending' && trendingData && <ChannelHeader data={trendingData} regionName={regionName} />}
        {mode === 'saved' && (
          <PageHeader title="Tersimpan" subtitle={`${formatFullNumber(savedVideos.length)} video • disimpan di browser ini`} className="pt-2" />
        )}
        {chipBar}
        {resultsToolbar}
        {filteredVideos.length === 0 ? (
          <EmptyState
            icon={SlidersHorizontal}
            title="Tidak ada video yang cocok"
            description="Coba ubah jenis konten atau longgarkan filter."
            action={
              <button type="button" className="yt-pill-primary" onClick={() => setFilters(DEFAULT_FILTERS)}>
                Reset semua filter
              </button>
            }
          />
        ) : viewMode === 'table' ? (
          <VideoTable
            videos={filteredVideos}
            sort={filters.sort}
            onSortChange={sort => setFilters(f => ({ ...f, sort }))}
            savedIds={savedIds}
            onSaveToggle={handleSaveToggle}
            onPreview={handlePreview}
            selectable={selectMode}
            selectedIds={selectedIds}
            onSelect={handleSelect}
          />
        ) : (
          <VideoGrid
            videos={filteredVideos}
            contentType={filters.contentType}
            sort={filters.sort}
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
    const needData = (icon: typeof BarChart3, feature: string) => (
      <NeedDataState icon={icon} feature={feature} onFocusSearch={focusSearch} onLoadDemo={() => loadDemoData(mode)} />
    );
    if (loading) return <PageFallback />;
    switch (mode) {
      case 'insights':
        return data ? (
          <InsightsDashboard data={data} onPreview={handlePreview} fetchLimit={fetchLimit} onFetchMore={handleFetchMore} />
        ) : (
          needData(BarChart3, 'Statistik Channel')
        );
      case 'title_score':
        return data?.videos.length ? <TitleScoreAnalyzer videos={data.videos} onPreview={handlePreview} /> : needData(Gauge, 'Skor Judul & Thumbnail');
      case 'schedule':
        return data?.videos.length ? (
          <UploadScheduleAnalyzer data={data} onPreview={handlePreview} fetchLimit={fetchLimit} onFetchMore={handleFetchMore} />
        ) : (
          needData(CalendarClock, 'Jadwal Upload')
        );
      case 'content_gap':
        return data?.videos.length ? (
          <ContentGapAnalyzer
            channelVideos={data.videos}
            channelTitle={data.channelTitle}
            apiKey={apiKey}
            onToast={showToast}
            onRequireApiKey={() => setSettingsOpen(true)}
          />
        ) : (
          needData(Lightbulb, 'Content Gap')
        );
      case 'benchmark':
        return (
          <CompetitorBenchmark
            apiKey={apiKey}
            onRequireApiKey={() => setSettingsOpen(true)}
            defaultChannel={data?.source === 'channel' && !data.channelId?.startsWith('UCdemo') ? data.channelStats?.customUrl || data.channelId : undefined}
          />
        );
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
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-[500] focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-popover"
      >
        Langsung ke konten utama
      </a>

      <AppHeader
        onMenu={() => setSidebarExpanded(x => !x)}
        sidebarExpanded={sidebarExpanded}
        onLogo={() => handleNavigate('dashboard')}
        query={query}
        setQuery={setQuery}
        onSearch={handleAnalyze}
        fetchLimit={fetchLimit}
        onFetchLimitChange={handleFetchLimitChange}
        searchInputRef={searchInputRef}
        darkMode={darkMode}
        onToggleTheme={toggleDarkMode}
        onOpenSettings={() => setSettingsOpen(true)}
        quotaUsed={quotaUsed}
        hasApiKey={!!apiKey}
      />

      {loading && (
        <div className="fixed left-0 right-0 top-0 z-[160] h-0.5 overflow-hidden" role="progressbar" aria-label="Memuat data">
          <div className="h-full w-1/3 animate-loading-bar bg-primary" />
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
        quotaUsed={quotaUsed}
      />

      <main id="main-content" tabIndex={-1} ref={mainRef} className={cn('pb-24 pt-14 outline-none md:pb-10', mainOffset)}>
        <div className="mx-auto max-w-[2400px] px-4 pt-3 sm:px-6">
          {GRID_MODES.includes(mode) ? (
            renderGridMode()
          ) : (
            <Suspense fallback={<PageFallback />}>
              <div className="pt-2">{renderAnalysisMode()}</div>
            </Suspense>
          )}
        </div>
      </main>

      <BottomNav
        currentMode={mode}
        onNavigate={handleNavigate}
        onOpenMore={() => setMobileNavOpen(true)}
        mobileNavOpen={mobileNavOpen}
      />

      {/* Bar seleksi (multi-select) */}
      {selectMode && GRID_MODES.includes(mode) && (
        <div className="fixed bottom-[68px] left-1/2 z-[200] w-[calc(100%-24px)] max-w-3xl -translate-x-1/2 md:bottom-6">
          <div className="flex items-center gap-2 overflow-x-auto rounded-xl bg-inverse px-2 py-2 text-inverse-foreground shadow-popover no-scrollbar">
            <button
              type="button"
              onClick={clearSelection}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full hover:bg-inverse-foreground/10"
              aria-label="Batalkan mode pilih"
            >
              <X className="h-5 w-5" />
            </button>
            <span className="shrink-0 pr-1 text-sm font-medium tabular-nums">{selectedList.length} dipilih</span>
            <button
              type="button"
              onClick={() => setSelectedIds(allSelected ? new Set() : new Set(filteredVideos.map(v => v.id)))}
              className="min-h-10 shrink-0 rounded-full px-3 text-sm font-medium text-inverse-primary hover:bg-inverse-foreground/10"
            >
              {allSelected ? 'Batalkan semua' : 'Pilih semua'}
            </button>
            <div className="ml-auto flex shrink-0 items-center gap-1">
              {[
                {
                  label: mode === 'saved' ? 'Hapus' : 'Simpan',
                  ariaLabel: mode === 'saved' ? 'Hapus video terpilih dari Tersimpan' : 'Simpan video terpilih',
                  icon: mode === 'saved' ? BookmarkMinus : Bookmark,
                  onClick: handleBatchSave,
                },
                { label: 'Salin link', ariaLabel: 'Salin link video terpilih', icon: Link2, onClick: () => copyLinks(selectedList) },
                { label: 'ZIP', ariaLabel: 'Unduh ZIP thumbnail terpilih', icon: ImageDown, onClick: () => downloadZip(selectedList, `${exportName}_terpilih`) },
                { label: 'Ekspor', ariaLabel: 'Ekspor video terpilih', icon: FileDown, onClick: () => openExport('selected') },
              ].map(({ label, ariaLabel, icon: Icon, onClick }) => (
                <button
                  key={label}
                  type="button"
                  onClick={onClick}
                  disabled={!selectedList.length || busy}
                  aria-label={ariaLabel}
                  className="flex min-h-10 items-center gap-2 rounded-full px-3 text-sm font-medium hover:bg-inverse-foreground/10 disabled:opacity-40"
                >
                  <Icon className="h-4 w-4" aria-hidden="true" /> <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <Suspense fallback={null}>
        {previewVideo && (
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
            isSaved={savedIds.has(previewVideo.id)}
            onToast={showToast}
          />
        )}

        {exportOpen && (
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
        )}

        {settingsOpen && (
          <SettingsDialog
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            apiKey={apiKey}
            onSave={saveApiKey}
            onRemoveKey={removeApiKey}
            themePref={themePref}
            onThemePrefChange={applyThemePreference}
            quotaUsed={quotaUsed}
            onToast={showToast}
          />
        )}

        {filtersOpen && (
          <FilterDialog
            open={filtersOpen}
            onOpenChange={setFiltersOpen}
            filters={filters}
            onChange={setFilters}
          />
        )}
      </Suspense>

      <Toast toast={toast} onDismiss={() => setToast(null)} raised={selectMode && GRID_MODES.includes(mode)} />
    </div>
  );
};

export default YouTubeAnalyzer;
