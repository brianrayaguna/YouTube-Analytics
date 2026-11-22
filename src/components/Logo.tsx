import React from 'react';

interface LogoProps {
  compact?: boolean;
  onClick?: () => void;
}

const Logo: React.FC<LogoProps> = ({ compact, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex min-h-11 items-center gap-2 rounded-lg px-1.5 py-1.5 outline-offset-0 sm:min-h-9"
    aria-label="YT Analyzer Pro — Beranda"
  >
    <svg viewBox="0 0 32 32" className="h-7 w-7 shrink-0" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#0F172A" className="dark:fill-[#1A2233]" />
      <rect x="6.5" y="18" width="4.5" height="7.5" rx="1.6" fill="#3DA5FF" />
      <rect x="13.75" y="12.5" width="4.5" height="13" rx="1.6" fill="#2DD4BF" />
      <rect x="21" y="6.5" width="4.5" height="19" rx="1.6" fill="#FF3B30" />
    </svg>
    {!compact && (
      <span className="relative flex items-start text-[18px] font-bold leading-none tracking-[-0.03em] text-foreground">
        YT Analyzer
        <span className="ml-1 -mt-0.5 text-[10px] font-semibold tracking-normal text-muted-foreground">PRO</span>
      </span>
    )}
  </button>
);

export default Logo;
