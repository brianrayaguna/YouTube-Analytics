import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Bookmark, BookmarkCheck, Check, Play } from 'lucide-react';
import { SortOption, VideoItem } from '../types';
import { formatDate, formatFullNumber } from '../lib/format';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 50;

interface VideoTableProps {
  videos: VideoItem[];
  sort: SortOption;
  onSortChange: (sort: SortOption) => void;
  savedIds: Set<string>;
  onSaveToggle: (video: VideoItem) => void;
  onPreview: (video: VideoItem) => void;
  selectable: boolean;
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
}

const VideoTable: React.FC<VideoTableProps> = ({
  videos,
  sort,
  onSortChange,
  savedIds,
  onSaveToggle,
  onPreview,
  selectable,
  selectedIds,
  onSelect,
}) => {
  const [visible, setVisible] = useState(PAGE_SIZE);

  useEffect(() => setVisible(PAGE_SIZE), [videos]);

  const shown = videos.slice(0, visible);
  const remaining = videos.length - shown.length;

  const sortHeader = (label: string, targetSort: SortOption, altSort?: SortOption) => {
    const active = sort === targetSort || (altSort ? sort === altSort : false);
    const isAsc = altSort && sort === altSort;
    const ariaSort: 'ascending' | 'descending' | 'none' = active ? (isAsc ? 'ascending' : 'descending') : 'none';
    const handleClick = () => {
      if (altSort && sort === targetSort) onSortChange(altSort);
      else onSortChange(targetSort);
    };

    return (
      <th scope="col" aria-sort={ariaSort} className="whitespace-nowrap px-3 py-3 text-right font-medium">
        <button
          type="button"
          onClick={handleClick}
          className={cn(
            'inline-flex items-center gap-1 rounded px-1 py-0.5 transition-colors hover:text-foreground',
            active ? 'text-foreground' : 'text-muted-foreground'
          )}
        >
          {label}
          {active && (isAsc ? <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" /> : <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />)}
        </button>
      </th>
    );
  };

  return (
    <div className="yt-card overflow-hidden">
      <div
        tabIndex={0}
        role="region"
        aria-label="Tabel daftar video"
        className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
      >
        <table className="w-full min-w-[780px] border-collapse text-sm">
          <caption className="sr-only">Daftar {videos.length} video dengan views, rasio outlier, engagement rate, dan tanggal upload</caption>
          <thead>
            <tr className="border-b border-border bg-secondary/40 text-xs text-muted-foreground">
              {selectable && (
                <th scope="col" className="w-10 px-3 py-3 text-center">
                  <span className="sr-only">Pilih</span>
                </th>
              )}
              <th scope="col" className="px-4 py-3 text-left font-medium">Video</th>
              {sortHeader('Tayangan', 'popular')}
              <th scope="col" className="whitespace-nowrap px-3 py-3 text-right font-medium">vs Median</th>
              {sortHeader('ER', 'highest_er')}
              {sortHeader('Suka', 'most_liked')}
              {sortHeader('Komentar', 'most_commented')}
              <th scope="col" className="whitespace-nowrap px-3 py-3 text-right font-medium">Durasi</th>
              {sortHeader('Diunggah', 'newest', 'oldest')}
              <th scope="col" className="w-12 px-2 py-3 text-center">
                <span className="sr-only">Simpan</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {shown.map(v => {
              const saved = savedIds.has(v.id);
              const selected = selectedIds.has(v.id);
              return (
                <tr key={v.id} className={cn('transition-colors hover:bg-secondary/40', selected && 'bg-primary/5')}>
                  {selectable && (
                    <td className="px-3 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => onSelect(v.id)}
                        aria-pressed={selected}
                        aria-label={`${selected ? 'Batal pilih' : 'Pilih'} ${v.title}`}
                        className={cn(
                          'inline-flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors',
                          selected ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background text-transparent'
                        )}
                      >
                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      </button>
                    </td>
                  )}
                  <td className="max-w-[360px] px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => (selectable ? onSelect(v.id) : onPreview(v))}
                      className="group flex w-full items-center gap-3 text-left"
                    >
                      <div className="relative h-11 w-20 shrink-0 overflow-hidden rounded-md bg-secondary">
                        <img src={v.thumbnail} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                        <span className="absolute inset-0 flex items-center justify-center bg-black/35 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                          <Play className="h-4 w-4 fill-white text-white" />
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 font-medium leading-5 text-foreground group-hover:text-primary">{v.title}</p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="truncate">{v.channelTitle}</span>
                          {v.isShort && <span className="rounded bg-secondary px-1.5 py-px text-[11px]">Shorts</span>}
                        </p>
                      </div>
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right font-medium tabular-nums text-foreground" title={formatFullNumber(v.viewCountRaw)}>
                    {v.views}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                    {v.isOutlier ? (
                      <span className="inline-flex rounded bg-outlier/15 px-1.5 py-0.5 text-xs font-medium text-outlier">
                        {v.outlierRatio ? `${v.outlierRatio.toLocaleString('id-ID')}×` : 'Outlier'}
                      </span>
                    ) : v.outlierRatio ? (
                      <span className="text-xs text-muted-foreground">{v.outlierRatio.toLocaleString('id-ID')}×</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                    {v.likesHidden ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <span className={cn('text-xs font-medium', v.engagementRate >= 5 ? 'text-success' : 'text-foreground')}>
                        {v.engagementRate}%
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                    {v.likesHidden ? '—' : v.likes}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                    {v.commentsDisabled ? '—' : v.comments}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                    {v.durationFormatted}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right text-xs tabular-nums text-muted-foreground">
                    <time dateTime={v.publishedAt}>{formatDate(v.publishedAt)}</time>
                  </td>
                  <td className="px-2 py-2.5 text-center">
                    <button
                      type="button"
                      onClick={() => onSaveToggle(v)}
                      aria-label={saved ? `Hapus ${v.title} dari Tersimpan` : `Simpan ${v.title}`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    >
                      {saved ? <BookmarkCheck className="h-4 w-4 text-primary" /> : <Bookmark className="h-4 w-4" />}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {remaining > 0 && (
        <div className="flex justify-center border-t border-border p-3">
          <button type="button" onClick={() => setVisible(v => v + PAGE_SIZE)} className="yt-pill">
            Tampilkan {Math.min(PAGE_SIZE, remaining)} video lagi ({remaining} tersisa)
          </button>
        </div>
      )}
    </div>
  );
};

export default VideoTable;
