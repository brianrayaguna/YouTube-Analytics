// Analisis kualitas teks judul (v2) — 0–100, terpisah dari performa.
//
// Perbaikan dari v1 (hasil audit):
// - Panjang dihitung TANPA tagar; target berbeda untuk Shorts vs video panjang.
// - Angka tidak lagi dihitung sebagai "huruf kapital" (rasio dihitung dari huruf saja).
// - Emoji/tagar berlebihan & tanda baca berulang kini MENGURANGI skor (sebelumnya judul spam bisa
//   mengalahkan judul bersih).
// - Tidak ada lagi "wajib emoji"; judul tanpa emoji tidak dihukum.
// - Pencocokan kata pemikat memakai batas kata (unicode-aware), bukan substring.

export interface TitleCheck {
  key: 'length' | 'hook' | 'caps' | 'hygiene' | 'clarity';
  label: string;
  score: number;
  max: number;
  feedback: string;
}

export interface TitleScoreResult {
  totalScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  checks: TitleCheck[];
  suggestions: string[];
  stats: { length: number; hashtags: string[]; emojis: number; words: number };
}

const POWER_WORDS = [
  // Indonesia
  'rahasia', 'terbongkar', 'terungkap', 'akhirnya', 'jujur', 'sebenarnya', 'wajib', 'penting', 'gratis', 'terbaik',
  'termurah', 'tercepat', 'terbaru', 'lengkap', 'mudah', 'cepat', 'ampuh', 'gila', 'viral', 'pertama', 'terakhir',
  'jangan', 'ternyata', 'pemula', 'panduan', 'tutorial', 'cara', 'tips', 'trik', 'review', 'vs',
  // English
  'secret', 'revealed', 'ultimate', 'finally', 'honest', 'truth', 'best', 'worst', 'free', 'easy', 'fast',
  'never', 'stop', 'how', 'why', 'guide', 'beginner', 'beginners', 'review', 'tested', 'insane', 'proven',
];

const QUESTION_WORDS = ['kenapa', 'mengapa', 'bagaimana', 'apa', 'apakah', 'siapa', 'kapan', 'dimana', 'berapa', 'how', 'why', 'what', 'who', 'when', 'which', 'can', 'should', 'is'];

const STOPWORDS = new Set([
  'yang', 'dan', 'di', 'ke', 'dari', 'ini', 'itu', 'untuk', 'dengan', 'atau', 'pada', 'aja', 'saja', 'juga', 'the', 'a', 'an',
  'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'is', 'my', 'your', 'part', 'eps', 'ep',
]);

const EMOJI_RE = /\p{Extended_Pictographic}/gu;
const HASHTAG_RE = /#[\p{L}\p{N}_]+/gu;
const WORD_RE = /[\p{L}\p{N}]+/gu;

const gradeOf = (score: number): TitleScoreResult['grade'] =>
  score >= 80 ? 'A' : score >= 65 ? 'B' : score >= 50 ? 'C' : score >= 35 ? 'D' : 'F';

export const analyzeTitleScore = (title: string, opts: { isShort?: boolean } = {}): TitleScoreResult => {
  const isShort = !!opts.isShort;
  const raw = (title || '').trim();
  const hashtags = raw.match(HASHTAG_RE) ?? [];
  const emojis = (raw.match(EMOJI_RE) ?? []).length;
  const clean = raw.replace(HASHTAG_RE, ' ').replace(EMOJI_RE, ' ').replace(/\s+/g, ' ').trim();
  const len = Array.from(clean).length;
  const words = (clean.toLowerCase().match(WORD_RE) ?? []) as string[];
  const lower = ` ${words.join(' ')} `;
  const suggestions: string[] = [];
  const checks: TitleCheck[] = [];

  // 1. Panjang (25) — judul terpotong di hasil pencarian/beranda bila terlalu panjang
  {
    const [idealMin, idealMax, okMin, okMax] = isShort ? [15, 50, 8, 70] : [30, 60, 20, 70];
    let score: number;
    let feedback: string;
    if (len >= idealMin && len <= idealMax) {
      score = 25;
      feedback = `Ideal (${len} karakter)`;
    } else if (len >= okMin && len <= okMax) {
      score = 17;
      feedback = `Cukup (${len} karakter)`;
      suggestions.push(len < idealMin ? `Tambahkan kata kunci hingga ±${idealMin}–${idealMax} karakter` : `Persingkat ke ≤${idealMax} karakter agar tidak terpotong`);
    } else if (len < okMin) {
      score = len === 0 ? 0 : 8;
      feedback = `Terlalu pendek (${len} karakter)`;
      suggestions.push(`Judul terlalu pendek — jelaskan isi video (${idealMin}–${idealMax} karakter)`);
    } else {
      score = 8;
      feedback = `Terlalu panjang (${len} karakter)`;
      suggestions.push(`Persingkat judul ke ≤${idealMax} karakter; kata penting taruh di depan`);
    }
    checks.push({ key: 'length', label: 'Panjang', score, max: 25, feedback });
  }

  // 2. Pemikat (25) — angka, pertanyaan/cara, kata kuat, kurung [..]/(..)
  {
    const signals: string[] = [];
    if (/\p{N}/u.test(clean)) signals.push('angka');
    const startsWithQuestion = QUESTION_WORDS.some(q => lower.startsWith(` ${q} `));
    if (clean.includes('?') || startsWithQuestion) {
      signals.push('pertanyaan');
    } else if (/^(cara|how to|tutorial|panduan)\b/i.test(clean)) signals.push('cara/tutorial');
    const power = POWER_WORDS.filter(w => lower.includes(` ${w} `));
    if (power.length) signals.push(`kata kuat (${power.slice(0, 2).join(', ')})`);
    if (/[[(（【].+[\])）】]/u.test(clean)) signals.push('keterangan dalam kurung');
    const score = [5, 15, 22, 25][Math.min(signals.length, 3)];
    if (signals.length < 2) suggestions.push('Tambahkan pemikat: angka spesifik, pertanyaan, atau keterangan [Tutorial]/(2026)');
    checks.push({ key: 'hook', label: 'Pemikat', score, max: 25, feedback: signals.length ? signals.join(' • ') : 'Belum ada pemikat' });
  }

  // 3. Kapitalisasi (20) — hanya huruf yang dihitung
  const letters = clean.replace(/[^\p{L}]/gu, '');
  const capsRatio = letters.length ? letters.replace(/[^\p{Lu}]/gu, '').length / letters.length : 0;
  const allCaps = capsRatio > 0.6 && letters.length > 8;
  {
    const ratio = capsRatio;
    let score: number;
    let feedback: string;
    if (allCaps) {
      score = 0;
      feedback = 'Hampir semua HURUF KAPITAL';
      suggestions.push('Hindari judul full kapital — kapitalkan 1–2 kata kunci saja');
    } else if (ratio > 0.35) {
      score = 12;
      feedback = 'Kapital agak berlebihan';
      suggestions.push('Kurangi huruf kapital; gunakan untuk penekanan saja');
    } else {
      score = 20;
      feedback = 'Mudah dibaca';
    }
    checks.push({ key: 'caps', label: 'Kapitalisasi', score, max: 20, feedback });
  }

  // 4. Kebersihan (20) — emoji, tagar, tanda baca berulang
  {
    const issues: string[] = [];
    if (allCaps) issues.push('huruf kapital');
    if (emojis > 2) issues.push(`${emojis} emoji`);
    if (hashtags.length > (isShort ? 3 : 2)) issues.push(`${hashtags.length} tagar`);
    if (/([!?.])\1{2,}/.test(raw)) issues.push('tanda baca berulang');
    if (/(\p{Extended_Pictographic})\1{2,}/u.test(raw)) issues.push('emoji berulang');
    const score = Math.max(0, 20 - issues.length * 7);
    if (issues.length) suggestions.push(`Rapikan judul: kurangi ${issues.join(', ')} (pindahkan tagar ke deskripsi)`);
    checks.push({ key: 'hygiene', label: 'Kebersihan', score, max: 20, feedback: issues.length ? `Berlebihan: ${issues.join(', ')}` : 'Rapi' });
  }

  // 5. Kejelasan topik (10) — jumlah kata bermakna
  {
    const meaningful = new Set(words.filter(w => w.length >= 3 && !STOPWORDS.has(w) && !/^\d+$/.test(w)));
    const n = meaningful.size;
    const score = n >= 3 ? 10 : n === 2 ? 6 : n === 1 ? 3 : 0;
    if (n < 3) suggestions.push('Sebutkan topik dengan jelas (minimal 3 kata kunci bermakna)');
    checks.push({ key: 'clarity', label: 'Kejelasan topik', score, max: 10, feedback: `${n} kata kunci bermakna` });
  }

  const totalScore = checks.reduce((s, c) => s + c.score, 0);
  return {
    totalScore,
    grade: gradeOf(totalScore),
    checks,
    suggestions: suggestions.slice(0, 4),
    stats: { length: len, hashtags, emojis, words: words.length },
  };
};
