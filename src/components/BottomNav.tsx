import React from 'react';
import { LayoutGrid } from 'lucide-react';
import { AnalysisMode } from '../types';
import { ALL_NAV_ITEMS, BOTTOM_NAV_MODES } from '../config/navigation';
import { cn } from '@/lib/utils';

interface BottomNavProps {
  currentMode: AnalysisMode;
  onNavigate: (mode: AnalysisMode) => void;
  onOpenMore: () => void;
}

/** Bottom bar ala aplikasi YouTube mobile. */
const BottomNav: React.FC<BottomNavProps> = ({ currentMode, onNavigate, onOpenMore }) => {
  const items = BOTTOM_NAV_MODES.map(m => ALL_NAV_ITEMS.find(i => i.mode === m)!).filter(Boolean);
  const moreActive = !BOTTOM_NAV_MODES.includes(currentMode);

  const renderButton = (key: string, label: string, Icon: typeof LayoutGrid, active: boolean, onClick: () => void) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className="flex h-12 flex-1 flex-col items-center justify-center gap-1 text-foreground active:bg-secondary"
    >
      <Icon className="h-6 w-6" strokeWidth={active ? 2.25 : 1.5} />
      <span className={cn('text-[10px] leading-none', active ? 'font-medium' : 'text-foreground/90')}>{label}</span>
    </button>
  );

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[150] border-t border-border bg-background pb-safe md:hidden"
      aria-label="Navigasi bawah"
    >
      <div className="flex items-stretch">
        {items.map(item =>
          renderButton(item.mode, item.shortLabel, item.icon, currentMode === item.mode, () => onNavigate(item.mode))
        )}
        {renderButton('more', 'Lainnya', LayoutGrid, moreActive, onOpenMore)}
      </div>
    </nav>
  );
};

export default BottomNav;
