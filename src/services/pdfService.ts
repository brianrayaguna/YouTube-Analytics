// PDF Report Generator Service - Comprehensive reports with ALL data & thumbnails
// NOTE: jsPDF does not support Unicode emojis, so we use plain text labels instead

import jsPDF from 'jspdf';
import { VideoItem, ChannelStats } from '../types';
import { formatNumber } from './youtubeService';
import { calculateAllVideoScores, getAverageScores, VideoWithScores } from './performanceScoreService';

interface ReportData {
  channelTitle: string;
  channelStats?: ChannelStats;
  channelAvatar?: string;
  videos: VideoItem[];
  generatedAt: Date;
}

// Format date to specific format like "Jan 15, 2025"
const formatSpecificDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

// Fetch thumbnail as base64 for PDF embedding with timeout
const fetchThumbnailAsBase64 = async (url: string, timeout = 5000): Promise<string | null> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn('Failed to fetch thumbnail:', url);
    return null;
  }
};

// Batch fetch thumbnails for better performance
const fetchThumbnailsBatch = async (videos: VideoItem[], batchSize = 5): Promise<Map<string, string>> => {
  const thumbnailMap = new Map<string, string>();
  
  for (let i = 0; i < videos.length; i += batchSize) {
    const batch = videos.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (video) => {
        const base64 = await fetchThumbnailAsBase64(video.thumbnail);
        return { id: video.id, base64 };
      })
    );
    
    results.forEach(({ id, base64 }) => {
      if (base64) {
        thumbnailMap.set(id, base64);
      }
    });
    
    console.log(`Fetched thumbnails: ${Math.min(i + batchSize, videos.length)}/${videos.length}`);
  }
  
  return thumbnailMap;
};

const addHeader = (doc: jsPDF, title: string, pageNum: number, totalPages?: number) => {
  doc.setFillColor(239, 68, 68); // Red accent
  doc.rect(0, 0, 210, 20, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('YT ANALYZER PRO', 15, 13);
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(title, 195, 13, { align: 'right' });
  
  // Page number at bottom
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  const pageText = totalPages ? `Page ${pageNum} of ${totalPages}` : `Page ${pageNum}`;
  doc.text(pageText, 195, 290, { align: 'right' });
};

const addSection = (doc: jsPDF, title: string, y: number): number => {
  doc.setFillColor(245, 245, 245);
  doc.rect(15, y, 180, 8, 'F');
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(title.toUpperCase(), 20, y + 5.5);
  return y + 12;
};

const getGradeColor = (grade: string): [number, number, number] => {
  switch (grade) {
    case 'A': return [16, 185, 129]; // emerald
    case 'B': return [59, 130, 246]; // blue
    case 'C': return [234, 179, 8]; // yellow
    case 'D': return [249, 115, 22]; // orange
    default: return [239, 68, 68]; // red
  }
};

// Sama dengan ambang nilai di performanceScoreService agar PDF konsisten dengan UI
const getGrade = (score: number): string => {
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  if (score >= 20) return 'D';
  return 'F';
};

export const generatePDFReport = async (data: ReportData): Promise<void> => {
  console.log('Starting PDF generation...', { 
    videosCount: data.videos?.length || 0,
    hasChannelStats: !!data.channelStats 
  });
  
  // Validate input data
  if (!data.videos || data.videos.length === 0) {
    throw new Error('No videos to generate report');
  }
  
  const doc = new jsPDF('p', 'mm', 'a4');
  let currentY = 30;
  let currentPage = 1;

  // Limit videos for PDF (max 100 for file size)
  const maxVideos = Math.min(data.videos.length, 100);
  const videosForPDF = data.videos.slice(0, maxVideos);

  // Calculate scores for all videos
  let scoredVideos;
  let avgTitleScore = 50;
  let avgThumbnailScore = 50;
  
  try {
    scoredVideos = calculateAllVideoScores(videosForPDF);
    const scores = getAverageScores(videosForPDF);
    avgTitleScore = scores.avgTitleScore;
    avgThumbnailScore = scores.avgThumbnailScore;
  } catch (e) {
    console.warn('Error calculating scores, using defaults:', e);
    scoredVideos = videosForPDF.map(v => ({
      ...v,
      titleScore: { totalScore: 50, grade: 'C' as const, breakdown: {} },
      thumbnailScore: { totalScore: 50, grade: 'C' as const, breakdown: {} }
    }));
  }

  // Fetch ALL thumbnails (batched)
  console.log('Fetching thumbnails...');
  let thumbnailMap = new Map<string, string>();
  try {
    thumbnailMap = await fetchThumbnailsBatch(videosForPDF, 5);
    console.log(`Fetched ${thumbnailMap.size} thumbnails successfully`);
  } catch (e) {
    console.warn('Error fetching thumbnails:', e);
  }

  // Fetch channel avatar if available
  let avatarBase64: string | null = null;
  try {
    if (data.channelStats?.avatar) {
      avatarBase64 = await fetchThumbnailAsBase64(data.channelStats.avatar, 5000);
    }
  } catch (e) {
    console.warn('Error fetching avatar:', e);
  }

  // Calculate statistics
  const totalViews = data.videos.reduce((sum, v) => sum + v.viewCountRaw, 0);
  const totalLikes = data.videos.reduce((sum, v) => sum + v.likeCountRaw, 0);
  const totalComments = data.videos.reduce((sum, v) => sum + (v.commentCountRaw || 0), 0);
  const avgER = data.videos.length > 0 
    ? (data.videos.reduce((sum, v) => sum + v.engagementRate, 0) / data.videos.length)
    : 0;
  const shortsCount = data.videos.filter(v => v.isShort).length;
  const longCount = data.videos.length - shortsCount;
  const outliersCount = data.videos.filter(v => v.isOutlier).length;

  // ER Distribution
  const erDistribution = {
    low: data.videos.filter(v => v.engagementRate < 2).length,
    medium: data.videos.filter(v => v.engagementRate >= 2 && v.engagementRate < 5).length,
    good: data.videos.filter(v => v.engagementRate >= 5 && v.engagementRate < 10).length,
    excellent: data.videos.filter(v => v.engagementRate >= 10).length,
  };

  // Top tags
  const tagCounts = new Map<string, number>();
  data.videos.forEach(v => {
    v.tags.forEach(tag => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
  });
  const topTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  // Estimate total pages
  const videosPerPage = 5;
  const videoCatalogPages = Math.ceil(videosForPDF.length / videosPerPage);
  const totalPages = 2 + videoCatalogPages; // Cover + Summary + Video pages

  // ========== PAGE 1: COVER (AESTHETIC) ==========
  addHeader(doc, 'Channel Analysis Report', currentPage, totalPages);
  
  // Gradient-like background effect
  doc.setFillColor(250, 250, 252);
  doc.rect(0, 20, 210, 277, 'F');
  
  // Decorative accent bar
  doc.setFillColor(239, 68, 68);
  doc.rect(15, 35, 4, 60, 'F');
  
  // Channel avatar (circular effect)
  if (avatarBase64) {
    try {
      // Draw avatar
      doc.addImage(avatarBase64, 'JPEG', 25, 40, 35, 35);
      // Add border effect
      doc.setDrawColor(239, 68, 68);
      doc.setLineWidth(1);
      doc.circle(42.5, 57.5, 18, 'S');
    } catch (e) {
      // Fallback circle
      doc.setFillColor(239, 68, 68);
      doc.circle(42.5, 57.5, 17.5, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      const initials = (data.channelTitle || 'YT').substring(0, 2).toUpperCase();
      doc.text(initials, 42.5, 62, { align: 'center' });
    }
  } else {
    // Fallback circle with initials
    doc.setFillColor(239, 68, 68);
    doc.circle(42.5, 57.5, 17.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    const initials = (data.channelTitle || 'YT').substring(0, 2).toUpperCase();
    doc.text(initials, 42.5, 62, { align: 'center' });
  }
  
  // Channel name next to avatar
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  const channelName = data.channelTitle || 'Channel Analysis';
  doc.text(channelName.length > 25 ? channelName.substring(0, 25) + '...' : channelName, 70, 55);
  
  // YouTube Channel label
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'normal');
  doc.text('YouTube Channel Analytics', 70, 65);

  // Channel stats boxes - improved layout
  currentY = 90;
  if (data.channelStats) {
    const boxWidth = 55;
    const stats = [
      { label: 'SUBSCRIBERS', value: data.channelStats.subscriberCount },
      { label: 'TOTAL VIEWS', value: data.channelStats.viewCount },
      { label: 'VIDEOS', value: data.channelStats.videoCount },
    ];

    stats.forEach((stat, i) => {
      const x = 15 + (i * (boxWidth + 5));
      
      // Shadow effect
      doc.setFillColor(230, 230, 230);
      doc.roundedRect(x + 1, currentY + 1, boxWidth, 40, 4, 4, 'F');
      
      // White box
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(x, currentY, boxWidth, 40, 4, 4, 'F');
      doc.setDrawColor(240, 240, 240);
      doc.roundedRect(x, currentY, boxWidth, 40, 4, 4, 'S');
      
      // Red accent line
      doc.setFillColor(239, 68, 68);
      doc.rect(x, currentY, 4, 40, 'F');
      
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(stat.label, x + boxWidth/2 + 2, currentY + 12, { align: 'center' });
      
      doc.setFontSize(18);
      doc.setTextColor(30, 30, 30);
      doc.setFont('helvetica', 'bold');
      doc.text(stat.value, x + boxWidth/2 + 2, currentY + 28, { align: 'center' });
    });
    currentY += 55;
  }

  // Report metadata box
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(30, currentY, 150, 50, 4, 4, 'F');
  doc.setDrawColor(230, 230, 230);
  doc.roundedRect(30, currentY, 150, 50, 4, 4, 'S');
  
  doc.setFontSize(11);
  doc.setTextColor(60, 60, 60);
  doc.setFont('helvetica', 'bold');
  doc.text('REPORT DETAILS', 105, currentY + 12, { align: 'center' });
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  doc.text(`Videos Analyzed: ${data.videos.length}`, 105, currentY + 25, { align: 'center' });
  doc.text(`Analysis Period: Last ${data.videos.length} videos`, 105, currentY + 35, { align: 'center' });
  doc.text(`Generated: ${data.generatedAt.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })}`, 105, currentY + 45, { align: 'center' });

  // Report ID at bottom
  const reportId = `RPT-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${String(new Date().getHours()).padStart(2, '0')}${String(new Date().getMinutes()).padStart(2, '0')}`;
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Report ID: ${reportId}`, 105, 280, { align: 'center' });
  doc.text('Generated by YT Analyzer Pro', 105, 286, { align: 'center' });

  // ========== PAGE 2: EXECUTIVE SUMMARY ==========
  doc.addPage();
  currentPage++;
  addHeader(doc, 'Executive Summary', currentPage, totalPages);
  currentY = 30;

  // Analysis Overview Section - Card style
  currentY = addSection(doc, 'Analysis Overview', currentY);
  
  // Create a nice grid of stats
  const overviewStats = [
    { label: 'Videos Analyzed', value: data.videos.length.toString(), icon: '#' },
    { label: 'Total Views', value: formatNumber(totalViews), icon: 'V' },
    { label: 'Total Likes', value: formatNumber(totalLikes), icon: 'L' },
    { label: 'Total Comments', value: formatNumber(totalComments), icon: 'C' },
    { label: 'Average ER', value: `${avgER.toFixed(2)}%`, icon: '%' },
    { label: 'Outlier Videos', value: outliersCount.toString(), icon: '!' },
  ];

  doc.setFont('helvetica', 'normal');
  overviewStats.forEach((stat, i) => {
    const row = Math.floor(i / 3);
    const col = i % 3;
    const boxX = 15 + (col * 62);
    const boxY = currentY + (row * 28);
    
    // Card background
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(boxX, boxY, 58, 24, 3, 3, 'F');
    doc.setDrawColor(235, 235, 235);
    doc.roundedRect(boxX, boxY, 58, 24, 3, 3, 'S');
    
    // Icon circle
    doc.setFillColor(239, 68, 68);
    doc.circle(boxX + 10, boxY + 12, 6, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(stat.icon, boxX + 10, boxY + 14, { align: 'center' });
    
    // Label and value
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    doc.text(stat.label, boxX + 20, boxY + 9);
    
    doc.setFontSize(12);
    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'bold');
    doc.text(stat.value, boxX + 20, boxY + 18);
    doc.setFont('helvetica', 'normal');
  });
  currentY += 65;

  // Content Breakdown Section - Enhanced
  currentY = addSection(doc, 'Content Breakdown', currentY);
  
  const longPercent = data.videos.length > 0 ? (longCount / data.videos.length * 100).toFixed(0) : '0';
  const shortsPercent = data.videos.length > 0 ? (shortsCount / data.videos.length * 100).toFixed(0) : '0';
  
  // Long videos bar with improved styling
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(15, currentY, 180, 30, 3, 3, 'F');
  doc.setDrawColor(235, 235, 235);
  doc.roundedRect(15, currentY, 180, 30, 3, 3, 'S');
  
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.setFont('helvetica', 'bold');
  doc.text(`Long Videos`, 20, currentY + 9);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`${longCount} videos (${longPercent}%)`, 20, currentY + 16);
  
  doc.setFillColor(59, 130, 246);
  const longBarWidth = Math.max((longCount / Math.max(data.videos.length, 1)) * 80, 2);
  doc.roundedRect(100, currentY + 8, longBarWidth, 10, 2, 2, 'F');
  
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.setFont('helvetica', 'bold');
  doc.text(`Shorts`, 20, currentY + 25);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`${shortsCount} videos (${shortsPercent}%)`, 50, currentY + 25);
  
  doc.setFillColor(168, 85, 247);
  const shortsBarWidth = Math.max((shortsCount / Math.max(data.videos.length, 1)) * 80, 2);
  doc.roundedRect(100, currentY + 20, shortsBarWidth, 5, 2, 2, 'F');
  
  currentY += 38;

  // Performance Scores Section - Enhanced
  currentY = addSection(doc, 'Performance Scores', currentY);
  
  const titleGrade = getGrade(avgTitleScore);
  const thumbGrade = getGrade(avgThumbnailScore);
  
  // Title Score card
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(15, currentY, 85, 35, 4, 4, 'F');
  doc.setDrawColor(235, 235, 235);
  doc.roundedRect(15, currentY, 85, 35, 4, 4, 'S');
  
  // Colored accent
  const [tr, tg, tb] = getGradeColor(titleGrade);
  doc.setFillColor(tr, tg, tb);
  doc.roundedRect(15, currentY, 4, 35, 2, 0, 'F');
  
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('AVG TITLE SCORE', 60, currentY + 10, { align: 'center' });
  doc.setFontSize(18);
  doc.setTextColor(tr, tg, tb);
  doc.setFont('helvetica', 'bold');
  doc.text(`${avgTitleScore}/100`, 60, currentY + 24, { align: 'center' });
  doc.setFontSize(12);
  doc.text(`Grade: ${titleGrade}`, 60, currentY + 32, { align: 'center' });
  
  // Thumbnail Score card
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(110, currentY, 85, 35, 4, 4, 'F');
  doc.setDrawColor(235, 235, 235);
  doc.roundedRect(110, currentY, 85, 35, 4, 4, 'S');
  
  const [thr, thg, thb] = getGradeColor(thumbGrade);
  doc.setFillColor(thr, thg, thb);
  doc.roundedRect(110, currentY, 4, 35, 2, 0, 'F');
  
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('AVG THUMBNAIL SCORE', 155, currentY + 10, { align: 'center' });
  doc.setFontSize(18);
  doc.setTextColor(thr, thg, thb);
  doc.setFont('helvetica', 'bold');
  doc.text(`${avgThumbnailScore}/100`, 155, currentY + 24, { align: 'center' });
  doc.setFontSize(12);
  doc.text(`Grade: ${thumbGrade}`, 155, currentY + 32, { align: 'center' });
  
  currentY += 42;

  // Engagement Rate Distribution Section - Enhanced
  currentY = addSection(doc, 'Engagement Rate Distribution', currentY);
  
  // Container box
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(15, currentY, 180, 48, 3, 3, 'F');
  doc.setDrawColor(235, 235, 235);
  doc.roundedRect(15, currentY, 180, 48, 3, 3, 'S');
  
  const erRanges = [
    { label: '0-2% (Low)', count: erDistribution.low, color: [239, 68, 68] as [number, number, number] },
    { label: '2-5% (Medium)', count: erDistribution.medium, color: [234, 179, 8] as [number, number, number] },
    { label: '5-10% (Good)', count: erDistribution.good, color: [59, 130, 246] as [number, number, number] },
    { label: '10%+ (Excellent)', count: erDistribution.excellent, color: [16, 185, 129] as [number, number, number] },
  ];

  const maxERCount = Math.max(...erRanges.map(r => r.count), 1);
  
  erRanges.forEach((range, i) => {
    const y = currentY + 5 + (i * 11);
    const barWidth = Math.max((range.count / maxERCount) * 90, 3);
    
    // Label
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.setFont('helvetica', 'normal');
    doc.text(range.label, 22, y + 4);
    
    // Bar
    doc.setFillColor(...range.color);
    doc.roundedRect(75, y, barWidth, 6, 2, 2, 'F');
    
    // Count
    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'bold');
    doc.text(`${range.count}`, 80 + barWidth, y + 4);
    doc.setFont('helvetica', 'normal');
  });

  currentY += 55;

  // Top Tags Section
  currentY = addSection(doc, 'Most Used Tags (Top 15)', currentY);
  
  doc.setFontSize(8);
  let tagX = 20;
  let tagY = currentY;
  
  topTags.forEach((tag) => {
    const tagText = `${tag[0]} (${tag[1]})`;
    const tagWidth = doc.getTextWidth(tagText) + 6;
    
    if (tagX + tagWidth > 190) {
      tagX = 20;
      tagY += 8;
    }
    
    doc.setFillColor(240, 240, 240);
    doc.roundedRect(tagX, tagY - 4, tagWidth, 7, 2, 2, 'F');
    doc.setTextColor(60, 60, 60);
    doc.text(tagText, tagX + 3, tagY);
    tagX += tagWidth + 3;
  });

  // ========== VIDEO CATALOG PAGES ==========
  const sortedVideos = [...scoredVideos].sort((a, b) => b.viewCountRaw - a.viewCountRaw);
  
  for (let i = 0; i < sortedVideos.length; i++) {
    // New page every 5 videos
    if (i % videosPerPage === 0) {
      doc.addPage();
      currentPage++;
      addHeader(doc, `Video Catalog (${i + 1}-${Math.min(i + videosPerPage, sortedVideos.length)} of ${sortedVideos.length})`, currentPage, totalPages);
      currentY = 28;
    }

    const video = sortedVideos[i];
    const thumbnailBase64 = thumbnailMap.get(video.id);
    
    // Video entry box - dynamic height based on title length
    const entryHeight = 52;
    
    if (currentY + entryHeight > 275) {
      doc.addPage();
      currentPage++;
      addHeader(doc, `Video Catalog`, currentPage, totalPages);
      currentY = 28;
    }

    // Light background for video entry
    doc.setFillColor(252, 252, 252);
    doc.roundedRect(15, currentY, 180, entryHeight, 2, 2, 'F');
    doc.setDrawColor(240, 240, 240);
    doc.roundedRect(15, currentY, 180, entryHeight, 2, 2, 'S');

    // Video number
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(239, 68, 68);
    doc.text(`#${i + 1}`, 20, currentY + 8);

    // Thumbnail
    const thumbX = 32;
    const thumbY = currentY + 3;
    const thumbW = 45;
    const thumbH = 25;
    
    if (thumbnailBase64) {
      try {
        doc.addImage(thumbnailBase64, 'JPEG', thumbX, thumbY, thumbW, thumbH);
      } catch (e) {
        doc.setFillColor(230, 230, 230);
        doc.rect(thumbX, thumbY, thumbW, thumbH, 'F');
      }
    } else {
      doc.setFillColor(230, 230, 230);
      doc.rect(thumbX, thumbY, thumbW, thumbH, 'F');
      doc.setFontSize(6);
      doc.setTextColor(150, 150, 150);
      doc.text('NO IMAGE', thumbX + thumbW/2, thumbY + thumbH/2, { align: 'center' });
    }

    // Badges (SHORT, OUTLIER) - Using plain text, no emojis
    let badgeX = thumbX;
    if (video.isShort) {
      doc.setFillColor(168, 85, 247);
      doc.roundedRect(badgeX, thumbY + thumbH + 1, 16, 5, 1, 1, 'F');
      doc.setFontSize(5);
      doc.setTextColor(255, 255, 255);
      doc.text('SHORT', badgeX + 8, thumbY + thumbH + 4.5, { align: 'center' });
      badgeX += 18;
    }
    if (video.isOutlier) {
      doc.setFillColor(249, 115, 22);
      doc.roundedRect(badgeX, thumbY + thumbH + 1, 18, 5, 1, 1, 'F');
      doc.setFontSize(5);
      doc.setTextColor(255, 255, 255);
      doc.text('OUTLIER', badgeX + 9, thumbY + thumbH + 4.5, { align: 'center' });
    }

    // Video info - right side
    const infoX = thumbX + thumbW + 5;
    const maxInfoWidth = 115; // Wider area for text
    
    // Title - FULL title with proper wrapping (up to 3 lines)
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    
    // Use full title, let jsPDF wrap it properly
    const titleLines = doc.splitTextToSize(video.title, maxInfoWidth);
    // Show up to 3 lines of title
    const displayTitleLines = titleLines.slice(0, 3);
    if (titleLines.length > 3) {
      // Add ellipsis to last line if truncated
      displayTitleLines[2] = displayTitleLines[2].substring(0, displayTitleLines[2].length - 3) + '...';
    }
    doc.text(displayTitleLines, infoX, currentY + 6);
    
    // Calculate Y position based on number of title lines
    const titleLineCount = Math.min(displayTitleLines.length, 3);
    const titleEndY = currentY + 6 + (titleLineCount - 1) * 3.5;
    
    // Stats row 1: Views, Likes, Comments - Plain text labels (NO EMOJIS)
    const statsY = titleEndY + 5;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(`Views: ${video.views}  |  Likes: ${video.likes}  |  Comments: ${video.comments || '0'}`, infoX, statsY);
    
    // Stats row 2: ER, Duration, Published with SPECIFIC DATE
    const publishDate = video.publishedAtDate ? formatSpecificDate(new Date(video.publishedAtDate)) : video.publishedTimeAgo || 'N/A';
    doc.text(`ER: ${video.engagementRate || 0}%  |  Duration: ${video.durationFormatted || 'N/A'}  |  Published: ${publishDate}`, infoX, statsY + 5);
    
    // Scores row - with safe access
    const scoresY = statsY + 10;
    doc.setFontSize(7);
    
    // Get scores with fallback
    const titleScore = video.titleScore || { totalScore: 50, grade: 'C' as const };
    const thumbnailScore = video.thumbnailScore || { totalScore: 50, grade: 'C' as const };
    
    // Title score
    doc.setTextColor(80, 80, 80);
    doc.text('Title: ', infoX, scoresY);
    const [tsr, tsg, tsb] = getGradeColor(titleScore.grade);
    doc.setTextColor(tsr, tsg, tsb);
    doc.setFont('helvetica', 'bold');
    doc.text(`${titleScore.totalScore} (${titleScore.grade})`, infoX + 12, scoresY);
    
    // Thumbnail score
    doc.setTextColor(80, 80, 80);
    doc.setFont('helvetica', 'normal');
    doc.text('  |  Thumb: ', infoX + 30, scoresY);
    const [ths, thsg, thsb] = getGradeColor(thumbnailScore.grade);
    doc.setTextColor(ths, thsg, thsb);
    doc.setFont('helvetica', 'bold');
    doc.text(`${thumbnailScore.totalScore} (${thumbnailScore.grade})`, infoX + 52, scoresY);

    // Tags (top 5)
    if (video.tags && video.tags.length > 0) {
      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120, 120, 120);
      const tagsText = video.tags.slice(0, 5).join(', ');
      const truncatedTags = tagsText.length > 60 ? tagsText.substring(0, 60) + '...' : tagsText;
      doc.text(`Tags: ${truncatedTags}`, infoX, scoresY + 5);
    }

    currentY += entryHeight + 2;
  }

  // ========== FINAL PAGE: FOOTER ==========
  doc.addPage();
  currentPage++;
  addHeader(doc, 'Report Summary', currentPage, totalPages);

  // Centered summary
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Report Complete', 105, 100, { align: 'center' });
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text(`Total Videos Analyzed: ${data.videos.length}`, 105, 115, { align: 'center' });
  doc.text(`Videos in This Report: ${videosForPDF.length}`, 105, 125, { align: 'center' });
  doc.text(`Total Pages: ${totalPages}`, 105, 135, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated on ${data.generatedAt.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })}`, 105, 150, { align: 'center' });

  // Thank you note
  doc.setFillColor(239, 68, 68);
  doc.roundedRect(55, 170, 100, 30, 3, 3, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Thank You!', 105, 183, { align: 'center' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Generated by YT Analyzer Pro', 105, 192, { align: 'center' });

  doc.setTextColor(100, 100, 100);
  doc.setFontSize(9);
  doc.text(`Report ID: ${reportId}`, 105, 220, { align: 'center' });

  // ========== SAVE ==========
  const fileName = `${data.channelTitle?.replace(/[^a-zA-Z0-9]/g, '_') || 'channel'}_comprehensive_report_${new Date().toISOString().split('T')[0]}.pdf`;
  console.log(`Saving PDF: ${fileName}`);
  doc.save(fileName);
  console.log('PDF saved successfully!');
};

export const generateQuickReport = async (videos: VideoItem[], title: string): Promise<void> => {
  await generatePDFReport({
    channelTitle: title,
    videos,
    generatedAt: new Date()
  });
};
