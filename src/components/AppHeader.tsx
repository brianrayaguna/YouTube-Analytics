import React, { useState } from 'react';
import { Menu, Search, Moon, Sun, Settings, KeyRound } from 'lucide-react';
import Logo from './Logo';
import SearchBar from './SearchBar';
import { FetchLimit } from '../types';
import { QUOTA_LIMIT } from '../services/youtubeService';
import { formatNumber } from '../lib/format';
import { cn } from '@/lib/utils';

interface AppHeaderProps {
  onMenu: () => void;
  sidebarExpanded: boolean;
  onLogo: () => void;
  query: string;
  setQuery: (q: string) => void;
  onSearch: (q: string) => void;
  fetchLimit: FetchLimit;
  onFetchLimitChange: (limit: FetchLimit) => void;
  searchInputRef: React.RefObject<HTMLInputElement>;
  darkMode: boolean;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  quotaUsed: number;
  hasApiKey: boolean;
}

const QuotaMeter: React.FC<{ used: number }> = ({ used }) => {
  const pct = Math.min((used / QUOTA_LIMIT) * 100, 100);
  const color = pct >= 90 ? 'bg-destructive' : pct >= 70 ? 'bg-warning' : 'bg-primary';
  return (
    <div
      className="hidden min-w-[100px] flex-col gap-1 px-2 lg:flex"
      title={`Perkiraan pemakaian kuota hari ini: ${used.toLocaleString('id-ID')} / ${QUOTA_LIMIT.toLocaleString('id-ID')} unit`}
    >
      <div className="flex items-baseline justify-between gap-2 text-[11px] leading-none text-muted-foreground">
        <span>Kuota</span>
        <span className="font-medium tabular-nums text-foreground">
          {formatNumber(used)}/{formatNumber(QUOTA_LIMIT)}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Pemakaian kuota API harian"
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={QUOTA_LIMIT}
        className="h-1.5 w-full overflow-hidden rounded-full bg-secondary"
      >
        <div
          className={cn('h-full w-full origin-left rounded-full transition-transform duration-300', color)}
          style={{ transform: `scaleX(${pct / 100})` }}
        />
      </div>
    </div>
  );
};

const AppHeader: React.FC<AppHeaderProps> = ({
  onMenu,
  sidebarExpanded,
  onLogo,
  query,
  setQuery,
  onSearch,
  fetchLimit,
  onFetchLimitChange,
  searchInputRef,
  darkMode,
  onToggleTheme,
  onOpenSettings,
  quotaUsed,
  hasApiKey,
}) => {
  const [mobileSearch, setMobileSearch] = useState(false);

  if (mobileSearch) {
    return (
      <header className="fixed left-0 right-0 top-0 z-[150] flex h-14 items-center border-b border-border/60 bg-background px-2 md:hidden">
        <SearchBar
          query={query}
          setQuery={setQuery}
          onSearch={q => {
            setMobileSearch(false);
            onSearch(q);
          }}
          fetchLimit={fetchLimit}
          onFetchLimitChange={onFetchLimitChange}
          inputRef={searchInputRef}
          onBack={() => setMobileSearch(false)}
          autoFocus
        />
      </header>
    );
  }

  return (
    <header className="fixed left-0 right-0 top-0 z-[150] flex h-14 items-center justify-between gap-3 border-b border-border/60 bg-background/95 px-2 backdrop-blur-sm sm:px-4">
      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <button
          type="button"
          onClick={onMenu}
          className="yt-icon-btn hidden md:inline-flex"
          aria-label={sidebarExpanded ? 'Ciutkan sidebar' : 'Bentangkan sidebar'}
          aria-expanded={sidebarExpanded}
          aria-controls="desktop-sidebar"
        >
          <Menu className="h-5 w-5" strokeWidth={1.75} />
        </button>
        <Logo onClick={onLogo} />
      </div>

      <div className="hidden max-w-[740px] flex-1 justify-center md:flex">
        <SearchBar
          query={query}
          setQuery={setQuery}
          onSearch={onSearch}
          fetchLimit={fetchLimit}
          onFetchLimitChange={onFetchLimitChange}
          inputRef={searchInputRef}
        />
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
        <button type="button" onClick={() => setMobileSearch(true)} className="yt-icon-btn md:hidden" aria-label="Cari channel atau topik">
          <Search className="h-5 w-5" strokeWidth={1.75} />
        </button>
        <QuotaMeter used={quotaUsed} />
        <button
          type="button"
          onClick={onToggleTheme}
          className="yt-icon-btn"
          aria-label={darkMode ? 'Ganti ke tema terang' : 'Ganti ke tema gelap'}
          title={darkMode ? 'Tema terang (D)' : 'Tema gelap (D)'}
        >
          {darkMode ? <Sun className="h-5 w-5" strokeWidth={1.75} /> : <Moon className="h-5 w-5" strokeWidth={1.75} />}
        </button>
        {!hasApiKey && (
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Atur YouTube API Key"
            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full border border-border px-2.5 text-sm font-medium text-primary transition-colors hover:border-transparent hover:bg-primary/10 sm:min-h-9 sm:min-w-0 sm:px-3"
          >
            <KeyRound className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <span className="hidden sm:inline">Atur API Key</span>
          </button>
        )}
        <button
          type="button"
          onClick={onOpenSettings}
          className="yt-icon-btn"
          aria-label="Pengaturan"
          title="Pengaturan"
        >
          <Settings className="h-5 w-5" strokeWidth={1.75} />
        </button>
      </div>
    </header>
  );
};

export default AppHeader;
