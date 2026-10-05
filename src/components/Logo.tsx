import React from 'react';

interface LogoProps {
  compact?: boolean;
  onClick?: () => void;
}

const Logo: React.FC<LogoProps> = ({ compact, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex items-center gap-1 rounded-lg px-1 py-1.5 outline-offset-0"
    aria-label="YT Analyzer Pro — Beranda"
  >
    <svg viewBox="0 0 28 20" className="h-5 w-7 shrink-0" aria-hidden="true">
      <rect width="28" height="20" rx="5.5" fill="hsl(var(--yt-red))" />
      <path d="M11.2 5.6v8.8l7.6-4.4z" fill="#fff" />
    </svg>
    {!compact && (
      <span className="relative flex items-start text-[19px] font-bold leading-none tracking-[-0.04em] text-foreground">
        Analyzer
        <span className="ml-0.5 -mt-1 text-[10px] font-normal tracking-normal text-muted-foreground">PRO</span>
      </span>
    )}
  </button>
);

export default Logo;
