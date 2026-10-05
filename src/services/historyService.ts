// Riwayat pencarian (satu sumber untuk SearchBar & halaman Riwayat)

export type SearchHistoryType = 'channel' | 'keyword' | 'playlist';

export interface SearchHistoryItem {
  query: string;
  timestamp: number;
  type: SearchHistoryType;
  resultCount?: number;
  title?: string;
}

const KEY = 'yt_search_history_v2';
const LEGACY_KEY = 'yt_search_history';
const EVENT = 'searchHistoryUpdated';
const MAX_ITEMS = 50;

const write = (items: SearchHistoryItem[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // storage penuh — abaikan
  }
  window.dispatchEvent(new Event(EVENT));
};

export const getSearchHistory = (): SearchHistoryItem[] => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
    // Migrasi dari format lama (array string)
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const now = Date.now();
      const migrated: SearchHistoryItem[] = (JSON.parse(legacy) as string[]).map((q, i) => ({
        query: q,
        timestamp: now - i * 1000,
        type: q.startsWith('@') || q.includes('youtube.com/') ? 'channel' : 'keyword',
      }));
      localStorage.removeItem(LEGACY_KEY);
      localStorage.setItem(KEY, JSON.stringify(migrated));
      return migrated;
    }
  } catch {
    // data rusak
  }
  return [];
};

export const addToSearchHistory = (item: Omit<SearchHistoryItem, 'timestamp'>) => {
  const query = item.query.trim();
  if (!query) return;
  const rest = getSearchHistory().filter(h => h.query.toLowerCase() !== query.toLowerCase());
  write([{ ...item, query, timestamp: Date.now() }, ...rest].slice(0, MAX_ITEMS));
};

export const removeFromSearchHistory = (timestamp: number) => {
  write(getSearchHistory().filter(h => h.timestamp !== timestamp));
};

export const clearSearchHistory = () => write([]);

export const subscribeSearchHistory = (cb: () => void) => {
  const onStorage = (e: StorageEvent) => e.key === KEY && cb();
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', onStorage);
  };
};
