import React, { useState } from 'react';
import { ExternalLink, ListVideo, Search, Flame, Info } from 'lucide-react';
import { AnalyzedData } from '../types';
import { ChannelAvatar } from './VideoCard';
import { formatFullNumber } from '../lib/format';

interface ChannelHeaderProps {
  data: AnalyzedData;
  regionName?: string;
}

/** Header halaman channel dan hasil analisis selaras tata letak YouTube web. */
const ChannelHeader: React.FC<ChannelHeaderProps> = ({ data, regionName }) => {
  const [bannerOk, setBannerOk] = useState(true);
  const [showFullDesc, setShowFullDesc] = useState(false);
  const stats = data.channelStats;

  if (data.source === 'channel' && stats) {
    const handle = stats.customUrl ? (stats.customUrl.startsWith('@') ? stats.customUrl : `@${stats.customUrl}`) : '';
    const isDemo = data.channelId?.startsWith('UCdemo');
    const channelUrl = handle ? `https://www.youtube.com/${handle}` : `https://www.youtube.com/channel/${data.channelId}`;

    return (
      <div className="mb-3">
        {stats.banner && bannerOk && (
          <div className="mb-5 aspect-[6.2/1] w-full overflow-hidden rounded-2xl bg-secondary">
            <img
              src={`${stats.banner}=w1707-fcrop64=1,00005a57ffffa5a8-k-c0xffffffff-no-nd-rj`}
              alt=""
              {...({ fetchpriority: 'high' } as React.ImgHTMLAttributes<HTMLImageElement>)}
              referrerPolicy="no-referrer"
              onError={() => setBannerOk(false)}
              className="h-full w-full object-cover"
            />
          </div>
        )}
        <div className="flex items-start gap-4 sm:items-center sm:gap-6">
          <ChannelAvatar
            name={stats.title || data.channelTitle || ''}
            src={stats.avatar}
            size={null}
            className="h-[72px] w-[72px] text-2xl sm:h-40 sm:w-40 sm:text-5xl"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="truncate text-2xl font-bold leading-tight text-foreground sm:text-4xl">
                {stats.title || data.channelTitle}
              </h1>
              {isDemo && (
                <span className="rounded-full bg-outlier/15 px-2.5 py-0.5 text-xs font-medium text-outlier">
                  Data contoh
                </span>
              )}
            </div>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm tabular-nums text-muted-foreground">
              {handle && <span className="font-medium text-foreground">{handle}</span>}
              {handle && <span aria-hidden="true">•</span>}
              <span>{stats.hiddenSubscriberCount ? 'Jumlah subscriber disembunyikan' : `${stats.subscriberCount} subscriber`}</span>
              <span aria-hidden="true">•</span>
              <span>{formatFullNumber(stats.videoCountRaw ?? 0)} video</span>
              <span className="hidden sm:inline" aria-hidden="true">•</span>
              <span className="hidden sm:inline">{stats.viewCount} tayangan</span>
            </p>
            {stats.description && (
              <button
                type="button"
                aria-expanded={showFullDesc}
                onClick={() => setShowFullDesc(s => !s)}
                className={`mt-2 block max-w-2xl text-left text-sm leading-5 text-muted-foreground hover:text-foreground ${
                  showFullDesc ? 'whitespace-pre-line' : 'line-clamp-1'
                }`}
              >
                {stats.description}
              </button>
            )}
            {!isDemo && (
              <div className="mt-3.5 flex flex-wrap gap-2">
                <a href={channelUrl} target="_blank" rel="noopener noreferrer" className="yt-pill-primary">
                  Buka di YouTube <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </a>
              </div>
            )}
          </div>
        </div>
        {data.notice && <Notice text={data.notice} />}
      </div>
    );
  }

  const Icon = data.source === 'playlist' ? ListVideo : data.source === 'trending' ? Flame : Search;
  const title =
    data.source === 'trending'
      ? `Trending${regionName ? ` — ${regionName}` : ''}`
      : data.source === 'search'
        ? `Hasil pencarian "${data.query}"`
        : data.channelTitle || 'Hasil analisis';

  return (
    <div className="mb-3">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-secondary">
          <Icon className={`h-7 w-7 ${data.source === 'trending' ? 'text-destructive' : 'text-foreground'}`} strokeWidth={1.75} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-foreground sm:text-3xl">{title}</h1>
          <p className="text-sm tabular-nums text-muted-foreground">{formatFullNumber(data.totalFound)} video dianalisis</p>
        </div>
      </div>
      {data.notice && <Notice text={data.notice} />}
    </div>
  );
};

const Notice: React.FC<{ text: string }> = ({ text }) => (
  <p className="mt-4 flex items-start gap-2 rounded-xl bg-secondary px-3.5 py-2.5 text-xs leading-5 text-muted-foreground sm:text-sm">
    <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
    <span>{text}</span>
  </p>
);

export default ChannelHeader;
