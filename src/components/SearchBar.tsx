import React, { useState, useEffect, useRef, useCallback, useId } from 'react';
import { Search, History, X, ArrowLeft, ChevronDown, Check, Layers } from 'lucide-react';
import { getSuggestions } from '../services/suggestionService';
import { getSearchHistory, removeFromSearchHistory, subscribeSearchHistory, SearchHistoryItem } from '../services/historyService';
import { estimateQuotaCost } from '../services/youtubeService';
import { FetchLimit } from '../types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { cn } from '@/lib/utils';

const FETCH_LIMITS: Array<{ value: FetchLimit; label: string }> = [
  { value: 10, label: '10 video' },
  { value: 50, label: '50 video' },
  { value: 100, label: '100 video' },
  { value: 500, label: '500 video' },
  { value: 1000, label: '1.000 video' },
  { value: 5000, label: '5.000 video' },
];

interface SearchBarProps {
  query: string;
  setQuery: (q: string) => void;
  onSearch: (q: string) => void;
  fetchLimit?: FetchLimit;
  onFetchLimitChange?: (limit: FetchLimit) => void;
  inputRef?: React.RefObject<HTMLInputElement>;
  /** Mode mobile: tampilkan tombol kembali */
  onBack?: () => void;
  autoFocus?: boolean;
}

type DropdownItem = { kind: 'history'; value: string; item: SearchHistoryItem } | { kind: 'suggestion'; value: string };

const SearchBar: React.FC<SearchBarProps> = ({
  query,
  setQuery,
  onSearch,
  fetchLimit = 50,
  onFetchLimitChange,
  inputRef,
  onBack,
  autoFocus,
}) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [history, setHistory] = useState<SearchHistoryItem[]>(() => getSearchHistory());
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [highlight, setHighlight] = useState(-1);

  const listboxId = useId();
  const localRef = useRef<HTMLInputElement>(null);
  const ref = inputRef ?? localRef;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);

  useEffect(() => subscribeSearchHistory(() => setHistory(getSearchHistory())), []);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus, ref]);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // Saran pencarian (debounce 250ms, abaikan respons lama)
  useEffect(() => {
    const q = query.trim();
    if (!q || /^https?:\/\/|youtu\.?be/i.test(q)) {
      setSuggestions([]);
      return;
    }
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      const results = await getSuggestions(q);
      if (id === requestId.current) setSuggestions(results);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  const items: DropdownItem[] = (() => {
    const q = query.trim().toLowerCase();
    const matchedHistory = history
      .filter(h => !q || h.query.toLowerCase().includes(q))
      .slice(0, q ? 3 : 8)
      .map(h => ({ kind: 'history' as const, value: h.query, item: h }));
    const historyValues = new Set(matchedHistory.map(h => h.value.toLowerCase()));
    const sugg = q
      ? suggestions
          .filter(s => !historyValues.has(s.toLowerCase()))
          .slice(0, 8 - matchedHistory.length)
          .map(s => ({ kind: 'suggestion' as const, value: s }))
      : [];
    return [...matchedHistory, ...sugg];
  })();

  useEffect(() => setHighlight(-1), [query]);

  const submit = useCallback(
    (value: string) => {
      const v = value.trim();
      if (!v) {
        ref.current?.focus();
        return;
      }
      setQuery(v);
      setOpen(false);
      ref.current?.blur();
      onSearch(v);
    },
    [onSearch, ref, setQuery]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && items.length) {
      e.preventDefault();
      setOpen(true);
      setHighlight(h => (h + 1) % items.length);
    } else if (e.key === 'ArrowUp' && items.length) {
      e.preventDefault();
      setHighlight(h => (h <= 0 ? items.length - 1 : h - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      submit(highlight >= 0 && items[highlight] ? items[highlight].value : query);
    } else if (e.key === 'Escape') {
      setOpen(false);
      ref.current?.blur();
    }
  };

  const showDropdown = open && focused && items.length > 0;
  const activeOptionId = showDropdown && highlight >= 0 ? `${listboxId}-opt-${highlight}` : undefined;

  return (
    <div ref={wrapperRef} className="relative flex w-full items-center gap-2 sm:gap-3">
      {onBack && (
        <button type="button" onClick={onBack} className="yt-icon-btn" aria-label="Kembali">
          <ArrowLeft className="h-5 w-5" strokeWidth={1.75} />
        </button>
      )}

      <form
        role="search"
        className="relative flex h-10 flex-1 items-stretch"
        onSubmit={e => {
          e.preventDefault();
          submit(query);
        }}
      >
        <div
          className={cn(
            'flex flex-1 items-center rounded-l-full border bg-background pl-4 pr-1 transition-colors dark:bg-[#121212]',
            focused ? 'border-primary shadow-[inset_0_1px_2px_rgba(0,0,0,0.08)]' : 'border-input'
          )}
        >
          {focused && <Search className="mr-3 hidden h-4 w-4 shrink-0 text-foreground sm:block" strokeWidth={1.75} aria-hidden="true" />}
          <input
            ref={ref}
            type="search"
            role="combobox"
            enterKeyHint="search"
            autoComplete="off"
            spellCheck={false}
            aria-label="Telusuri channel, @handle, URL, atau kata kunci"
            aria-expanded={showDropdown}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={activeOptionId}
            className="h-full w-full min-w-0 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
            placeholder="Telusuri channel, @handle, URL, atau kata kunci"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => {
              setFocused(true);
              setOpen(true);
            }}
            onBlur={() => setFocused(false)}
            onKeyDown={handleKeyDown}
          />
          {query && (
            <button
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => {
                setQuery('');
                ref.current?.focus();
              }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-secondary"
              aria-label="Hapus teks pencarian"
            >
              <X className="h-5 w-5" strokeWidth={1.75} />
            </button>
          )}
        </div>
        <button
          type="submit"
          className="flex w-16 shrink-0 items-center justify-center rounded-r-full border border-l-0 border-input bg-[#f8f8f8] transition-colors hover:bg-accent dark:bg-[#222222] dark:hover:bg-[#303030]"
          aria-label="Analisis"
          title="Analisis"
        >
          <Search className="h-5 w-5" strokeWidth={1.75} />
        </button>

        {showDropdown && (
          <ul
            id={listboxId}
            className="absolute left-0 right-16 top-[calc(100%+4px)] z-[200] overflow-hidden rounded-xl border border-border bg-popover py-2 shadow-popover"
            role="listbox"
            aria-label="Saran dan riwayat pencarian"
          >
            {items.map((it, idx) => (
              <li
                key={`${it.kind}-${it.value}`}
                role="presentation"
                className={cn(
                  'group flex min-h-10 items-center gap-2 px-3 transition-colors',
                  highlight === idx && 'bg-secondary'
                )}
                onMouseEnter={() => setHighlight(idx)}
              >
                <div
                  id={`${listboxId}-opt-${idx}`}
                  role="option"
                  aria-selected={highlight === idx}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => submit(it.value)}
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-3.5 py-1.5 text-[15px]"
                >
                  {it.kind === 'history' ? (
                    <History className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
                  ) : (
                    <Search className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
                  )}
                  <span className={cn('flex-1 truncate', it.kind === 'history' && 'text-visited')}>
                    {it.value}
                  </span>
                </div>
                {it.kind === 'history' && (
                  <button
                    type="button"
                    onMouseDown={e => e.preventDefault()}
                    onClick={e => {
                      e.stopPropagation();
                      removeFromSearchHistory(it.item.timestamp);
                    }}
                    aria-label={`Hapus "${it.value}" dari riwayat`}
                    className="rounded px-2 py-1 text-xs font-medium text-primary opacity-100 hover:underline sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                  >
                    Hapus
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </form>

      {onFetchLimitChange && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-secondary px-3 text-xs font-medium tabular-nums text-foreground transition-colors hover:bg-accent"
              aria-label={`Batas pengambilan data: ${fetchLimit.toLocaleString('id-ID')} video`}
              title="Batas jumlah video yang diambil saat analisis"
            >
              <Layers className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
              <span>{fetchLimit.toLocaleString('id-ID')}</span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
              Jumlah video yang diambil
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {FETCH_LIMITS.map(opt => {
              const cost = estimateQuotaCost(query, opt.value);
              return (
                <DropdownMenuItem
                  key={opt.value}
                  onSelect={() => onFetchLimitChange(opt.value)}
                  className="flex items-center justify-between gap-3 py-2 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <Check className={cn('h-4 w-4', fetchLimit === opt.value ? 'opacity-100' : 'opacity-0')} />
                    <span className="tabular-nums">{opt.label}</span>
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">±{cost} unit</span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};

export default SearchBar;
