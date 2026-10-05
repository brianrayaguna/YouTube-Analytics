import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Mic, History, X, ArrowLeft } from 'lucide-react';
import { getSuggestions } from '../services/suggestionService';
import { getSearchHistory, removeFromSearchHistory, subscribeSearchHistory, SearchHistoryItem } from '../services/historyService';
import { ShowToast } from '../types';
import { cn } from '@/lib/utils';

interface SearchBarProps {
  query: string;
  setQuery: (q: string) => void;
  onSearch: (q: string) => void;
  onToast?: ShowToast;
  inputRef?: React.RefObject<HTMLInputElement>;
  /** Mode mobile: tampilkan tombol kembali */
  onBack?: () => void;
  autoFocus?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Web Speech API belum ada di lib.dom
type SpeechRecognitionCtor = new () => any;

const getSpeechRecognition = (): SpeechRecognitionCtor | undefined => {
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition || w.webkitSpeechRecognition;
};

type DropdownItem = { kind: 'history'; value: string; item: SearchHistoryItem } | { kind: 'suggestion'; value: string };

const SearchBar: React.FC<SearchBarProps> = ({ query, setQuery, onSearch, onToast, inputRef, onBack, autoFocus }) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [history, setHistory] = useState<SearchHistoryItem[]>(() => getSearchHistory());
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [listening, setListening] = useState(false);

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
      .slice(0, q ? 3 : 10)
      .map(h => ({ kind: 'history' as const, value: h.query, item: h }));
    const historyValues = new Set(matchedHistory.map(h => h.value.toLowerCase()));
    const sugg = q
      ? suggestions
          .filter(s => !historyValues.has(s.toLowerCase()))
          .slice(0, 10 - matchedHistory.length)
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

  const startVoiceSearch = () => {
    const Recognition = getSpeechRecognition();
    if (!Recognition) {
      onToast?.('Pencarian suara tidak didukung browser ini', 'error');
      return;
    }
    const recognition = new Recognition();
    recognition.lang = 'id-ID';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => {
      setListening(false);
      onToast?.('Tidak bisa mengakses mikrofon', 'error');
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SpeechRecognitionEvent
    recognition.onresult = (event: any) => submit(event.results[0][0].transcript);
    recognition.start();
  };

  const showDropdown = open && focused && items.length > 0;

  return (
    <div ref={wrapperRef} className="relative flex w-full items-center gap-2 md:gap-4">
      {onBack && (
        <button type="button" onClick={onBack} className="yt-icon-btn" aria-label="Kembali">
          <ArrowLeft className="h-6 w-6" strokeWidth={1.75} />
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
            'flex flex-1 items-center rounded-l-full border bg-background pl-4 pr-1 transition-colors',
            focused ? 'border-primary shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)] md:ml-0' : 'border-input'
          )}
        >
          {focused && <Search className="mr-3 hidden h-5 w-5 shrink-0 text-foreground sm:block" strokeWidth={1.75} />}
          <input
            ref={ref}
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            spellCheck={false}
            aria-label="Cari"
            className="h-full w-full min-w-0 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
            placeholder="Cari channel, @handle, URL, atau topik"
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
              aria-label="Hapus teks"
            >
              <X className="h-5 w-5" strokeWidth={1.75} />
            </button>
          )}
        </div>
        <button
          type="submit"
          className="flex w-16 shrink-0 items-center justify-center rounded-r-full border border-l-0 border-input bg-secondary/70 transition-colors hover:bg-accent"
          aria-label="Analisis"
          title="Analisis"
        >
          <Search className="h-5 w-5" strokeWidth={1.75} />
        </button>

        {showDropdown && (
          <ul
            className="absolute left-0 right-16 top-[calc(100%+4px)] z-[200] overflow-hidden rounded-xl border border-border bg-popover py-4 shadow-popover"
            role="listbox"
          >
            {items.map((it, idx) => (
              <li
                key={`${it.kind}-${it.value}`}
                role="option"
                aria-selected={highlight === idx}
                onMouseDown={e => e.preventDefault()}
                onMouseEnter={() => setHighlight(idx)}
                onClick={() => submit(it.value)}
                className={cn(
                  'group flex h-8 cursor-default items-center gap-4 px-4 text-base',
                  highlight === idx && 'bg-secondary'
                )}
              >
                {it.kind === 'history' ? (
                  <History className="h-5 w-5 shrink-0 text-foreground" strokeWidth={1.75} />
                ) : (
                  <Search className="h-5 w-5 shrink-0 text-foreground" strokeWidth={1.75} />
                )}
                <span className={cn('flex-1 truncate', it.kind === 'history' && 'text-[#681da8] dark:text-[#c58af9]')}>
                  {it.value}
                </span>
                {it.kind === 'history' && (
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      removeFromSearchHistory(it.item.timestamp);
                    }}
                    className="text-xs text-primary opacity-0 hover:underline group-hover:opacity-100 group-aria-selected:opacity-100"
                  >
                    Hapus
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </form>

      <button
        type="button"
        onClick={startVoiceSearch}
        className={cn(
          'yt-icon-btn hidden bg-secondary sm:inline-flex',
          listening && 'animate-pulse bg-youtube-red text-white hover:bg-youtube-red'
        )}
        aria-label="Telusuri dengan suara"
        title="Telusuri dengan suara"
      >
        <Mic className="h-5 w-5" strokeWidth={1.75} />
      </button>
    </div>
  );
};

export default SearchBar;
