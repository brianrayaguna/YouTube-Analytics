import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink } from 'lucide-react';
import { DOWNLOADER_SERVICES, openDownloader } from '../constants/downloaders';

interface VideoDownloaderProps {
  videoUrl: string;
  videoTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

/** Dialog pilih layanan downloader (gaya dialog "Bagikan" YouTube). */
const VideoDownloader: React.FC<VideoDownloaderProps> = ({ videoUrl, videoTitle, isOpen, onClose }) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[350] flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="downloader-title"
            className="w-full max-w-md rounded-t-xl bg-popover p-6 text-popover-foreground shadow-popover sm:rounded-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 id="downloader-title" className="text-base font-medium">Unduh video</h2>
                <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{videoTitle}</p>
              </div>
              <button type="button" onClick={onClose} className="yt-icon-btn -mr-2 -mt-2" aria-label="Tutup">
                <X className="h-6 w-6" strokeWidth={1.75} />
              </button>
            </div>

            <ul className="-mx-6 mt-4">
              {DOWNLOADER_SERVICES.map(service => (
                <li key={service.id}>
                  <button
                    type="button"
                    onClick={() => openDownloader(service, videoUrl)}
                    className="flex w-full items-center gap-4 px-6 py-3 text-left transition-colors hover:bg-secondary"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold">
                      {service.name.charAt(0)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        {service.name}
                        {service.recommended && (
                          <span className="rounded-sm bg-primary/10 px-1.5 py-px text-[11px] font-medium text-primary">Disarankan</span>
                        )}
                      </span>
                      <span className="block text-xs text-muted-foreground">{service.description}</span>
                    </span>
                    <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>

            <p className="mt-4 text-xs leading-5 text-muted-foreground">
              Dibuka di tab baru melalui layanan pihak ketiga. Unduh hanya untuk penggunaan pribadi dan hormati hak cipta kreator.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default VideoDownloader;
