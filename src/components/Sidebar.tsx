import React from 'react';
import { AnalysisMode } from '../types';
import { NAV_SECTIONS, MINI_NAV_MODES, ALL_NAV_ITEMS, NavItem } from '../config/navigation';
import { cn } from '@/lib/utils';

interface NavListProps {
  currentMode: AnalysisMode;
  onNavigate: (mode: AnalysisMode) => void;
  savedCount?: number;
  hasData?: boolean;
}

const NavRow: React.FC<{ item: NavItem; active: boolean; onClick: () => void; badge?: React.ReactNode }> = ({
  item,
  active,
  onClick,
  badge,
}) => {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex h-10 w-full items-center gap-6 rounded-lg px-3 text-left text-sm transition-colors',
        active ? 'bg-secondary font-medium text-foreground hover:bg-accent' : 'text-foreground hover:bg-secondary'
      )}
    >
      <Icon className="h-6 w-6 shrink-0" strokeWidth={active ? 2.25 : 1.75} />
      <span className="flex-1 truncate">{item.label}</span>
      {badge}
    </button>
  );
};

/** Daftar navigasi lengkap — dipakai sidebar desktop & drawer mobile. */
export const NavList: React.FC<NavListProps> = ({ currentMode, onNavigate, savedCount = 0, hasData }) => (
  <nav className="flex flex-col pb-4" aria-label="Navigasi utama">
    {NAV_SECTIONS.map((section, idx) => (
      <div key={section.title ?? idx} className={cn('px-3 py-3', idx > 0 && 'border-t border-border')}>
        {section.title && (
          <h3 className="px-3 pb-1 pt-1 text-base font-bold text-foreground">{section.title}</h3>
        )}
        {section.items.map(item => (
          <NavRow
            key={item.mode}
            item={item}
            active={currentMode === item.mode}
            onClick={() => onNavigate(item.mode)}
            badge={
              item.mode === 'saved' && savedCount > 0 ? (
                <span className="text-xs text-muted-foreground">{savedCount}</span>
              ) : item.needsData && !hasData ? (
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" title="Perlu analisis channel dulu" />
              ) : null
            }
          />
        ))}
      </div>
    ))}
    <div className="border-t border-border px-6 pt-4 text-xs leading-5 text-muted-foreground">
      <p>Data dari YouTube Data API v3.</p>
      <p>Kuota direset setiap tengah malam (waktu Pasifik).</p>
      <p className="mt-3 text-[11px]">© {new Date().getFullYear()} YT Analyzer Pro</p>
    </div>
  </nav>
);

interface SidebarProps extends NavListProps {
  expanded: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ expanded, currentMode, onNavigate, savedCount, hasData }) => {
  if (expanded) {
    return (
      <aside className="fixed bottom-0 left-0 top-14 z-40 hidden w-60 overflow-y-auto bg-background md:block">
        <NavList currentMode={currentMode} onNavigate={onNavigate} savedCount={savedCount} hasData={hasData} />
      </aside>
    );
  }

  const miniItems = MINI_NAV_MODES.map(m => ALL_NAV_ITEMS.find(i => i.mode === m)!).filter(Boolean);
  return (
    <aside className="fixed bottom-0 left-0 top-14 z-40 hidden w-[72px] overflow-y-auto bg-background px-1 pt-1 no-scrollbar md:block">
      {miniItems.map(item => {
        const Icon = item.icon;
        const active = currentMode === item.mode;
        return (
          <button
            key={item.mode}
            type="button"
            onClick={() => onNavigate(item.mode)}
            aria-current={active ? 'page' : undefined}
            title={item.label}
            className={cn(
              'flex w-full flex-col items-center gap-1.5 rounded-lg px-0 pb-3.5 pt-4 transition-colors hover:bg-secondary',
              active && 'bg-secondary/60'
            )}
          >
            <Icon className="h-6 w-6" strokeWidth={active ? 2.25 : 1.75} />
            <span className={cn('max-w-full truncate px-1 text-[10px] leading-none', active && 'font-medium')}>
              {item.shortLabel}
            </span>
          </button>
        );
      })}
    </aside>
  );
};

export default Sidebar;
