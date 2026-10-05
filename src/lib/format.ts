// Helper format angka & waktu ala YouTube (bahasa Indonesia)

export const formatNumber = (value: string | number | undefined | null): string => {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0';
  const abs = Math.abs(num);
  const trim = (n: number) => n.toFixed(n < 10 ? 1 : 0).replace(/\.0$/, '');
  if (abs >= 1e9) return `${trim(num / 1e9)}B`;
  if (abs >= 1e6) return `${trim(num / 1e6)}M`;
  if (abs >= 1e3) return `${trim(num / 1e3)}K`;
  return num.toLocaleString('id-ID');
};

export const formatFullNumber = (value: number | undefined | null): string =>
  Number.isFinite(Number(value)) ? Number(value).toLocaleString('id-ID') : '0';

export const formatDuration = (seconds: number): string => {
  const s = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

export const timeAgo = (dateInput: string | number | Date): string => {
  const date = new Date(dateInput);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (!Number.isFinite(seconds)) return '';
  if (seconds < 60) return 'Baru saja';
  const units: Array<[number, string]> = [
    [31536000, 'tahun'],
    [2592000, 'bulan'],
    [604800, 'minggu'],
    [86400, 'hari'],
    [3600, 'jam'],
    [60, 'menit'],
  ];
  for (const [size, label] of units) {
    const value = Math.floor(seconds / size);
    if (value >= 1) return `${value} ${label} yang lalu`;
  }
  return 'Baru saja';
};

export const formatDate = (dateInput: string | number | Date): string =>
  new Date(dateInput).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

export const median = (values: number[]): number => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export const safeFileName = (name: string, max = 100): string =>
  name.replace(/[\\/:*?"<>|\n\r\t]/g, '_').substring(0, max).trim() || 'file';
