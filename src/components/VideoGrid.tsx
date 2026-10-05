import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import VideoCard from './VideoCard';
import { VideoItem, ShowToast, ContentTypeFilter } from '../types';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 48;
const SHELF_AFTER = 8;

interface VideoGridProps {
  videos: VideoItem[];
  contentType: ContentTypeFilter;
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
const SHORTS_GRID = 'grid grid-cols-2 gap-x-2 gap-y-6 sm:grid-cols-3 sm:gap-x-4 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6';

// Sembunyikan item rak Shorts yang tidak muat dalam satu baris
const SHELF_VISIBILITY = ['', '', 'hidden sm:block', 'hidden md:block', 'hidden lg:block', 'hidden 2xl:block'];

const ShortsMark = () => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
    <path
      fill="hsl(var(--yt-red))"
      d="M17.77 10.32l-1.2-.5L18 9.06c1.84-.96 2.53-3.23 1.56-5.06s-3.24-2.53-5.07-1.56L6 6.94c-1.29.68-2.07 2.04-2 3.49.07 1.42.93 2.67 2.22 3.25.03.01 1.2.5 1.2.5L6 14.93c-1.83.97-2.53 3.24-1.56 5.07.97 1.83 3.24 2.53 5.07 1.56l8.5-4.5c1.29-.68 2.06-2.04 1.99-3.49-.07-1.42-.94-2.68-2.23-3.25z"
    />
    <path fill="#fff" d="M10 14.65v-5.3L15 12z" />
  </svg>
);

/** Grid video ala beranda YouTube + rak Shorts + infinite scroll. */
const VideoGrid: React.FC<VideoGridProps> = ({
  videos,
  contentType,
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
  const useShelf = contentType === 'all' && shorts.length > 0 && longs.length > 0;
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
          <h2 className="mb-4 flex items-center gap-2 text-xl font-bold text-foreground">
            <ShortsMark /> Shorts
            <span className="text-sm font-normal text-muted-foreground">({shorts.length})</span>
          </h2>
          <div className={SHORTS_GRID}>
            {shorts.slice(0, 6).map((v, i) => renderCard(v, i, true, SHELF_VISIBILITY[i]))}
          </div>
          <div className="relative mt-6 flex justify-center">
            <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
            <button
              type="button"
              onClick={onShowAllShorts}
              className="relative inline-flex h-9 items-center gap-2 rounded-full border border-border bg-background px-12 text-sm font-medium hover:bg-secondary"
            >
              Tampilkan semua Shorts <ChevronDown className="h-5 w-5" strokeWidth={1.75} />
            </button>
          </div>
        </section>
      )}

      {rest.length > 0 && <div className={cn(LONG_GRID, 'mt-10')}>{rest.map((v, i) => renderCard(v, i + SHELF_AFTER, false))}</div>}

      {hasMore && (
        <div ref={sentinelRef} className="flex justify-center py-8">
          <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-secondary border-t-primary" aria-label="Memuat" />
        </div>
      )}
    </>
  );
};

export default VideoGrid;
