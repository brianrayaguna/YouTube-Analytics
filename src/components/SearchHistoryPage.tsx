import React, { useEffect, useMemo, useState } from 'react';
import { History, Search, X, Trash2, Tv, ListVideo, Hash } from 'lucide-react';
import { ShowToast } from '../types';
import {
  getSearchHistory,
  removeFromSearchHistory,
  clearSearchHistory,
  subscribeSearchHistory,
  SearchHistoryItem,
  SearchHistoryType,
} from '../services/historyService';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { PageHeader, EmptyState } from './common';
import { timeAgo } from '../lib/format';

interface SearchHistoryPageProps {
  onSearch: (query: string) => void;
  onToast: ShowToast;
}

const TYPE_META: Record<SearchHistoryType, { label: string; icon: typeof Tv }> = {
  channel: { label: 'Channel', icon: Tv },
  playlist: { label: 'Playlist', icon: ListVideo },
  keyword: { label: 'Kata kunci', icon: Hash },
};

const dayGroup = (ts: number) => {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Hari ini';
  if (d.toDateString() === yesterday.toDateString()) return 'Kemarin';
  return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

/** Halaman riwayat pencarian dengan filter jenis dan konfirmasi dialog modal. */
const SearchHistoryPage: React.FC<SearchHistoryPageProps> = ({ onSearch, onToast }) => {
  const [history, setHistory] = useState<SearchHistoryItem[]>(getSearchHistory);
  const [filter, setFilter] = useState<'all' | SearchHistoryType>('all');
  const [search, setSearch] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => subscribeSearchHistory(() => setHistory(getSearchHistory())), []);

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = history.filter(
      h => (filter === 'all' || h.type === filter) && (!q || h.query.toLowerCase().includes(q) || h.title?.toLowerCase().includes(q))
    );
    const map = new Map<string, SearchHistoryItem[]>();
    list.forEach(h => {
      const key = dayGroup(h.timestamp);
      const arr = map.get(key);
      if (arr) arr.push(h);
      else map.set(key, [h]);
    });
    return Array.from(map.entries());
  }, [history, filter, search]);

  return (
    <>
      <div className="flex flex-col-reverse gap-8 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <PageHeader title="Riwayat pencarian" subtitle={`${history.length} pencarian tersimpan di browser ini`} />

          <div className="mb-6 flex gap-2 overflow-x-auto no-scrollbar" role="group" aria-label="Filter jenis riwayat">
            {(['all', 'channel', 'playlist', 'keyword'] as const).map(f => (
              <button
                key={f}
                type="button"
                className="yt-chip"
                aria-pressed={filter === f}
                data-active={filter === f}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'Semua' : TYPE_META[f].label}
              </button>
            ))}
          </div>

          {groups.length === 0 ? (
            <EmptyState
              icon={History}
              title={history.length ? 'Tidak ada yang cocok' : 'Belum ada riwayat'}
              description={history.length ? 'Ubah filter atau kata pencarian.' : 'Setiap analisis yang berhasil akan muncul di sini agar mudah diulang.'}
            />
          ) : (
            <div className="space-y-8">
              {groups.map(([label, items]) => (
                <section key={label}>
                  <h2 className="mb-3 text-lg font-bold text-foreground">{label}</h2>
                  <ul className="space-y-1">
                    {items.map(item => {
                      const Icon = TYPE_META[item.type]?.icon ?? Hash;
                      return (
                        <li key={item.timestamp} className="group flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-secondary">
                          <button type="button" onClick={() => onSearch(item.query)} className="flex min-w-0 flex-1 items-center gap-3.5 text-left">
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary group-hover:bg-background">
                              <Icon className="h-5 w-5 text-foreground" strokeWidth={1.75} aria-hidden="true" />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-base font-medium text-foreground">{item.title || item.query}</span>
                              <span className="block truncate text-xs text-muted-foreground sm:text-sm">
                                {item.title && item.title !== item.query ? `${item.query} • ` : ''}
                                {TYPE_META[item.type]?.label}
                                {item.resultCount ? ` • ${item.resultCount} video` : ''} • {timeAgo(item.timestamp)}
                              </span>
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onSearch(item.query)}
                            className="yt-icon-btn hidden sm:inline-flex sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                            aria-label={`Analisis lagi ${item.title || item.query}`}
                            title="Analisis lagi"
                          >
                            <Search className="h-5 w-5" strokeWidth={1.75} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              removeFromSearchHistory(item.timestamp);
                              onToast('Dihapus dari riwayat', 'success');
                            }}
                            className="yt-icon-btn sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                            aria-label={`Hapus ${item.title || item.query} dari riwayat`}
                            title="Hapus"
                          >
                            <X className="h-5 w-5" strokeWidth={1.75} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>

        <aside className="w-full shrink-0 lg:sticky lg:top-20 lg:w-80">
          <div className="relative">
            <label htmlFor="history-search" className="sr-only">
              Telusuri riwayat pencarian
            </label>
            <Search className="pointer-events-none absolute left-0 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
            <input
              id="history-search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Telusuri riwayat"
              className="h-11 w-full border-0 border-b border-border bg-transparent pl-8 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground"
            />
          </div>
          <button
            type="button"
            disabled={!history.length}
            onClick={() => setConfirmClear(true)}
            className="mt-4 flex min-h-11 items-center gap-3 rounded-full px-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-40 sm:min-h-9"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" /> Hapus semua riwayat
          </button>
        </aside>
      </div>

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus semua riwayat pencarian?</AlertDialogTitle>
            <AlertDialogDescription>
              Seluruh {history.length} riwayat pencarian di browser ini akan dihapus secara permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                clearSearchHistory();
                setConfirmClear(false);
                onToast('Riwayat dihapus', 'success');
              }}
            >
              Hapus semua
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default SearchHistoryPage;
