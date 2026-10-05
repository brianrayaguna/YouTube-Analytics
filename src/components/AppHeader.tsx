import React, { useState } from 'react';
import { Menu, Search, Moon, Sun, Settings, KeyRound } from 'lucide-react';
import Logo from './Logo';
import SearchBar from './SearchBar';
import { ShowToast } from '../types';
import { QUOTA_LIMIT } from '../services/youtubeService';
import { formatNumber } from '../lib/format';
import { cn } from '@/lib/utils';

interface AppHeaderProps {
  onMenu: () => void;
  onLogo: () => void;
  query: string;
  setQuery: (q: string) => void;
  onSearch: (q: string) => void;
  onToast: ShowToast;
  searchInputRef: React.RefObject<HTMLInputElement>;
  darkMode: boolean;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  quotaUsed: number;
  hasApiKey: boolean;
}

const QuotaMeter: React.FC<{ used: number }> = ({ used }) => {
  const pct = Math.min((used / QUOTA_LIMIT) * 100, 100);
  const color = pct >= 90 ? 'bg-youtube-red' : pct >= 70 ? 'bg-warning' : 'bg-primary';
  return (
    <div
      className="hidden min-w-[96px] flex-col gap-1 px-2 lg:flex"
      title={`Perkiraan pemakaian kuota hari ini: ${used.toLocaleString('id-ID')} / ${QUOTA_LIMIT.toLocaleString('id-ID')} unit`}
    >
      <div className="flex items-baseline justify-between gap-2 text-[11px] leading-none text-muted-foreground">
        <span>Kuota</span>
        <span className="font-medium text-foreground">
          {formatNumber(used)}/{formatNumber(QUOTA_LIMIT)}
        </span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-secondary">
        <div className={cn('h-full rounded-full transition-[width] duration-500', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

const AppHeader: React.FC<AppHeaderProps> = ({
  onMenu,
  onLogo,
  query,
  setQuery,
  onSearch,
  onToast,
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
      <header className="fixed left-0 right-0 top-0 z-[150] flex h-14 items-center bg-background px-2 md:hidden">
        <SearchBar
          query={query}
          setQuery={setQuery}
          onSearch={q => {
            setMobileSearch(false);
            onSearch(q);
          }}
          onToast={onToast}
          inputRef={searchInputRef}
          onBack={() => setMobileSearch(false)}
          autoFocus
        />
      </header>
    );
  }

  return (
    <header className="fixed left-0 right-0 top-0 z-[150] flex h-14 items-center justify-between gap-4 bg-background px-2 sm:px-4">
      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        <button type="button" onClick={onMenu} className="yt-icon-btn" aria-label="Menu">
          <Menu className="h-6 w-6" strokeWidth={1.75} />
        </button>
        <Logo onClick={onLogo} />
      </div>

      <div className="hidden max-w-[732px] flex-1 justify-center md:flex">
        <SearchBar query={query} setQuery={setQuery} onSearch={onSearch} onToast={onToast} inputRef={searchInputRef} />
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <button type="button" onClick={() => setMobileSearch(true)} className="yt-icon-btn md:hidden" aria-label="Cari">
          <Search className="h-6 w-6" strokeWidth={1.75} />
        </button>
        <QuotaMeter used={quotaUsed} />
        <button
          type="button"
          onClick={onToggleTheme}
          className="yt-icon-btn"
          aria-label={darkMode ? 'Tema terang' : 'Tema gelap'}
          title={darkMode ? 'Tema terang (D)' : 'Tema gelap (D)'}
        >
          {darkMode ? <Sun className="h-6 w-6" strokeWidth={1.75} /> : <Moon className="h-6 w-6" strokeWidth={1.75} />}
        </button>
        {hasApiKey ? (
          <button type="button" onClick={onOpenSettings} className="yt-icon-btn" aria-label="Pengaturan" title="Pengaturan">
            <Settings className="h-6 w-6" strokeWidth={1.75} />
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenSettings}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-sm font-medium text-primary hover:bg-primary/10 hover:border-transparent"
          >
            <KeyRound className="h-5 w-5" strokeWidth={1.75} />
            <span className="hidden sm:inline">Atur API Key</span>
          </button>
        )}
      </div>
    </header>
  );
};

export default AppHeader;
