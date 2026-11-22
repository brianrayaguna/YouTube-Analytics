import React from 'react';
import { LayoutGrid } from 'lucide-react';
import { AnalysisMode } from '../types';
import { ALL_NAV_ITEMS, BOTTOM_NAV_MODES } from '../config/navigation';
import { cn } from '@/lib/utils';

interface BottomNavProps {
  currentMode: AnalysisMode;
  onNavigate: (mode: AnalysisMode) => void;
  onOpenMore: () => void;
  mobileNavOpen?: boolean;
}

/** Bar navigasi bawah untuk perangkat mobile. */
const BottomNav: React.FC<BottomNavProps> = ({ currentMode, onNavigate, onOpenMore, mobileNavOpen = false }) => {
  const items = BOTTOM_NAV_MODES.map(m => ALL_NAV_ITEMS.find(i => i.mode === m)!).filter(Boolean);
  const moreActive = !BOTTOM_NAV_MODES.includes(currentMode);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[150] border-t border-border bg-background/95 pb-safe backdrop-blur-sm md:hidden"
      aria-label="Navigasi bawah"
    >
      <div className="flex items-stretch">
        {items.map(item => {
          const active = currentMode === item.mode;
          const Icon = item.icon;
          return (
            <button
              key={item.mode}
              type="button"
              onClick={() => onNavigate(item.mode)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-12 flex-1 flex-col items-center justify-center gap-1 transition-colors active:bg-secondary',
                active ? 'text-primary' : 'text-foreground'
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} aria-hidden="true" />
              <span className={cn('text-[10px] leading-none', active ? 'font-semibold' : 'text-muted-foreground')}>
                {item.shortLabel}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={onOpenMore}
          aria-haspopup="dialog"
          aria-expanded={mobileNavOpen}
          className={cn(
            'flex min-h-12 flex-1 flex-col items-center justify-center gap-1 transition-colors active:bg-secondary',
            moreActive || mobileNavOpen ? 'text-primary' : 'text-foreground'
          )}
        >
          <LayoutGrid className="h-5 w-5" strokeWidth={moreActive || mobileNavOpen ? 2.25 : 1.75} aria-hidden="true" />
          <span className={cn('text-[10px] leading-none', moreActive || mobileNavOpen ? 'font-semibold' : 'text-muted-foreground')}>
            Lainnya
          </span>
        </button>
      </div>
    </nav>
  );
};

export default BottomNav;
