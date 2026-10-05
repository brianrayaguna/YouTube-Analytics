import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
} from 'lucide-react';
import { VideoItem, ShowToast } from '../types';
import VideoDownloader from './VideoDownloader';
import { ChannelAvatar } from './VideoCard';
import { copyToClipboard, downloadThumbnail } from '../services/exportService';
import { formatFullNumber, formatDate } from '../lib/format';

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

/** Pratinjau video dengan tata letak halaman tonton YouTube. */
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

  // Kunci scroll halaman saat modal terbuka
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || showDownloader) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' && hasNext) onNext?.();
      else if (e.key === 'ArrowLeft' && hasPrev) onPrev?.();
      else if ((e.key === 's' || e.key === 'S') && video && !e.metaKey && !e.ctrlKey) onSaveToggle?.(video);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, showDownloader, onClose, onNext, onPrev, hasNext, hasPrev, video, onSaveToggle]);

  if (!video) return null;
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
    { icon: ThumbsUp, label: 'Suka', value: formatFullNumber(video.likeCountRaw) },
    { icon: MessageSquare, label: 'Komentar', value: formatFullNumber(video.commentCountRaw) },
    { icon: Activity, label: 'Engagement', value: `${video.engagementRate}%` },
    { icon: Clock, label: 'Durasi', value: video.durationFormatted },
  ];

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[300] flex items-stretch justify-center bg-black/80 md:items-center md:p-6"
            onClick={onClose}
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={e => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label={video.title}
              className="flex w-full max-w-[1100px] flex-col overflow-hidden bg-background md:max-h-[94vh] md:rounded-xl"
            >
              {/* Bar atas */}
              <div className="flex h-12 shrink-0 items-center gap-1 px-2">
                <button type="button" onClick={onClose} className="yt-icon-btn" aria-label="Tutup (Esc)">
                  <X className="h-6 w-6" strokeWidth={1.75} />
                </button>
                {position && (
                  <span className="ml-1 text-sm text-muted-foreground">
                    {position.index + 1} / {position.total}
                  </span>
                )}
                <div className="ml-auto flex items-center gap-1">
                  <button type="button" onClick={onPrev} disabled={!hasPrev} className="yt-icon-btn" aria-label="Sebelumnya (←)">
                    <ChevronLeft className="h-6 w-6" strokeWidth={1.75} />
                  </button>
                  <button type="button" onClick={onNext} disabled={!hasNext} className="yt-icon-btn" aria-label="Berikutnya (→)">
                    <ChevronRight className="h-6 w-6" strokeWidth={1.75} />
                  </button>
                </div>
              </div>

              <div className="overflow-y-auto">
                <div className="aspect-video max-h-[62vh] w-full bg-black">
                  <iframe
                    key={video.id}
                    src={`https://www.youtube.com/embed/${video.id}?autoplay=1&rel=0&modestbranding=1`}
                    title={video.title}
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                </div>

                <div className="p-3 sm:p-4 md:px-6 md:pb-6">
                  <h1 className="line-clamp-2 text-lg font-bold leading-7 text-foreground md:text-xl">{video.title}</h1>

                  <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <ChannelAvatar name={video.channelTitle} size={40} />
                      <div className="min-w-0">
                        <p className="truncate text-base font-medium text-foreground">{video.channelTitle}</p>
                        <p className="text-xs text-muted-foreground">{video.isShort ? 'Shorts' : 'Video'}</p>
                      </div>
                      {onAnalyzeChannel && video.channelId && (
                        <button
                          type="button"
                          onClick={() => onAnalyzeChannel(video.channelId)}
                          className="yt-pill-primary ml-2"
                        >
                          Analisis channel
                        </button>
                      )}
                    </div>

                    <div className="-mx-3 flex gap-2 overflow-x-auto px-3 no-scrollbar sm:mx-0 sm:px-0">
                      <button type="button" onClick={() => onSaveToggle?.(video)} className="yt-pill">
                        {isSaved ? <BookmarkCheck className="h-5 w-5" strokeWidth={1.75} /> : <Bookmark className="h-5 w-5" strokeWidth={1.75} />}
                        {isSaved ? 'Tersimpan' : 'Simpan'}
                      </button>
                      <button type="button" onClick={copyLink} className="yt-pill">
                        <Share2 className="h-5 w-5" strokeWidth={1.75} /> Salin link
                      </button>
                      <button type="button" onClick={downloadThumb} className="yt-pill">
                        <ImageDown className="h-5 w-5" strokeWidth={1.75} /> Thumbnail
                      </button>
                      <button type="button" onClick={() => setShowDownloader(true)} className="yt-pill">
                        <Download className="h-5 w-5" strokeWidth={1.75} /> Unduh
                      </button>
                      <a href={url} target="_blank" rel="noopener noreferrer" className="yt-pill" aria-label="Buka di YouTube">
                        <ExternalLink className="h-5 w-5" strokeWidth={1.75} />
                      </a>
                    </div>
                  </div>

                  {/* Kotak deskripsi */}
                  <div
                    className={`mt-3 rounded-xl bg-secondary p-3 text-sm ${expanded ? '' : 'cursor-pointer hover:bg-accent'}`}
                    onClick={() => !expanded && setExpanded(true)}
                  >
                    <p className="font-medium text-foreground">
                      {formatFullNumber(video.viewCountRaw)} x ditonton
                      <span className="ml-2">{formatDate(video.publishedAt)}</span>
                      {video.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="ml-2 text-primary">#{tag.replace(/\s+/g, '')}</span>
                      ))}
                    </p>

                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {stats.map(({ icon: Icon, label, value }) => (
                        <div key={label} className="flex items-center gap-2 rounded-lg bg-background/60 px-3 py-2">
                          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                          <div className="min-w-0">
                            <p className="text-[11px] leading-4 text-muted-foreground">{label}</p>
                            <p className="truncate font-medium leading-5 text-foreground">{value}</p>
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
                          <span key={tag} className="rounded-full bg-background/60 px-2.5 py-1 text-xs text-muted-foreground">{tag}</span>
                        ))}
                      </div>
                    )}
                    {(video.description || video.tags.length > 0) && (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          setExpanded(x => !x);
                        }}
                        className="mt-2 font-medium text-foreground"
                      >
                        {expanded ? 'Sembunyikan' : '…selengkapnya'}
                      </button>
                    )}
                  </div>

                  <p className="mt-3 hidden text-center text-xs text-muted-foreground md:block">
                    ← → navigasi &nbsp;·&nbsp; S simpan &nbsp;·&nbsp; Esc tutup
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <VideoDownloader
        videoUrl={url}
        videoTitle={video.title}
        isOpen={showDownloader}
        onClose={() => setShowDownloader(false)}
      />
    </>
  );
};

export default VideoPreviewModal;
