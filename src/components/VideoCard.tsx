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
import { formatDateTimeLong } from '../lib/format';
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

export const ChannelAvatar: React.FC<{ name: string; src?: string; size?: number | null; className?: string }> = ({
  name,
  src,
  size = 36,
  className,
}) => {
  const sizeStyle = size ? { width: size, height: size } : undefined;
  return src ? (
    <img
      src={src}
      alt=""
      referrerPolicy="no-referrer"
      className={cn('shrink-0 rounded-full bg-secondary object-cover', className)}
      style={sizeStyle}
    />
  ) : (
    <div
      className={cn('flex shrink-0 select-none items-center justify-center rounded-full font-medium text-white', className)}
      style={{
        ...sizeStyle,
        backgroundColor: channelColor(name || 'Channel'),
        ...(size ? { fontSize: size * 0.42 } : undefined),
      }}
      aria-hidden="true"
    >
      {(name || '?').trim().charAt(0).toUpperCase()}
    </div>
  );
};

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
  const isAboveFold = index < 4;

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
          className="flex h-10 w-10 items-center justify-center rounded-full text-foreground opacity-100 transition-opacity hover:bg-secondary data-[state=open]:opacity-100 sm:h-9 sm:w-9 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
          aria-label={`Menu tindakan untuk ${video.title}`}
        >
          <MoreVertical className="h-5 w-5" strokeWidth={1.75} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 rounded-xl py-2 shadow-popover">
        <DropdownMenuItem className="h-10 gap-3.5 rounded-none px-4 text-sm sm:h-9" onSelect={() => onPreview?.(video)}>
          <Play className="h-4 w-4" strokeWidth={1.75} /> Putar pratinjau
        </DropdownMenuItem>
        <DropdownMenuItem className="h-10 gap-3.5 rounded-none px-4 text-sm sm:h-9" onSelect={handleSave}>
          {isSaved ? <BookmarkCheck className="h-4 w-4" strokeWidth={1.75} /> : <Bookmark className="h-4 w-4" strokeWidth={1.75} />}
          {isSaved ? 'Hapus dari Tersimpan' : 'Simpan'}
        </DropdownMenuItem>
        <DropdownMenuSeparator className="my-1.5" />
        <DropdownMenuItem className="h-10 gap-3.5 rounded-none px-4 text-sm sm:h-9" onSelect={handleCopy}>
          <Link2 className="h-4 w-4" strokeWidth={1.75} /> Salin link
        </DropdownMenuItem>
        <DropdownMenuItem className="h-10 gap-3.5 rounded-none px-4 text-sm sm:h-9" onSelect={handleThumb}>
          <ImageDown className="h-4 w-4" strokeWidth={1.75} /> Unduh thumbnail
        </DropdownMenuItem>
        <DropdownMenuItem className="h-10 gap-3.5 rounded-none px-4 text-sm sm:h-9" onSelect={() => downloadVideo(video.id, video.title, onToast)}>
          <Download className="h-4 w-4" strokeWidth={1.75} /> {isLocalDownloaderEnabled() ? 'Unduh ke perangkat' : 'Unduh video (online)'}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="h-10 gap-3.5 rounded-none px-4 text-sm sm:h-9"
          onSelect={() => window.open(url, '_blank', 'noopener,noreferrer')}
        >
          <ExternalLink className="h-4 w-4" strokeWidth={1.75} /> Buka di YouTube
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const thumbnail = (
    <div
      className={cn(
        'relative w-full overflow-hidden rounded-xl bg-secondary',
        shortsLayout ? 'aspect-[9/16]' : 'aspect-video',
        isSelected && 'ring-[3px] ring-primary ring-offset-2 ring-offset-background'
      )}
    >
      <button
        type="button"
        onClick={handleOpen}
        aria-label={selectable ? `${isSelected ? 'Batal pilih' : 'Pilih'} ${video.title}` : `Putar pratinjau ${video.title}`}
        className="block h-full w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
      >
        {!imgError ? (
          <img
            src={video.thumbnail}
            alt=""
            loading={isAboveFold ? 'eager' : 'lazy'}
            {...(index === 0 ? ({ fetchpriority: 'high' } as React.ImgHTMLAttributes<HTMLImageElement>) : {})}
            decoding="async"
            onError={() => setImgError(true)}
            className="thumb-zoom h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
            Thumbnail tidak tersedia
          </span>
        )}

        {!shortsLayout && video.durationSec > 0 && (
          <span className="absolute bottom-1.5 right-1.5 rounded bg-black/85 px-1.5 py-0.5 text-xs font-medium tabular-nums text-white">
            {video.durationFormatted}
          </span>
        )}

        {selectable && (
          <span
            className={cn(
              'absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors',
              isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-white bg-black/45 text-transparent'
            )}
            aria-hidden="true"
          >
            <Check className="h-4 w-4" strokeWidth={3} />
          </span>
        )}
      </button>

      {/* Simpan cepat — tombol saudara agar tidak bersarang di dalam tombol pratinjau */}
      {!selectable && onSaveToggle && (
        <button
          type="button"
          onClick={handleSave}
          title={isSaved ? 'Hapus dari Tersimpan' : 'Simpan'}
          aria-label={isSaved ? `Hapus ${video.title} dari Tersimpan` : `Simpan ${video.title}`}
          className={cn(
            'absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-lg bg-black/80 text-white transition-opacity sm:h-8 sm:w-8',
            isSaved ? 'opacity-100' : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100'
          )}
        >
          {isSaved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
        </button>
      )}
    </div>
  );

  const badges = (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      {video.likesHidden ? (
        <span className="rounded bg-secondary px-1.5 py-0.5 text-xs font-medium text-muted-foreground" title="Kreator menyembunyikan jumlah like">
          Like disembunyikan
        </span>
      ) : (
        <span
          className={cn(
            'rounded px-1.5 py-0.5 text-xs font-medium tabular-nums',
            video.engagementRate >= 5 ? 'bg-success/15 text-success' : 'bg-secondary text-muted-foreground'
          )}
          title="Engagement rate = (likes + komentar) / views"
        >
          ER {video.engagementRate}%
        </span>
      )}
      {video.isOutlier && (
        <span
          className="rounded bg-outlier/15 px-1.5 py-0.5 text-xs font-medium tabular-nums text-outlier"
          title="Views ≥ 3× median daftar"
        >
          {video.outlierRatio ? `Outlier ${video.outlierRatio.toLocaleString('id-ID')}×` : 'Outlier'}
        </span>
      )}
      {video.isShort && !shortsLayout && (
        <span className="rounded bg-secondary px-1.5 py-0.5 text-xs font-medium text-muted-foreground">Shorts</span>
      )}
    </div>
  );

  const titleButton = (
    <h3 className="text-[15px] font-medium leading-[21px] text-foreground">
      <button
        type="button"
        onClick={handleOpen}
        title={video.title}
        className="line-clamp-2 w-full text-left transition-colors hover:text-primary"
      >
        {video.title}
      </button>
    </h3>
  );

  if (shortsLayout) {
    return (
      <article className={cn('group flex flex-col', !isAboveFold && 'deferred-card')}>
        {thumbnail}
        <div className="relative mt-2 pr-8">
          {titleButton}
          <p className="mt-0.5 text-xs tabular-nums text-muted-foreground sm:text-sm">{video.views} x ditonton</p>
          {badges}
          <div className="absolute -right-2 -top-1">{menu}</div>
        </div>
      </article>
    );
  }

  return (
    <article className={cn('group flex flex-col', !isAboveFold && 'deferred-card')}>
      {thumbnail}
      <div className="mt-3 flex gap-3">
        <ChannelAvatar name={video.channelTitle} />
        <div className="relative min-w-0 flex-1 pr-8">
          {titleButton}
          <p className="mt-1 truncate text-xs text-muted-foreground sm:text-sm" title={video.channelTitle}>
            {video.channelTitle}
          </p>
          <p className="text-xs tabular-nums text-muted-foreground sm:text-sm">
            {video.views} x ditonton <span aria-hidden="true">•</span>{' '}
            <time dateTime={video.publishedAt} title={`Diupload ${formatDateTimeLong(video.publishedAt)}`}>
              {video.publishedTimeAgo}
            </time>
          </p>
          {badges}
          <div className="absolute -right-2 -top-1">{menu}</div>
        </div>
      </div>
    </article>
  );
};

export default memo(VideoCard);
