import React, { memo, useState } from 'react';
import { MoreVertical, Bookmark, BookmarkCheck, Link2, ImageDown, Download, ExternalLink, Play, Check } from 'lucide-react';
import { VideoItem, ShowToast } from '../types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { copyToClipboard, downloadThumbnail } from '../services/exportService';
import { downloadVideo } from '../services/videoDownload';
import { isLocalDownloaderEnabled } from '../services/localDownloader';
import { cn } from '@/lib/utils';

interface VideoCardProps {
  video: VideoItem;
  index: number;
  onToast: ShowToast;
  onSaveToggle?: (video: VideoItem) => void;
  isSaved?: boolean;
  onPreview?: (video: VideoItem) => void;
  selectable?: boolean;
  isSelected?: boolean;
  onSelect?: (videoId: string) => void;
  /** Tampilan Shorts (thumbnail vertikal) */
  shortsLayout?: boolean;
}

const AVATAR_COLORS = ['#c2185b', '#7b1fa2', '#303f9f', '#0288d1', '#00796b', '#689f38', '#f57c00', '#5d4037', '#455a64', '#e64a19'];

const channelColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

export const ChannelAvatar: React.FC<{ name: string; src?: string; size?: number; className?: string }> = ({
  name,
  src,
  size = 36,
  className,
}) =>
  src ? (
    <img
      src={src}
      alt=""
      referrerPolicy="no-referrer"
      className={cn('shrink-0 rounded-full bg-secondary object-cover', className)}
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      className={cn('flex shrink-0 select-none items-center justify-center rounded-full font-medium text-white', className)}
      style={{ width: size, height: size, backgroundColor: channelColor(name || 'YouTube'), fontSize: size * 0.42 }}
      aria-hidden="true"
    >
      {(name || '?').trim().charAt(0).toUpperCase()}
    </div>
  );

const VideoCard: React.FC<VideoCardProps> = ({
  video,
  index,
  onToast,
  onSaveToggle,
  isSaved,
  onPreview,
  selectable = false,
  isSelected = false,
  onSelect,
  shortsLayout = false,
}) => {
  const [imgError, setImgError] = useState(false);
  const url = `https://www.youtube.com/watch?v=${video.id}`;

  const handleOpen = () => {
    if (selectable) onSelect?.(video.id);
    else onPreview?.(video);
  };

  const handleCopy = async () => {
    try {
      await copyToClipboard(url);
      onToast('Link disalin ke papan klip', 'success');
    } catch {
      onToast('Gagal menyalin link', 'error');
    }
  };

  const handleThumb = async () => {
    onToast('Mengunduh thumbnail…', 'loading');
    try {
      await downloadThumbnail(video, `${index + 1}. `);
      onToast('Thumbnail diunduh', 'success');
    } catch {
      window.open(video.thumbnail, '_blank', 'noopener,noreferrer');
      onToast('Unduhan langsung diblokir — thumbnail dibuka di tab baru', 'info');
    }
  };

  const handleSave = () => {
    onSaveToggle?.(video);
    onToast(isSaved ? 'Dihapus dari Tersimpan' : 'Disimpan ke Tersimpan', 'success');
  };

  const menu = (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={e => e.stopPropagation()}
          className="flex h-9 w-9 items-center justify-center rounded-full text-foreground opacity-100 transition-opacity hover:bg-secondary data-[state=open]:opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
          aria-label="Menu tindakan"
        >
          <MoreVertical className="h-5 w-5" strokeWidth={1.75} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 rounded-xl py-2 shadow-popover">
        <DropdownMenuItem className="h-9 gap-4 rounded-none px-4 text-sm" onSelect={() => onPreview?.(video)}>
          <Play className="h-5 w-5" strokeWidth={1.75} /> Putar pratinjau
        </DropdownMenuItem>
        <DropdownMenuItem className="h-9 gap-4 rounded-none px-4 text-sm" onSelect={handleSave}>
          {isSaved ? <BookmarkCheck className="h-5 w-5" strokeWidth={1.75} /> : <Bookmark className="h-5 w-5" strokeWidth={1.75} />}
          {isSaved ? 'Hapus dari Tersimpan' : 'Simpan'}
        </DropdownMenuItem>
        <DropdownMenuSeparator className="my-2" />
        <DropdownMenuItem className="h-9 gap-4 rounded-none px-4 text-sm" onSelect={handleCopy}>
          <Link2 className="h-5 w-5" strokeWidth={1.75} /> Salin link
        </DropdownMenuItem>
        <DropdownMenuItem className="h-9 gap-4 rounded-none px-4 text-sm" onSelect={handleThumb}>
          <ImageDown className="h-5 w-5" strokeWidth={1.75} /> Unduh thumbnail
        </DropdownMenuItem>
        <DropdownMenuItem className="h-9 gap-4 rounded-none px-4 text-sm" onSelect={() => downloadVideo(video.id, video.title, onToast)}>
          <Download className="h-5 w-5" strokeWidth={1.75} /> {isLocalDownloaderEnabled() ? 'Unduh ke perangkat' : 'Unduh video (Cobalt)'}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="h-9 gap-4 rounded-none px-4 text-sm"
          onSelect={() => window.open(url, '_blank', 'noopener,noreferrer')}
        >
          <ExternalLink className="h-5 w-5" strokeWidth={1.75} /> Buka di YouTube
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const thumbnail = (
    <div
      role="button"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleOpen();
        }
      }}
      aria-label={selectable ? `Pilih ${video.title}` : `Putar ${video.title}`}
      className={cn(
        'relative w-full cursor-pointer overflow-hidden rounded-xl bg-secondary',
        shortsLayout ? 'aspect-[9/16]' : 'aspect-video',
        isSelected && 'ring-[3px] ring-primary ring-offset-2 ring-offset-background'
      )}
    >
      {!imgError ? (
        <img
          src={video.thumbnail}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setImgError(true)}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">Thumbnail tidak tersedia</div>
      )}

      {!shortsLayout && video.durationSec > 0 && (
        <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-px text-xs font-medium text-white">
          {video.durationFormatted}
        </span>
      )}

      {/* Simpan cepat (mirip tombol "Tonton nanti") */}
      {!selectable && onSaveToggle && (
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            handleSave();
          }}
          title={isSaved ? 'Hapus dari Tersimpan' : 'Simpan'}
          aria-label={isSaved ? 'Hapus dari Tersimpan' : 'Simpan'}
          className={cn(
            'absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded bg-black/80 text-white transition-opacity',
            isSaved ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
          )}
        >
          {isSaved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
        </button>
      )}

      {selectable && (
        <span
          className={cn(
            'absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors',
            isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-white bg-black/40 text-transparent'
          )}
          aria-hidden="true"
        >
          <Check className="h-4 w-4" strokeWidth={3} />
        </span>
      )}
    </div>
  );

  const badges = (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {video.likesHidden ? (
        <span className="rounded-sm bg-secondary px-1 py-px text-xs font-medium text-muted-foreground" title="Kreator menyembunyikan jumlah like">
          Like disembunyikan
        </span>
      ) : (
        <span
          className={cn(
            'rounded-sm px-1 py-px text-xs font-medium',
            video.engagementRate >= 5 ? 'bg-success/15 text-success' : 'bg-secondary text-muted-foreground'
          )}
          title="Engagement rate = (likes + komentar) / views"
        >
          ER {video.engagementRate}%
        </span>
      )}
      {video.isOutlier && (
        <span className="rounded-sm bg-youtube-red/10 px-1 py-px text-xs font-medium text-destructive" title="Views ≥ 3× median daftar">
          Outlier
        </span>
      )}
      {video.isShort && !shortsLayout && (
        <span className="rounded-sm bg-secondary px-1 py-px text-xs font-medium text-muted-foreground">Shorts</span>
      )}
    </div>
  );

  if (shortsLayout) {
    return (
      <div className="group flex flex-col">
        {thumbnail}
        <div className="relative mt-2 pr-8">
          <h3
            className="line-clamp-2 cursor-pointer text-base font-medium leading-[22px] text-foreground"
            onClick={handleOpen}
            title={video.title}
          >
            {video.title}
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{video.views} x ditonton</p>
          {badges}
          <div className="absolute -right-2 -top-1">{menu}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex flex-col">
      {thumbnail}
      <div className="mt-3 flex gap-3">
        <ChannelAvatar name={video.channelTitle} />
        <div className="relative min-w-0 flex-1 pr-7">
          <h3
            className="line-clamp-2 cursor-pointer text-base font-medium leading-[22px] text-foreground"
            onClick={handleOpen}
            title={video.title}
          >
            {video.title}
          </h3>
          <p className="mt-1 truncate text-sm text-muted-foreground" title={video.channelTitle}>
            {video.channelTitle}
          </p>
          <p className="text-sm text-muted-foreground">
            {video.views} x ditonton <span aria-hidden="true">•</span> {video.publishedTimeAgo}
          </p>
          {badges}
          <div className="absolute -right-2 -top-1">{menu}</div>
        </div>
      </div>
    </div>
  );
};

export default memo(VideoCard);
