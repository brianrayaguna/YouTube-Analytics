import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, HardDrive, Film, Music, Loader2 } from 'lucide-react';
import { DOWNLOADER_SERVICES, openDownloader } from '../constants/downloaders';
import { checkLocalDownloader, LocalHealth, LocalQuality, LocalFormat } from '../services/localDownloader';
import { downloadVideoLocally } from '../services/videoDownload';
import { ShowToast } from '../types';

interface VideoDownloaderProps {
  videoUrl: string;
  videoTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onToast?: ShowToast;
}

const LOCAL_OPTIONS: Array<{ label: string; format: LocalFormat; quality: LocalQuality; icon: typeof Film; needsFfmpeg?: boolean }> = [
  { label: 'MP4 terbaik', format: 'mp4', quality: 'best', icon: Film },
  { label: 'MP4 1080p', format: 'mp4', quality: '1080', icon: Film, needsFfmpeg: true },
  { label: 'MP4 720p', format: 'mp4', quality: '720', icon: Film },
  { label: 'Audio MP3', format: 'mp3', quality: 'best', icon: Music },
];

/** Dialog pilih cara unduh (gaya dialog "Bagikan" YouTube). */
const VideoDownloader: React.FC<VideoDownloaderProps> = ({ videoUrl, videoTitle, isOpen, onClose, onToast }) => {
  const [health, setHealth] = useState<LocalHealth | null>(null);
  const [checking, setChecking] = useState(false);

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

  // Cek mesin lokal hanya saat dialog dibuka (aksi pengguna)
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setChecking(true);
    checkLocalDownloader().then(h => {
      if (cancelled) return;
      setHealth(h);
      setChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const localReady = !!health?.ytdlp;

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
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-xl bg-popover p-6 text-popover-foreground shadow-popover sm:rounded-xl"
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

            {/* Perangkat ini (yt-dlp) */}
            <div className="mt-4 rounded-xl bg-secondary p-4">
              <p className="flex items-center gap-2 text-sm font-medium">
                <HardDrive className="h-4 w-4" /> Simpan ke perangkat ini
                {checking && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                {localReady && <span className="ml-auto text-xs font-normal text-success">yt-dlp terhubung</span>}
              </p>
              {localReady ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {LOCAL_OPTIONS.filter(o => !o.needsFfmpeg || health?.ffmpeg).map(o => (
                    <button
                      key={o.label}
                      type="button"
                      onClick={() => {
                        if (onToast) downloadVideoLocally(videoUrl, videoTitle, onToast, { format: o.format, quality: o.quality });
                        onClose();
                      }}
                      className="flex h-10 items-center gap-2 rounded-lg bg-background px-3 text-sm font-medium transition-colors hover:bg-accent"
                    >
                      <o.icon className="h-4 w-4" />
                      {o.format === 'mp3' && !health?.ffmpeg ? 'Audio M4A' : o.label}
                    </button>
                  ))}
                </div>
              ) : (
                !checking && (
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Mesin lokal belum aktif. Buka menu <b className="font-medium text-foreground">Video Downloader → Perangkat ini</b> untuk memasangnya
                    sekali, lalu unduhan tersimpan langsung tanpa situs pihak ketiga.
                  </p>
                )
              )}
            </div>

            <p className="mt-5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Layanan online</p>
            <ul className="-mx-6 mt-1">
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
                      <span className="text-sm font-medium">{service.name}</span>
                      <span className="block text-xs text-muted-foreground">{service.description}</span>
                    </span>
                    <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>

            <p className="mt-4 text-xs leading-5 text-muted-foreground">
              Unduh hanya untuk penggunaan pribadi dan hormati hak cipta kreator.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default VideoDownloader;
