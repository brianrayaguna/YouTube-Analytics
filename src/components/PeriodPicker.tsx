import React from 'react';
import { ChevronDown, CalendarRange } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PERIODS, PeriodId, PeriodRange, CustomPeriod, formatPeriodRange, toDateInput } from '../lib/period';
import { VideoItem } from '../types';

interface PeriodPickerProps {
  value: PeriodId;
  range: PeriodRange;
  custom: CustomPeriod;
  videos: VideoItem[];
  onChange: (id: PeriodId) => void;
  onCustomChange: (c: CustomPeriod) => void;
}

/** Pemilih rentang waktu ala YouTube Studio (rentang tanggal kecil + label tebal + chevron). */
const PeriodPicker: React.FC<PeriodPickerProps> = ({ value, range, custom, videos, onChange, onCustomChange }) => {
  const groups: PeriodId[][] = [
    ['1d', '3d', '7d', '14d', '28d'],
    ['1m', '3m', '6m', '1y', 'ytd'],
    ['all', 'custom'],
  ];
  const today = toDateInput(new Date());

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Periode: ${range.label}`}
            className="flex min-w-[220px] items-center justify-between gap-4 rounded-lg border border-border bg-background px-4 py-2 text-left transition-colors hover:bg-secondary"
          >
            <span className="min-w-0">
              <span className="block truncate text-xs text-muted-foreground">{formatPeriodRange(range, videos)}</span>
              <span className="block truncate text-sm font-medium text-foreground">{range.label}</span>
            </span>
            <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-[70vh] w-60 overflow-y-auto rounded-xl py-2 shadow-popover">
          <DropdownMenuRadioGroup value={value} onValueChange={v => onChange(v as PeriodId)}>
            {groups.map((ids, gi) => (
              <React.Fragment key={gi}>
                {gi > 0 && <DropdownMenuSeparator />}
                {ids.map(id => (
                  <DropdownMenuRadioItem key={id} value={id} className="h-9 rounded-none text-sm">
                    {PERIODS.find(p => p.id === id)?.label}
                  </DropdownMenuRadioItem>
                ))}
              </React.Fragment>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {value === 'custom' && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <CalendarRange className="h-4 w-4 text-muted-foreground" />
          <label className="sr-only" htmlFor="period-from">Dari tanggal</label>
          <input
            id="period-from"
            type="date"
            className="yt-input h-9 w-auto dark:[color-scheme:dark]"
            value={custom.from}
            max={custom.to || today}
            onChange={e => e.target.value && onCustomChange({ ...custom, from: e.target.value })}
          />
          <span className="text-muted-foreground">–</span>
          <label className="sr-only" htmlFor="period-to">Sampai tanggal</label>
          <input
            id="period-to"
            type="date"
            className="yt-input h-9 w-auto dark:[color-scheme:dark]"
            value={custom.to}
            min={custom.from}
            max={today}
            onChange={e => e.target.value && onCustomChange({ ...custom, to: e.target.value })}
          />
        </div>
      )}
    </div>
  );
};

export default PeriodPicker;
