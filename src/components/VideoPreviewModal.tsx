import React, { useEffect, useState } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  BookmarkCheck,
  Share2,
  ImageDown,
  Download,
  ExternalLink,
  ThumbsUp,
  MessageSquare,
  Activity,
  Clock,
  Sparkles,
} from 'lucide-react';
import { VideoItem, ShowToast } from '../types';
import VideoDownloader from './VideoDownloader';
import { ChannelAvatar } from './VideoCard';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog';
import { copyToClipboard, downloadThumbnail } from '../services/exportService';
import { formatFullNumber, formatDateWithDay, formatTime, formatDateTimeLong } from '../lib/format';

interface VideoPreviewModalProps {
  video: VideoItem | null;
  isOpen: boolean;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  onSaveToggle?: (video: VideoItem) => void;
  onAnalyzeChannel?: (channelId: string) => void;
  isSaved?: boolean;
  onToast: ShowToast;
  hasNext?: boolean;
  hasPrev?: boolean;
  position?: { index: number; total: number };
}

/** Dialog pratinjau video dengan focus trap, navigasi keyboard, dan metrik lengkap. */
const VideoPreviewModal: React.FC<VideoPreviewModalProps> = ({
  video,
  isOpen,
  onClose,
  onNext,
  onPrev,
  onSaveToggle,
  onAnalyzeChannel,
  isSaved,
  onToast,
  hasNext,
  hasPrev,
  position,
}) => {
  const [showDownloader, setShowDownloader] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => setExpanded(false), [video?.id]);

  useEffect(() => {
    if (!isOpen || showDownloader) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowRight' && hasNext) onNext?.();
      else if (e.key === 'ArrowLeft' && hasPrev) onPrev?.();
      else if ((e.key === 's' || e.key === 'S') && video && !e.metaKey && !e.ctrlKey) onSaveToggle?.(video);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, showDownloader, onNext, onPrev, hasNext, hasPrev, video, onSaveToggle]);

  if (!video) return null;
  const isDemo = video.id.startsWith('demo_');
  const url = `https://www.youtube.com/watch?v=${video.id}`;

  const copyLink = async () => {
    try {
      await copyToClipboard(url);
      onToast('Link disalin ke papan klip', 'success');
    } catch {
      onToast('Gagal menyalin link', 'error');
    }
  };

  const downloadThumb = async () => {
    onToast('Mengunduh thumbnail…', 'loading');
    try {
      await downloadThumbnail(video);
      onToast('Thumbnail diunduh', 'success');
    } catch {
      window.open(video.thumbnail, '_blank', 'noopener,noreferrer');
      onToast('Unduhan langsung diblokir — thumbnail dibuka di tab baru', 'info');
    }
  };

  const stats = [
    { icon: ThumbsUp, label: 'Suka', value: video.likesHidden ? 'Disembunyikan' : formatFullNumber(video.likeCountRaw) },
    { icon: MessageSquare, label: 'Komentar', value: video.commentsDisabled ? 'Nonaktif' : formatFullNumber(video.commentCountRaw) },
    { icon: Activity, label: 'Engagement', value: video.likesHidden ? 'Disembunyikan' : `${video.engagementRate}%` },
    { icon: Clock, label: 'Durasi', value: video.durationFormatted },
  ];

  return (
    <>
      <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
        <DialogContent
          hideClose
          overlayClassName="bg-black/80"
          className="flex h-[100dvh] w-full max-w-[1060px] flex-col gap-0 overflow-hidden rounded-none border-0 bg-background p-0 sm:h-auto sm:max-h-[94vh] sm:w-[calc(100%-2rem)] sm:rounded-xl sm:border sm:border-border"
        >
          <DialogDescription className="sr-only">
            Pratinjau dan statistik detail untuk video {video.title}
          </DialogDescription>

          {/* Bar atas */}
          <div className="flex h-12 shrink-0 items-center gap-1 border-b border-border/60 px-2">
            <button type="button" onClick={onClose} className="yt-icon-btn" aria-label="Tutup pratinjau">
              <X className="h-5 w-5" strokeWidth={1.75} />
            </button>
            {position && (
              <span className="ml-1 text-sm tabular-nums text-muted-foreground">
                {position.index + 1} / {position.total}
              </span>
            )}
            <div className="ml-auto flex items-center gap-1">
              <button type="button" onClick={onPrev} disabled={!hasPrev} className="yt-icon-btn" aria-label="Video sebelumnya">
                <ChevronLeft className="h-5 w-5" strokeWidth={1.75} />
              </button>
              <button type="button" onClick={onNext} disabled={!hasNext} className="yt-icon-btn" aria-label="Video berikutnya">
                <ChevronRight className="h-5 w-5" strokeWidth={1.75} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="relative aspect-video max-h-[58vh] w-full bg-black">
              {isDemo ? (
                <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-slate-950">
                  <img src={video.thumbnail} alt="" className="h-full w-full object-contain" />
                  <div className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full bg-black/75 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
                    <Sparkles className="h-3.5 w-3.5 text-teal-300" aria-hidden="true" />
                    Pratinjau data contoh luring
                  </div>
                </div>
              ) : (
                <iframe
                  key={video.id}
                  src={`https://www.youtube.com/embed/${video.id}?autoplay=1&rel=0&modestbranding=1`}
                  title={video.title}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              )}
            </div>

            <div className="p-4 md:px-6 md:pb-6">
              <DialogTitle className="line-clamp-2 text-lg font-bold leading-7 text-foreground md:text-xl">
                {video.title}
              </DialogTitle>

              <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <ChannelAvatar name={video.channelTitle} size={40} />
                  <div className="min-w-0">
                    <p className="truncate text-base font-medium text-foreground">{video.channelTitle}</p>
                    <p className="text-xs text-muted-foreground">{video.isShort ? 'Shorts' : 'Video'}</p>
                  </div>
                  {onAnalyzeChannel && video.channelId && !isDemo && (
                    <button
                      type="button"
                      onClick={() => onAnalyzeChannel(video.channelId)}
                      className="yt-pill-primary ml-2"
                    >
                      Analisis channel
                    </button>
                  )}
                </div>

                <div className="-mx-4 flex gap-2 overflow-x-auto px-4 no-scrollbar sm:mx-0 sm:px-0">
                  <button type="button" onClick={() => onSaveToggle?.(video)} className="yt-pill">
                    {isSaved ? <BookmarkCheck className="h-4 w-4" strokeWidth={1.75} /> : <Bookmark className="h-4 w-4" strokeWidth={1.75} />}
                    {isSaved ? 'Tersimpan' : 'Simpan'}
                  </button>
                  <button type="button" onClick={copyLink} className="yt-pill">
                    <Share2 className="h-4 w-4" strokeWidth={1.75} /> Salin link
                  </button>
                  <button type="button" onClick={downloadThumb} className="yt-pill">
                    <ImageDown className="h-4 w-4" strokeWidth={1.75} /> Thumbnail
                  </button>
                  {!isDemo && (
                    <>
                      <button type="button" onClick={() => setShowDownloader(true)} className="yt-pill">
                        <Download className="h-4 w-4" strokeWidth={1.75} /> Unduh
                      </button>
                      <a href={url} target="_blank" rel="noopener noreferrer" className="yt-pill" aria-label="Buka di YouTube">
                        <ExternalLink className="h-4 w-4" strokeWidth={1.75} />
                      </a>
                    </>
                  )}
                </div>
              </div>

              {/* Kotak deskripsi & metrik */}
              <div className="mt-4 rounded-xl bg-secondary p-3.5 text-sm">
                <p className="font-medium tabular-nums text-foreground">
                  {formatFullNumber(video.viewCountRaw)} x ditonton
                  <span className="ml-2 font-normal text-muted-foreground" title={formatDateTimeLong(video.publishedAt)}>
                    {formatDateWithDay(video.publishedAt)} • {formatTime(video.publishedAt)}
                  </span>
                  {video.isOutlier && (
                    <span className="ml-2 inline-flex rounded bg-outlier/15 px-1.5 py-0.5 text-xs font-medium text-outlier">
                      {video.outlierRatio ? `Outlier ${video.outlierRatio.toLocaleString('id-ID')}×` : 'Outlier'}
                    </span>
                  )}
                </p>

                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {stats.map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-center gap-2 rounded-lg bg-background/70 px-3 py-2">
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-[11px] leading-4 text-muted-foreground">{label}</p>
                        <p className="truncate font-medium leading-5 tabular-nums text-foreground">{value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {video.description && (
                  <p className={`mt-3 whitespace-pre-line break-words text-foreground ${expanded ? '' : 'line-clamp-3'}`}>
                    {video.description}
                  </p>
                )}
                {video.tags.length > 0 && expanded && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {video.tags.map(tag => (
                      <span key={tag} className="rounded-full bg-background/70 px-2.5 py-1 text-xs text-muted-foreground">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
                {(video.description || video.tags.length > 0) && (
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => setExpanded(x => !x)}
                    className="mt-2.5 inline-flex min-h-9 items-center font-medium text-primary hover:underline"
                  >
                    {expanded ? 'Tampilkan lebih sedikit' : 'Lihat deskripsi & tag lengkap'}
                  </button>
                )}
              </div>

              <p className="mt-3 hidden text-center text-xs text-muted-foreground md:block">
                ← → navigasi &nbsp;·&nbsp; S simpan &nbsp;·&nbsp; Esc tutup
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <VideoDownloader
        videoUrl={url}
        videoTitle={video.title}
        onToast={onToast}
        isOpen={showDownloader}
        onClose={() => setShowDownloader(false)}
      />
    </>
  );
};

export default VideoPreviewModal;
