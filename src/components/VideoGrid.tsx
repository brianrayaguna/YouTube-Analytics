import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Clapperboard } from 'lucide-react';
import VideoCard from './VideoCard';
import { VideoItem, ShowToast, ContentTypeFilter, SortOption } from '../types';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 48;
const SHELF_AFTER = 8;

interface VideoGridProps {
  videos: VideoItem[];
  contentType: ContentTypeFilter;
  sort?: SortOption;
  onShowAllShorts: () => void;
  onToast: ShowToast;
  savedIds: Set<string>;
  onSaveToggle: (video: VideoItem) => void;
  onPreview: (video: VideoItem) => void;
  selectable: boolean;
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
}

const LONG_GRID = 'grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 sm:gap-y-10 lg:grid-cols-3 2xl:grid-cols-4 min-[2200px]:grid-cols-5';
const SHORTS_GRID = 'grid grid-cols-2 gap-x-2.5 gap-y-6 sm:grid-cols-3 sm:gap-x-4 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6';

// Sembunyikan item rak Shorts yang tidak muat dalam satu baris
const SHELF_VISIBILITY = ['', '', 'hidden sm:block', 'hidden md:block', 'hidden lg:block', 'hidden 2xl:block'];

/** Grid video responsif dengan pemuatan bertahap; rak Shorts hanya tampil saat urut kronologis terbaru. */
const VideoGrid: React.FC<VideoGridProps> = ({
  videos,
  contentType,
  sort = 'popular',
  onShowAllShorts,
  onToast,
  savedIds,
  onSaveToggle,
  onPreview,
  selectable,
  selectedIds,
  onSelect,
}) => {
  const [visible, setVisible] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => setVisible(PAGE_SIZE), [videos]);

  const longs = contentType === 'all' ? videos.filter(v => !v.isShort) : videos;
  const shorts = contentType === 'all' ? videos.filter(v => v.isShort) : [];
  // Jangan memecah urutan peringkat ketika pengguna menyortir berdasarkan metrik (populer, ER, likes, komentar)
  const useShelf = contentType === 'all' && sort === 'newest' && shorts.length > 0 && longs.length > 0;
  const mainList = useShelf ? longs : videos;
  const hasMore = visible < mainList.length;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) setVisible(v => v + PAGE_SIZE);
      },
      { rootMargin: '800px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, mainList.length]);

  const renderCard = (v: VideoItem, idx: number, shortsLayout: boolean, className?: string) => (
    <div key={v.id} className={className}>
      <VideoCard
        video={v}
        index={idx}
        onToast={onToast}
        isSaved={savedIds.has(v.id)}
        onSaveToggle={onSaveToggle}
        onPreview={onPreview}
        selectable={selectable}
        isSelected={selectedIds.has(v.id)}
        onSelect={onSelect}
        shortsLayout={shortsLayout}
      />
    </div>
  );

  const onlyShorts = contentType === 'shorts' || (contentType === 'all' && longs.length === 0);
  const shown = mainList.slice(0, visible);
  const firstChunk = useShelf ? shown.slice(0, SHELF_AFTER) : shown;
  const rest = useShelf ? shown.slice(SHELF_AFTER) : [];

  return (
    <>
      <div className={onlyShorts ? SHORTS_GRID : LONG_GRID}>
        {firstChunk.map((v, i) => renderCard(v, i, onlyShorts))}
      </div>

      {useShelf && (
        <section className={cn(firstChunk.length > 0 && 'mt-10')}>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-foreground">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
              <Clapperboard className="h-4 w-4" aria-hidden="true" />
            </span>
            Shorts
            <span className="text-sm font-normal tabular-nums text-muted-foreground">({shorts.length})</span>
          </h2>
          <div className={SHORTS_GRID}>
            {shorts.slice(0, 6).map((v, i) => renderCard(v, i, true, SHELF_VISIBILITY[i]))}
          </div>
          <div className="relative mt-6 flex justify-center">
            <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
            <button
              type="button"
              onClick={onShowAllShorts}
              className="relative inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-background px-8 text-sm font-medium transition-colors hover:bg-secondary sm:min-h-9"
            >
              Tampilkan semua Shorts <ChevronDown className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        </section>
      )}

      {rest.length > 0 && <div className={cn(LONG_GRID, 'mt-10')}>{rest.map((v, i) => renderCard(v, i + SHELF_AFTER, false))}</div>}

      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-8">
          <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-secondary border-t-primary" role="status" aria-label="Memuat video lainnya" />
        </div>
      )}
    </>
  );
};

export default VideoGrid;
