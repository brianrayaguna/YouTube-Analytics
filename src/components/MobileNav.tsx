import React from 'react';
import { X } from 'lucide-react';
import { AnalysisMode } from '../types';
import { NavList } from './Sidebar';
import Logo from './Logo';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from './ui/sheet';
import { QUOTA_LIMIT } from '../services/youtubeService';
import { formatNumber } from '../lib/format';
import { cn } from '@/lib/utils';

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  currentMode: AnalysisMode;
  onNavigate: (mode: AnalysisMode) => void;
  savedCount?: number;
  hasData?: boolean;
  quotaUsed?: number;
}

/** Drawer navigasi mobile berbasis dialog modal aksesibel. */
const MobileNav: React.FC<MobileNavProps> = ({
  isOpen,
  onClose,
  currentMode,
  onNavigate,
  savedCount,
  hasData,
  quotaUsed = 0,
}) => {
  const pct = Math.min((quotaUsed / QUOTA_LIMIT) * 100, 100);
  const barColor = pct >= 90 ? 'bg-destructive' : pct >= 70 ? 'bg-warning' : 'bg-primary';

  return (
    <Sheet open={isOpen} onOpenChange={open => !open && onClose()}>
      <SheetContent side="left" hideClose className="flex w-72 max-w-[85vw] flex-col p-0">
        <SheetTitle className="sr-only">Menu navigasi</SheetTitle>
        <SheetDescription className="sr-only">Pilih modul analisis, riwayat, atau unduhan video</SheetDescription>

        <div className="flex h-14 shrink-0 items-center justify-between border-b border-sidebar-border px-3">
          <Logo
            onClick={() => {
              onNavigate('dashboard');
              onClose();
            }}
          />
          <button type="button" onClick={onClose} className="yt-icon-btn" aria-label="Tutup menu">
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <NavList
            currentMode={currentMode}
            onNavigate={m => {
              onNavigate(m);
              onClose();
            }}
            savedCount={savedCount}
            hasData={hasData}
          />
        </div>

        <div className="border-t border-sidebar-border px-4 py-3">
          <div className="flex items-baseline justify-between text-xs text-muted-foreground">
            <span>Kuota API hari ini</span>
            <span className="font-medium tabular-nums text-foreground">
              {formatNumber(quotaUsed)} / {formatNumber(QUOTA_LIMIT)}
            </span>
          </div>
          <div
            role="progressbar"
            aria-label="Pemakaian kuota API harian"
            aria-valuenow={quotaUsed}
            aria-valuemin={0}
            aria-valuemax={QUOTA_LIMIT}
            className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-secondary"
          >
            <div
              className={cn('h-full w-full origin-left rounded-full transition-transform duration-300', barColor)}
              style={{ transform: `scaleX(${pct / 100})` }}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default MobileNav;
