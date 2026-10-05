import React from 'react';

interface SkeletonCardProps {
  isShort?: boolean;
}

/** Placeholder kartu video ala YouTube saat memuat. */
const SkeletonCard: React.FC<SkeletonCardProps> = ({ isShort = false }) => (
  <div className="flex w-full flex-col gap-3" aria-hidden="true">
    <div className={`${isShort ? 'aspect-[9/16]' : 'aspect-video'} w-full rounded-xl animate-shimmer`} />
    <div className="flex gap-3">
      {!isShort && <div className="h-9 w-9 shrink-0 rounded-full animate-shimmer" />}
      <div className="flex w-full flex-col gap-2 pt-0.5">
        <div className="h-4 w-[90%] rounded animate-shimmer" />
        <div className="h-4 w-[60%] rounded animate-shimmer" />
      </div>
    </div>
  </div>
);

export default SkeletonCard;
