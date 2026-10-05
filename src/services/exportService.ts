import { VideoItem } from '../types';
import { calculateAllVideoScores } from './performanceScoreService';
import { safeFileName } from '../lib/format';

/** Unduh Blob — pakai FileSaver bila tersedia, fallback ke <a download>. */
export const downloadBlob = (blob: Blob, filename: string) => {
  if (window.saveAs) {
    window.saveAs(blob, filename);
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const csvCell = (value: string | number | boolean | undefined | null): string => {
  const str = value === undefined || value === null ? '' : String(value);
  return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

const toCSV = (headers: string[], rows: Array<Array<string | number | boolean | undefined>>): Blob => {
  const content = [headers, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n');
  // BOM agar Excel membaca UTF-8 (judul berbahasa Indonesia/emoji) dengan benar
  return new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8;' });
};

const isoDate = (v: VideoItem) => {
  const d = new Date(v.publishedAt);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
};

export const generateCSV = (videos: VideoItem[], filename: string) => {
  const headers = ['No', 'Title', 'Video ID', 'URL', 'Duration', 'Published Date', 'Views', 'Likes', 'Comments', 'Engagement Rate (%)', 'Tags', 'Type'];
  const rows = videos.map((v, i) => [
    i + 1,
    v.title,
    v.id,
    `https://www.youtube.com/watch?v=${v.id}`,
    v.durationFormatted,
    isoDate(v),
    v.viewCountRaw,
    v.likeCountRaw,
    v.commentCountRaw,
    v.engagementRate.toFixed(2),
    v.tags.join(', '),
    v.isShort ? 'Shorts' : 'Video',
  ]);
  downloadBlob(toCSV(headers, rows), `${safeFileName(filename)}_Report.csv`);
};

// CSV lengkap termasuk skor judul & thumbnail
export const generateFullAnalysisCSV = (videos: VideoItem[], filename: string) => {
  const scored = calculateAllVideoScores(videos);
  const headers = [
    'No', 'Title', 'Video ID', 'Video URL', 'Thumbnail URL', 'Channel Name', 'Channel ID',
    'Duration (Formatted)', 'Duration (Seconds)', 'Published Date', 'Published Time Ago',
    'Views', 'Likes', 'Comments', 'Engagement Rate %',
    'Title Score', 'Title Grade', 'Thumbnail Score', 'Thumbnail Grade',
    'Tags', 'Is Short', 'Is Outlier',
  ];
  const rows = scored.map((v, i) => [
    i + 1,
    v.title,
    v.id,
    `https://www.youtube.com/watch?v=${v.id}`,
    v.thumbnail,
    v.channelTitle,
    v.channelId,
    v.durationFormatted,
    v.durationSec,
    isoDate(v),
    v.publishedTimeAgo,
    v.viewCountRaw,
    v.likeCountRaw,
    v.commentCountRaw,
    v.engagementRate.toFixed(2),
    v.titleScore.totalScore,
    v.titleScore.grade,
    v.thumbnailScore.totalScore,
    v.thumbnailScore.grade,
    v.tags.join(', '),
    v.isShort ? 'Yes' : 'No',
    v.isOutlier ? 'Yes' : 'No',
  ]);
  downloadBlob(toCSV(headers, rows), `${safeFileName(filename)}_Full_Analysis.csv`);
};

const XLSX_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
let xlsxLoading: Promise<void> | null = null;

/** Muat SheetJS dari CDN hanya ketika ekspor Excel dipakai (±900 KB). */
const loadXlsx = (): Promise<void> => {
  if (window.XLSX) return Promise.resolve();
  if (!xlsxLoading) {
    xlsxLoading = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = XLSX_SRC;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        script.remove();
        xlsxLoading = null;
        reject(new Error('Gagal memuat library Excel. Periksa koneksi internet, atau gunakan ekspor CSV.'));
      };
      document.head.appendChild(script);
    });
  }
  return xlsxLoading;
};

export const exportToExcel = async (videos: VideoItem[], filename: string) => {
  await loadXlsx();
  const XLSX = window.XLSX;

  const scored = calculateAllVideoScores(videos);
  const data = scored.map((v, idx) => ({
    No: idx + 1,
    Title: v.title,
    URL: `https://www.youtube.com/watch?v=${v.id}`,
    Thumbnail: v.thumbnail,
    Views: v.viewCountRaw,
    Likes: v.likeCountRaw,
    Comments: v.commentCountRaw,
    'Engagement Rate %': v.engagementRate,
    'Title Score': v.titleScore.totalScore,
    'Title Grade': v.titleScore.grade,
    'Thumbnail Score': v.thumbnailScore.totalScore,
    'Thumbnail Grade': v.thumbnailScore.grade,
    Duration: v.durationFormatted,
    Published: isoDate(v),
    Type: v.isShort ? 'Shorts' : 'Long',
    Outlier: v.isOutlier ? 'Yes' : 'No',
    Channel: v.channelTitle,
    Tags: v.tags.join(', '),
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  worksheet['!cols'] = [{ wch: 5 }, { wch: 60 }, { wch: 44 }, { wch: 20 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Analysis');
  XLSX.writeFile(workbook, `${safeFileName(filename)}_Analysis.xlsx`);
};

export const copyToClipboard = async (text: string): Promise<void> => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  // Fallback untuk konteks non-HTTPS / browser lama
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(textarea);
  if (!ok) throw new Error('Clipboard tidak tersedia');
};

/** Unduh satu thumbnail (fallback buka di tab baru bila CORS/fetch gagal). */
export const downloadThumbnail = async (video: VideoItem, prefix = ''): Promise<void> => {
  const res = await fetch(video.thumbnail);
  if (!res.ok) throw new Error('Gagal mengambil thumbnail');
  const blob = await res.blob();
  downloadBlob(blob, `${prefix}${safeFileName(video.title)}.jpg`);
};
