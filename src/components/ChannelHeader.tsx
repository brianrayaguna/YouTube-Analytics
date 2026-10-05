import React, { useState } from 'react';
import { ExternalLink, ListVideo, Search, Flame, Info } from 'lucide-react';
import { AnalyzedData } from '../types';
import { ChannelAvatar } from './VideoCard';
import { formatFullNumber } from '../lib/format';

interface ChannelHeaderProps {
  data: AnalyzedData;
  regionName?: string;
}

/** Header hasil analisis — meniru header halaman channel YouTube. */
const ChannelHeader: React.FC<ChannelHeaderProps> = ({ data, regionName }) => {
  const [bannerOk, setBannerOk] = useState(true);
  const [showFullDesc, setShowFullDesc] = useState(false);
  const stats = data.channelStats;

  if (data.source === 'channel' && stats) {
    const handle = stats.customUrl ? (stats.customUrl.startsWith('@') ? stats.customUrl : `@${stats.customUrl}`) : '';
    const channelUrl = handle ? `https://www.youtube.com/${handle}` : `https://www.youtube.com/channel/${data.channelId}`;
    return (
      <div className="mb-4">
        {stats.banner && bannerOk && (
          <div className="mb-4 aspect-[6.2/1] w-full overflow-hidden rounded-xl bg-secondary">
            <img
              src={`${stats.banner}=w1707-fcrop64=1,00005a57ffffa5a8-k-c0xffffffff-no-nd-rj`}
              alt=""
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
            size={72}
            className="sm:hidden"
          />
          <ChannelAvatar
            name={stats.title || data.channelTitle || ''}
            src={stats.avatar}
            size={160}
            className="hidden sm:block"
          />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-bold leading-tight text-foreground sm:text-4xl">
              {stats.title || data.channelTitle}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground sm:mt-2">
              {handle && <span className="font-medium text-foreground">{handle}</span>}
              {handle && <span className="mx-1">•</span>}
              {stats.hiddenSubscriberCount ? 'Subscriber disembunyikan' : `${stats.subscriberCount} subscriber`}
              <span className="mx-1">•</span>
              {formatFullNumber(stats.videoCountRaw ?? 0)} video
              <span className="mx-1 hidden sm:inline">•</span>
              <span className="hidden sm:inline">{stats.viewCount} x ditonton</span>
            </p>
            {stats.description && (
              <button
                type="button"
                onClick={() => setShowFullDesc(s => !s)}
                className={`mt-1 hidden max-w-2xl text-left text-sm text-muted-foreground sm:block ${showFullDesc ? 'whitespace-pre-line' : 'line-clamp-1'}`}
              >
                {stats.description}
              </button>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={channelUrl} target="_blank" rel="noopener noreferrer" className="yt-pill-primary">
                Buka di YouTube <ExternalLink className="h-4 w-4" />
              </a>
            </div>
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
        ? `Hasil untuk "${data.query}"`
        : data.channelTitle || 'Hasil analisis';

  return (
    <div className="mb-4">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-secondary">
          <Icon className={`h-7 w-7 ${data.source === 'trending' ? 'text-youtube-red' : 'text-foreground'}`} strokeWidth={1.75} />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">{formatFullNumber(data.totalFound)} video dianalisis</p>
        </div>
      </div>
      {data.notice && <Notice text={data.notice} />}
    </div>
  );
};

const Notice: React.FC<{ text: string }> = ({ text }) => (
  <p className="mt-3 flex items-start gap-2 rounded-lg bg-secondary px-3 py-2 text-sm text-muted-foreground">
    <Info className="mt-0.5 h-4 w-4 shrink-0" />
    {text}
  </p>
);

export default ChannelHeader;
