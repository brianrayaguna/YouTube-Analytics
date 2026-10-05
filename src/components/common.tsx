import React from 'react';
import { type LucideIcon, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Judul halaman ala YouTube Studio. */
export const PageHeader: React.FC<{
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}> = ({ title, subtitle, actions, className }) => (
  <div className={cn('mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}>
    <div className="min-w-0">
      <h1 className="yt-page-title">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

/** Status kosong ala YouTube (ikon besar, judul, deskripsi, aksi). */
export const EmptyState: React.FC<{
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}> = ({ icon: Icon, title, description, action, className }) => (
  <div className={cn('mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center', className)}>
    <div className="flex h-24 w-24 items-center justify-center rounded-full bg-secondary">
      <Icon className="h-12 w-12 text-muted-foreground" strokeWidth={1.25} />
    </div>
    <h2 className="mt-6 text-xl font-medium text-foreground">{title}</h2>
    {description && <div className="mt-2 text-sm leading-6 text-muted-foreground">{description}</div>}
    {action && <div className="mt-6 flex flex-wrap justify-center gap-2">{action}</div>}
  </div>
);

/** Status untuk halaman analisis yang butuh data channel terlebih dahulu. */
export const NeedDataState: React.FC<{ icon: LucideIcon; feature: string; onFocusSearch: () => void }> = ({
  icon,
  feature,
  onFocusSearch,
}) => (
  <EmptyState
    icon={icon}
    title={`${feature} butuh data`}
    description="Analisis channel, playlist, atau kata kunci terlebih dahulu dari kolom pencarian di atas, lalu kembali ke halaman ini."
    action={
      <button type="button" onClick={onFocusSearch} className="yt-pill-primary">
        <Search className="h-4 w-4" /> Mulai analisis
      </button>
    }
  />
);

/** Kartu metrik ala YouTube Studio. */
export const StatCard: React.FC<{
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  accent?: 'default' | 'red' | 'green' | 'blue';
  className?: string;
}> = ({ label, value, hint, icon: Icon, accent = 'default', className }) => (
  <div className={cn('yt-card p-4 sm:p-5', className)}>
    <div className="flex items-center justify-between gap-2">
      <p className="text-sm text-muted-foreground">{label}</p>
      {Icon && <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />}
    </div>
    <p
      className={cn(
        'mt-2 text-2xl font-medium tracking-tight sm:text-[28px] sm:leading-9',
        accent === 'red' && 'text-destructive',
        accent === 'green' && 'text-success',
        accent === 'blue' && 'text-primary',
        accent === 'default' && 'text-foreground'
      )}
    >
      {value}
    </p>
    {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
  </div>
);

/** Kartu bagian (judul + isi) ala Studio. */
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

/** Tab bergaris bawah ala YouTube Studio. */
export const StudioTabs = <T extends string,>({
  tabs,
  value,
  onChange,
}: {
  tabs: Array<{ id: T; label: string }>;
  value: T;
  onChange: (id: T) => void;
}) => (
  <div className="mb-6 flex gap-6 overflow-x-auto border-b border-border no-scrollbar" role="tablist">
    {tabs.map(t => (
      <button
        key={t.id}
        type="button"
        role="tab"
        aria-selected={value === t.id}
        onClick={() => onChange(t.id)}
        className={cn(
          'relative shrink-0 pb-3 pt-1 text-sm font-medium uppercase tracking-wide transition-colors',
          value === t.id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
        )}
      >
        {t.label}
        {value === t.id && <span className="absolute inset-x-0 bottom-0 h-[3px] rounded-t bg-foreground" />}
      </button>
    ))}
  </div>
);
