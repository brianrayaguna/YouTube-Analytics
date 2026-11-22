import React, { useEffect, useState } from 'react';
import { ExternalLink, HardDrive, Film, Music, Loader2 } from 'lucide-react';
import { DOWNLOADER_SERVICES, openDownloader } from '../constants/downloaders';
import { checkLocalDownloader, LocalHealth, LocalQuality, LocalFormat } from '../services/localDownloader';
import { downloadVideoLocally } from '../services/videoDownload';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
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

/** Dialog pilihan metode unduhan video (mesin lokal atau layanan online). */
const VideoDownloader: React.FC<VideoDownloaderProps> = ({ videoUrl, videoTitle, isOpen, onClose, onToast }) => {
  const [health, setHealth] = useState<LocalHealth | null>(null);
  const [checking, setChecking] = useState(false);

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
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto rounded-xl border border-border bg-popover p-6 text-popover-foreground sm:max-w-md sm:rounded-xl">
        <DialogHeader className="pr-8 text-left">
          <DialogTitle className="text-base font-semibold">Unduh video</DialogTitle>
          <DialogDescription className="line-clamp-1">{videoTitle}</DialogDescription>
        </DialogHeader>

        {/* Perangkat ini (yt-dlp) */}
        <div className="mt-4 rounded-xl bg-secondary p-4">
          <p className="flex items-center gap-2 text-sm font-medium">
            <HardDrive className="h-4 w-4" aria-hidden="true" /> Simpan ke perangkat ini
            {checking && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />}
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
                  className="flex min-h-11 items-center gap-2 rounded-lg bg-background px-3 text-sm font-medium transition-colors hover:bg-accent sm:min-h-10"
                >
                  <o.icon className="h-4 w-4" aria-hidden="true" />
                  {o.format === 'mp3' && !health?.ffmpeg ? 'Audio M4A' : o.label}
                </button>
              ))}
            </div>
          ) : (
            !checking && (
              <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                Layanan lokal belum aktif. Buka menu <b className="font-medium text-foreground">Video Downloader → Perangkat ini</b> untuk melakukan pemasangan satu kali agar unduhan tersimpan langsung tanpa situs pihak ketiga.
              </p>
            )
          )}
        </div>

        <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Layanan online</p>
        <ul className="-mx-6 mt-1">
          {DOWNLOADER_SERVICES.map(service => (
            <li key={service.id}>
              <button
                type="button"
                onClick={() => openDownloader(service, videoUrl)}
                className="flex min-h-14 w-full items-center gap-4 px-6 py-3 text-left transition-colors hover:bg-secondary"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold">
                  {service.name.charAt(0)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-sm font-medium">{service.name}</span>
                  <span className="block text-xs text-muted-foreground">{service.description}</span>
                </span>
                <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>

        <p className="mt-4 text-xs leading-5 text-muted-foreground">
          Pengunduhan hanya diperuntukkan bagi penggunaan pribadi dengan menghormati hak cipta kreator.
        </p>
      </DialogContent>
    </Dialog>
  );
};

export default VideoDownloader;
