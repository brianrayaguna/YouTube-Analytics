import React, { useRef } from 'react';
import { type LucideIcon, Search, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Judul halaman konsisten di seluruh modul analitik. */
export const PageHeader: React.FC<{
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}> = ({ title, subtitle, actions, className }) => (
  <div className={cn('mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}>
    <div className="min-w-0">
      <h1 className="yt-page-title">{title}</h1>
      {subtitle && <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

/** Status kosong terpusat (ikon, judul, deskripsi, aksi). */
export const EmptyState: React.FC<{
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}> = ({ icon: Icon, title, description, action, className }) => (
  <div className={cn('mx-auto flex max-w-md flex-col items-center px-4 py-14 text-center', className)}>
    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary">
      <Icon className="h-10 w-10 text-muted-foreground" strokeWidth={1.35} aria-hidden="true" />
    </div>
    <h2 className="mt-5 text-xl font-medium text-foreground">{title}</h2>
    {description && <div className="mt-2 text-sm leading-6 text-muted-foreground">{description}</div>}
    {action && <div className="mt-6 flex flex-wrap justify-center gap-2">{action}</div>}
  </div>
);

/** Status untuk halaman analisis yang memerlukan data channel terlebih dahulu. */
export const NeedDataState: React.FC<{
  icon: LucideIcon;
  feature: string;
  onFocusSearch: () => void;
  onLoadDemo?: () => void;
}> = ({ icon, feature, onFocusSearch, onLoadDemo }) => (
  <EmptyState
    icon={icon}
    title={`${feature} memerlukan data analisis`}
    description="Lakukan analisis channel, playlist, atau kata kunci melalui kolom pencarian, atau muat data contoh untuk meninjau modul secara langsung."
    action={
      <>
        <button type="button" onClick={onFocusSearch} className="yt-pill-primary">
          <Search className="h-4 w-4" /> Mulai analisis
        </button>
        {onLoadDemo && (
          <button type="button" onClick={onLoadDemo} className="yt-pill">
            <Sparkles className="h-4 w-4" /> Muat data contoh
          </button>
        )}
      </>
    }
  />
);

/** Kartu metrik utama dengan angka tabular. */
export const StatCard: React.FC<{
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  accent?: 'default' | 'red' | 'green' | 'blue' | 'teal';
  className?: string;
}> = ({ label, value, hint, icon: Icon, accent = 'default', className }) => (
  <div className={cn('yt-card p-4 sm:p-5', className)}>
    <div className="flex items-center justify-between gap-2">
      <p className="text-sm text-muted-foreground">{label}</p>
      {Icon && <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />}
    </div>
    <p
      className={cn(
        'mt-2 text-2xl font-medium tracking-tight tabular-nums sm:text-[28px] sm:leading-9',
        accent === 'red' && 'text-destructive',
        accent === 'green' && 'text-success',
        accent === 'blue' && 'text-primary',
        accent === 'teal' && 'text-outlier',
        accent === 'default' && 'text-foreground'
      )}
    >
      {value}
    </p>
    {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
  </div>
);

/** Kartu bagian (judul + isi). */
export const SectionCard: React.FC<{
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ title, description, actions, children, className }) => (
  <section className={cn('yt-card p-4 sm:p-6', className)}>
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-base font-medium text-foreground">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </div>
    {children}
  </section>
);

/** Tab bergaris bawah selaras bilah tab YouTube dengan roving tabindex WAI-ARIA. */
export const StudioTabs = <T extends string,>({
  tabs,
  value,
  onChange,
  label = 'Bagian halaman',
  idPrefix = 'studio',
  className,
}: {
  tabs: Array<{ id: T; label: string }>;
  value: T;
  onChange: (id: T) => void;
  label?: string;
  idPrefix?: string;
  className?: string;
}) => {
  const btnRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
    let next = -1;
    if (e.key === 'ArrowRight') next = (idx + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (idx - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    if (next >= 0) {
      e.preventDefault();
      onChange(tabs[next].id);
      btnRefs.current[next]?.focus();
    }
  };

  return (
    <div
      className={cn('mb-5 flex gap-6 overflow-x-auto border-b border-border no-scrollbar', className)}
      role="tablist"
      aria-label={label}
    >
      {tabs.map((t, idx) => {
        const selected = value === t.id;
        return (
          <button
            key={t.id}
            ref={el => {
              btnRefs.current[idx] = el;
            }}
            id={`${idPrefix}-tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={e => handleKeyDown(e, idx)}
            className={cn(
              'shrink-0 border-b-2 pb-3 pt-2 text-[15px] font-medium transition-colors',
              selected
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
};
