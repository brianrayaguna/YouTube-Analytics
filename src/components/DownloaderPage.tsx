import React, { useState } from 'react';
import { Download, ClipboardPaste, ExternalLink, Film, Music, ListVideo, Smartphone, Info } from 'lucide-react';
import { ShowToast } from '../types';
import { DOWNLOADER_SERVICES, openDownloader, normalizeVideoUrl, isYouTubeUrl, extractYouTubeVideoId } from '../constants/downloaders';
import { PageHeader, SectionCard } from './common';
import { cn } from '@/lib/utils';

interface DownloaderPageProps {
  onToast: ShowToast;
}

const FORMATS = [
  { icon: Film, title: 'Video MP4', text: '720p, 1080p, 4K' },
  { icon: Music, title: 'Audio MP3', text: 'Kualitas tinggi' },
  { icon: Smartphone, title: 'Shorts & Reels', text: 'Format vertikal' },
  { icon: ListVideo, title: 'Multi-platform', text: 'YouTube, TikTok, IG, X' },
];

const DownloaderPage: React.FC<DownloaderPageProps> = ({ onToast }) => {
  const [videoUrl, setVideoUrl] = useState('');
  const [selected, setSelected] = useState(DOWNLOADER_SERVICES[0].id);

  const url = normalizeVideoUrl(videoUrl);
  const ytId = extractYouTubeVideoId(videoUrl);
  const service = DOWNLOADER_SERVICES.find(s => s.id === selected) ?? DOWNLOADER_SERVICES[0];
  const unsupported = !!url && service.youtubeOnly && !isYouTubeUrl(url);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setVideoUrl(text.trim());
    } catch {
      onToast('Izin papan klip ditolak — tempel manual dengan Ctrl+V', 'error');
    }
  };

  const handleDownload = () => {
    if (!url) {
      onToast('Tempel URL video terlebih dahulu', 'error');
      return;
    }
    openDownloader(service, url);
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Video Downloader" subtitle="Unduh video dari YouTube, TikTok, Instagram, dan lainnya melalui layanan pihak ketiga." />

      <div className="yt-card p-4 sm:p-6">
        <form
          className="flex flex-col gap-3 sm:flex-row"
          onSubmit={e => {
            e.preventDefault();
            handleDownload();
          }}
        >
          <div className="flex h-12 flex-1 items-center rounded-full border border-input bg-background pl-5 pr-1 focus-within:border-primary">
            <input
              type="url"
              inputMode="url"
              value={videoUrl}
              onChange={e => setVideoUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=…"
              className="h-full min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
              aria-label="URL video"
            />
            <button type="button" onClick={handlePaste} className="yt-pill h-10 bg-transparent" title="Tempel dari papan klip">
              <ClipboardPaste className="h-5 w-5" strokeWidth={1.75} /> <span className="hidden sm:inline">Tempel</span>
            </button>
          </div>
          <button type="submit" disabled={!url} className="yt-pill-primary h-12 px-6 text-base">
            <Download className="h-5 w-5" /> Unduh
          </button>
        </form>

        {ytId && (
          <div className="mt-4 flex items-center gap-3 rounded-xl bg-secondary p-3">
            <img src={`https://i.ytimg.com/vi/${ytId}/mqdefault.jpg`} alt="" className="aspect-video w-28 shrink-0 rounded-lg object-cover" />
            <div className="min-w-0 text-sm">
              <p className="font-medium text-foreground">Video YouTube terdeteksi</p>
              <p className="truncate text-muted-foreground">{url}</p>
            </div>
          </div>
        )}

        <h2 className="mb-3 mt-6 text-sm font-medium text-foreground">Pilih layanan</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {DOWNLOADER_SERVICES.map(s => (
            <div
              key={s.id}
              className={cn(
                'flex items-center gap-1 rounded-xl border pr-2 transition-colors',
                selected === s.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-secondary'
              )}
            >
              <button
                type="button"
                onClick={() => setSelected(s.id)}
                aria-pressed={selected === s.id}
                className="flex min-w-0 flex-1 items-center gap-3 p-3 text-left"
              >
                <span
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold',
                    selected === s.id ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'
                  )}
                >
                  {s.name.charAt(0)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 text-sm font-medium text-foreground">
                    {s.name}
                    {s.recommended && <span className="rounded-sm bg-primary/10 px-1.5 py-px text-[11px] text-primary">Disarankan</span>}
                    {s.youtubeOnly && <span className="rounded-sm bg-secondary px-1.5 py-px text-[11px] text-muted-foreground">YouTube saja</span>}
                  </span>
                  <span className="block text-xs text-muted-foreground">{s.description}</span>
                </span>
              </button>
              <a
                href={s.homepage}
                target="_blank"
                rel="noopener noreferrer"
                className="yt-icon-btn h-8 w-8"
                aria-label={`Buka ${s.name}`}
                title={`Buka ${s.name}`}
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          ))}
        </div>
        {unsupported && (
          <p className="mt-3 text-sm text-warning">{service.name} hanya mendukung YouTube — halaman utamanya akan dibuka. Gunakan Cobalt untuk platform lain.</p>
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {FORMATS.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-xl bg-secondary p-4">
            <Icon className="h-5 w-5 text-foreground" strokeWidth={1.75} />
            <p className="mt-3 text-sm font-medium text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground">{text}</p>
          </div>
        ))}
      </div>

      <SectionCard className="mt-6" title="Catatan">
        <p className="flex gap-3 text-sm leading-6 text-muted-foreground">
          <Info className="mt-1 h-4 w-4 shrink-0" />
          Unduhan diproses oleh layanan pihak ketiga di tab baru; aplikasi ini tidak menyimpan video. Gunakan hanya untuk penggunaan pribadi dan
          hormati hak cipta kreator.
        </p>
      </SectionCard>
    </div>
  );
};

export default DownloaderPage;
