// Title Scoring Service - Analyzes video titles for optimization

export interface TitleScoreBreakdown {
  length: { score: number; max: number; feedback: string };
  powerWords: { score: number; max: number; feedback: string; found: string[] };
  numbers: { score: number; max: number; feedback: string };
  question: { score: number; max: number; feedback: string };
  emoji: { score: number; max: number; feedback: string; count: number };
  capitalization: { score: number; max: number; feedback: string };
}

export interface TitleScoreResult {
  totalScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  breakdown: TitleScoreBreakdown;
  suggestions: string[];
}

const POWER_WORDS = [
  // English
  'SHOCKING', 'SECRET', 'AMAZING', 'REVEALED', 'ULTIMATE', 'INSANE', 'CRAZY',
  'UNBELIEVABLE', 'INCREDIBLE', 'MIND-BLOWING', 'EPIC', 'VIRAL', 'BANNED',
  'EXCLUSIVE', 'BREAKING', 'URGENT', 'WARNING', 'FINALLY', 'HONEST',
  'TRUTH', 'REAL', 'ACTUAL', 'LIFE-CHANGING', 'GAME-CHANGER', 'EXPOSED',
  // Indonesian
  'RAHASIA', 'MENGEJUTKAN', 'GILA', 'VIRAL', 'TERBONGKAR', 'TERUNGKAP',
  'AKHIRNYA', 'JUJUR', 'SEBENARNYA', 'NYATA', 'WAJIB', 'PENTING'
];

const EMOJI_REGEX = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu;

export const analyzeTitleScore = (title: string): TitleScoreResult => {
  const breakdown: TitleScoreBreakdown = {
    length: { score: 0, max: 15, feedback: '' },
    powerWords: { score: 0, max: 20, feedback: '', found: [] },
    numbers: { score: 0, max: 15, feedback: '' },
    question: { score: 0, max: 10, feedback: '' },
    emoji: { score: 0, max: 10, feedback: '', count: 0 },
    capitalization: { score: 0, max: 10, feedback: '' }
  };

  const suggestions: string[] = [];

  // 1. Length Analysis (optimal: 40-60 chars)
  const len = title.length;
  if (len >= 40 && len <= 60) {
    breakdown.length.score = 15;
    breakdown.length.feedback = `Panjang ideal (${len} karakter)`;
  } else if (len >= 30 && len <= 70) {
    breakdown.length.score = 10;
    breakdown.length.feedback = `Panjang cukup baik (${len} karakter)`;
  } else if (len < 30) {
    breakdown.length.score = 5;
    breakdown.length.feedback = `Terlalu pendek (${len} karakter)`;
    suggestions.push('Tambahkan kata kunci deskriptif hingga 40–60 karakter');
  } else {
    breakdown.length.score = 5;
    breakdown.length.feedback = `Terlalu panjang (${len} karakter)`;
    suggestions.push('Persingkat judul di bawah 60 karakter agar tidak terpotong');
  }

  // 2. Power Words Detection
  const upperTitle = title.toUpperCase();
  const foundPowerWords = Array.from(new Set(POWER_WORDS)).filter(pw =>
    new RegExp(`(^|[^\\p{L}])${pw}($|[^\\p{L}])`, 'u').test(upperTitle)
  );
  breakdown.powerWords.found = foundPowerWords;
  
  if (foundPowerWords.length >= 2) {
    breakdown.powerWords.score = 20;
    breakdown.powerWords.feedback = `Sangat baik! Ditemukan: ${foundPowerWords.slice(0, 3).join(', ')}`;
  } else if (foundPowerWords.length === 1) {
    breakdown.powerWords.score = 12;
    breakdown.powerWords.feedback = `Bagus! Ditemukan: ${foundPowerWords[0]}`;
    suggestions.push('Tambahkan satu power word lagi, mis. RAHASIA atau AKHIRNYA');
  } else {
    breakdown.powerWords.score = 0;
    breakdown.powerWords.feedback = 'Tidak ada power word';
    suggestions.push('Tambahkan kata pemikat seperti RAHASIA, TERBONGKAR, atau VIRAL');
  }

  // 3. Numbers Detection (Top 10, 5 Tips, etc.)
  const numberMatch = title.match(/\b\d+\b/g);
  if (numberMatch && numberMatch.length > 0) {
    breakdown.numbers.score = 15;
    breakdown.numbers.feedback = `Angka ditemukan: ${numberMatch.join(', ')}`;
  } else {
    breakdown.numbers.score = 0;
    breakdown.numbers.feedback = 'Tidak ada angka di judul';
    suggestions.push('Pertimbangkan menambah angka (mis. "5 Tips", "Top 10")');
  }

  // 4. Question Format Detection
  if (title.includes('?')) {
    breakdown.question.score = 10;
    breakdown.question.feedback = 'Format pertanyaan — bagus untuk memancing rasa penasaran';
  } else if (title.toLowerCase().startsWith('how') || title.toLowerCase().startsWith('why') || 
             title.toLowerCase().startsWith('what') || /\b(cara|kenapa|mengapa|apa|bagaimana|siapa)\b/i.test(title)) {
    breakdown.question.score = 7;
    breakdown.question.feedback = 'Judul bergaya pertanyaan';
  } else {
    breakdown.question.score = 3;
    breakdown.question.feedback = 'Format pernyataan';
  }

  // 5. Emoji Usage (1-2 is optimal)
  const emojis = title.match(EMOJI_REGEX) || [];
  breakdown.emoji.count = emojis.length;
  
  if (emojis.length >= 1 && emojis.length <= 2) {
    breakdown.emoji.score = 10;
    breakdown.emoji.feedback = `Penggunaan emoji pas (${emojis.length})`;
  } else if (emojis.length === 0) {
    breakdown.emoji.score = 3;
    breakdown.emoji.feedback = 'Tanpa emoji';
    suggestions.push('Tambahkan 1–2 emoji relevan untuk menaikkan CTR');
  } else {
    breakdown.emoji.score = 5;
    breakdown.emoji.feedback = `Emoji terlalu banyak (${emojis.length})`;
    suggestions.push('Kurangi emoji menjadi 1–2 agar lebih rapi');
  }

  // 6. Capitalization Analysis
  const words = title.split(/\s+/);
  const capsWords = words.filter(w => w === w.toUpperCase() && w.length > 2);
  const capsRatio = capsWords.length / words.length;
  
  if (capsRatio > 0 && capsRatio <= 0.3) {
    breakdown.capitalization.score = 10;
    breakdown.capitalization.feedback = 'Kapitalisasi strategis';
  } else if (capsRatio === 0) {
    breakdown.capitalization.score = 5;
    breakdown.capitalization.feedback = 'Tanpa kapitalisasi penekanan';
    suggestions.push('Kapitalkan 1–2 kata kunci untuk penekanan');
  } else {
    breakdown.capitalization.score = 3;
    breakdown.capitalization.feedback = 'Terlalu banyak huruf kapital';
    suggestions.push('Gunakan huruf kapital hanya untuk kata kunci');
  }

  // Calculate total score
  const totalScore = 
    breakdown.length.score +
    breakdown.powerWords.score +
    breakdown.numbers.score +
    breakdown.question.score +
    breakdown.emoji.score +
    breakdown.capitalization.score;

  // Determine grade
  let grade: 'A' | 'B' | 'C' | 'D' | 'F';
  if (totalScore >= 70) grade = 'A';
  else if (totalScore >= 55) grade = 'B';
  else if (totalScore >= 40) grade = 'C';
  else if (totalScore >= 25) grade = 'D';
  else grade = 'F';

  return {
    totalScore,
    grade,
    breakdown,
    suggestions: suggestions.slice(0, 4) // Limit to 4 suggestions
  };
};

// Analyze all videos and return statistics
export const analyzeVideoTitles = (titles: string[]): {
  averageScore: number;
  bestTitle: { title: string; score: number } | null;
  worstTitle: { title: string; score: number } | null;
  distribution: { A: number; B: number; C: number; D: number; F: number };
} => {
  if (titles.length === 0) {
    return {
      averageScore: 0,
      bestTitle: null,
      worstTitle: null,
      distribution: { A: 0, B: 0, C: 0, D: 0, F: 0 }
    };
  }

  const results = titles.map(title => ({
    title,
    result: analyzeTitleScore(title)
  }));

  const totalScore = results.reduce((sum, r) => sum + r.result.totalScore, 0);
  const averageScore = Math.round(totalScore / results.length);

  const sorted = [...results].sort((a, b) => b.result.totalScore - a.result.totalScore);

  const distribution = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  results.forEach(r => {
    distribution[r.result.grade]++;
  });

  return {
    averageScore,
    bestTitle: sorted[0] ? { title: sorted[0].title, score: sorted[0].result.totalScore } : null,
    worstTitle: sorted[sorted.length - 1] ? { title: sorted[sorted.length - 1].title, score: sorted[sorted.length - 1].result.totalScore } : null,
    distribution
  };
};
