import {
  Home,
  Flame,
  BarChart3,
  Swords,
  Lightbulb,
  CalendarClock,
  Gauge,
  Download,
  Bookmark,
  History,
  type LucideIcon,
} from 'lucide-react';
import { AnalysisMode } from '../types';

export interface NavItem {
  mode: AnalysisMode;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  /** Halaman membutuhkan hasil analisis channel/pencarian */
  needsData?: boolean;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { mode: 'dashboard', label: 'Beranda', shortLabel: 'Beranda', icon: Home },
      { mode: 'trending', label: 'Trending', shortLabel: 'Trending', icon: Flame },
    ],
  },
  {
    title: 'Analisis',
    items: [
      { mode: 'insights', label: 'Statistik Channel', shortLabel: 'Statistik', icon: BarChart3, needsData: true },
      { mode: 'title_score', label: 'Skor Konten', shortLabel: 'Skor', icon: Gauge, needsData: true },
      { mode: 'schedule', label: 'Jadwal Upload', shortLabel: 'Jadwal', icon: CalendarClock, needsData: true },
      { mode: 'content_gap', label: 'Content Gap', shortLabel: 'Gap', icon: Lightbulb, needsData: true },
      { mode: 'benchmark', label: 'Benchmark Kompetitor', shortLabel: 'Benchmark', icon: Swords },
    ],
  },
  {
    title: 'Alat',
    items: [{ mode: 'downloader', label: 'Video Downloader', shortLabel: 'Unduh', icon: Download }],
  },
  {
    title: 'Koleksi',
    items: [
      { mode: 'saved', label: 'Tersimpan', shortLabel: 'Tersimpan', icon: Bookmark },
      { mode: 'history', label: 'Riwayat Pencarian', shortLabel: 'Riwayat', icon: History },
    ],
  },
];

export const ALL_NAV_ITEMS = NAV_SECTIONS.flatMap(s => s.items);

export const getNavItem = (mode: AnalysisMode) => ALL_NAV_ITEMS.find(i => i.mode === mode);

/** Item di sidebar mini (desktop sempit) */
export const MINI_NAV_MODES: AnalysisMode[] = ['dashboard', 'trending', 'insights', 'title_score', 'saved', 'downloader'];

/** Item di bottom navigation mobile (sisanya lewat tombol "Lainnya") */
export const BOTTOM_NAV_MODES: AnalysisMode[] = ['dashboard', 'trending', 'insights', 'saved'];
