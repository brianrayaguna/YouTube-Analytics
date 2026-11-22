import React from 'react';
import { X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Slider } from './ui/slider';
import { ContentTypeFilter, DurationRange, DateRangeFilter, SortOption } from '../types';
import {
  VideoFilters,
  DEFAULT_FILTERS,
  SORT_LABELS,
  DURATION_LABELS,
  DATE_LABELS,
  countActiveFilters,
} from '../lib/filters';
import { formatNumber } from '../lib/format';
import { cn } from '@/lib/utils';

interface FilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: VideoFilters;
  onChange: (next: VideoFilters) => void;
}

const VIEW_PRESETS = [0, 1000, 10000, 100000, 1000000, 10000000];
const LIKE_PRESETS = [0, 100, 1000, 10000, 100000];

/** Kolom pilihan filter dengan state aktif yang jelas. */
function Column<T extends string | number>({
  title,
  options,
  value,
  onSelect,
  labelOf,
  defaultValue,
}: {
  title: string;
  options: readonly T[];
  value: T;
  onSelect: (v: T) => void;
  labelOf: (v: T) => string;
  defaultValue: T;
}) {
  return (
    <div>
      <h3 className="border-b border-border pb-2.5 text-xs font-semibold uppercase tracking-wider text-foreground">{title}</h3>
      <ul className="mt-2 space-y-0.5">
        {options.map(opt => {
          const active = opt === value;
          return (
            <li key={String(opt)}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(active && opt !== defaultValue ? defaultValue : opt)}
                className={cn(
                  'flex min-h-10 w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors sm:min-h-8',
                  active ? 'bg-secondary font-medium text-foreground' : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                )}
              >
                <span>{labelOf(opt)}</span>
                {active && opt !== defaultValue && <X className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const FilterDialog: React.FC<FilterDialogProps> = ({ open, onOpenChange, filters, onChange }) => {
  const set = <K extends keyof VideoFilters>(key: K, value: VideoFilters[K]) => onChange({ ...filters, [key]: value });
  const active = countActiveFilters(filters);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto rounded-xl border border-border bg-popover p-0 sm:max-w-[880px] sm:rounded-xl">
        <DialogHeader className="px-6 pb-2 pt-6 text-left">
          <DialogTitle className="text-xl font-semibold">Filter hasil</DialogTitle>
          <DialogDescription>Filter diterapkan langsung pada video yang sudah dimuat tanpa memakai kuota API.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-x-8 gap-y-6 px-6 py-4 sm:grid-cols-2 md:grid-cols-4">
          <Column<DateRangeFilter>
            title="Tanggal upload"
            options={['all', '7d', '30d', '90d', '1y']}
            value={filters.dateRange}
            onSelect={v => set('dateRange', v)}
            labelOf={v => DATE_LABELS[v]}
            defaultValue="all"
          />
          <Column<ContentTypeFilter>
            title="Jenis"
            options={['all', 'long', 'shorts']}
            value={filters.contentType}
            onSelect={v => set('contentType', v)}
            labelOf={v => ({ all: 'Semua', long: 'Video (> 3 menit)', shorts: 'Shorts (≤ 3 menit)' })[v]}
            defaultValue="all"
          />
          <Column<DurationRange>
            title="Durasi"
            options={['all', 'under_1', '1_5', '5_20', 'over_20']}
            value={filters.duration}
            onSelect={v => set('duration', v)}
            labelOf={v => DURATION_LABELS[v]}
            defaultValue="all"
          />
          <Column<SortOption>
            title="Urutkan menurut"
            options={['popular', 'newest', 'oldest', 'most_liked', 'most_commented', 'highest_er']}
            value={filters.sort}
            onSelect={v => set('sort', v)}
            labelOf={v => SORT_LABELS[v]}
            defaultValue="popular"
          />
          <Column<number>
            title="Minimal views"
            options={VIEW_PRESETS}
            value={filters.minViews}
            onSelect={v => set('minViews', v)}
            labelOf={v => (v === 0 ? 'Semua' : `${formatNumber(v)}+ views`)}
            defaultValue={0}
          />
          <Column<number>
            title="Minimal likes"
            options={LIKE_PRESETS}
            value={filters.minLikes}
            onSelect={v => set('minLikes', v)}
            labelOf={v => (v === 0 ? 'Semua' : `${formatNumber(v)}+ likes`)}
            defaultValue={0}
          />

          <div className="space-y-5 sm:col-span-2">
            <div>
              <h3 className="border-b border-border pb-2.5 text-xs font-semibold uppercase tracking-wider text-foreground">Lainnya</h3>
              <label className="mt-3 block text-sm text-muted-foreground" htmlFor="filter-keyword">
                Kata di judul / tag
              </label>
              <input
                id="filter-keyword"
                value={filters.keyword}
                onChange={e => set('keyword', e.target.value)}
                placeholder="mis. tutorial"
                className="yt-input mt-1.5"
              />
            </div>
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Minimal engagement rate</span>
                <span className="font-medium tabular-nums text-foreground">{filters.minER}%</span>
              </div>
              <Slider
                className="mt-3"
                value={[filters.minER]}
                onValueChange={v => set('minER', v[0])}
                max={20}
                step={0.5}
                thumbLabel="Minimal engagement rate"
              />
            </div>
            <label className="flex min-h-10 cursor-pointer items-center gap-3 text-sm text-foreground">
              <input
                type="checkbox"
                checked={filters.outliersOnly}
                onChange={e => set('outliersOnly', e.target.checked)}
                className="h-4 w-4 accent-[hsl(var(--primary))]"
              />
              Hanya video outlier (views ≥ 3× median)
            </label>
          </div>
        </div>

        <div className="sticky bottom-0 mt-2 flex items-center justify-between gap-2 border-t border-border bg-popover px-4 py-3">
          <button
            type="button"
            onClick={() => onChange({ ...DEFAULT_FILTERS, contentType: filters.contentType, sort: filters.sort })}
            disabled={active === 0}
            className="min-h-11 rounded-full px-4 text-sm font-medium text-primary hover:bg-primary/10 disabled:opacity-40 sm:min-h-9"
          >
            Reset filter{active > 0 ? ` (${active})` : ''}
          </button>
          <button type="button" onClick={() => onOpenChange(false)} className="yt-pill-blue">
            Selesai
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FilterDialog;
