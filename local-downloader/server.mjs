#!/usr/bin/env node
/**
 * YT Analyzer — Local Downloader
 *
 * Jembatan kecil antara aplikasi web dan mesin unduh di perangkat Anda
 * (yt-dlp + ffmpeg). Server hanya mendengarkan di 127.0.0.1 dan hanya
 * menerima permintaan dari origin aplikasi yang diizinkan.
 *
 * Jalankan:  node local-downloader/server.mjs   (atau: npm run downloader)
 *
 * Variabel lingkungan (opsional):
 *   PORT             Port lokal (default 17890)
 *   DOWNLOAD_DIR     Folder tujuan (default ~/Downloads/YT Analyzer)
 *   YTDLP_PATH       Path ke yt-dlp bila tidak ada di PATH
 *   FFMPEG_PATH      Path ke ffmpeg (file atau folder) bila tidak ada di PATH
 *   ALLOWED_ORIGINS  Origin tambahan, dipisah koma (mis. https://domain-anda.com)
 *   MAX_CONCURRENT   Jumlah unduhan paralel (default 2)
 */
import http from 'node:http';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const VERSION = '1.0.0';
const PORT = Number(process.env.PORT) || 17890;
const HOST = '127.0.0.1';
const DOWNLOAD_DIR = process.env.DOWNLOAD_DIR || path.join(os.homedir(), 'Downloads', 'YT Analyzer');
const MAX_CONCURRENT = Math.max(1, Number(process.env.MAX_CONCURRENT) || 2);
const MAX_BODY = 16 * 1024;
const MAX_JOBS_KEPT = 100;

const DEFAULT_ORIGINS = [
  'https://youtube-analytics-eta.vercel.app',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];
// Preview deployment Vercel proyek ini
const ORIGIN_PATTERNS = [/^https:\/\/youtube-analytics-[a-z0-9-]+\.vercel\.app$/];

export const QUALITIES = ['best', '2160', '1440', '1080', '720', '480', '360'];
export const FORMATS = ['mp4', 'mp3'];

// ---------------------------------------------------------------------------
// Helper murni (diuji di src/test/localDownloader.test.ts)
// ---------------------------------------------------------------------------

export const parseAllowedOrigins = (extra = '') => [
  ...DEFAULT_ORIGINS,
  ...extra
    .split(',')
    .map(s => s.trim().replace(/\/$/, ''))
    .filter(Boolean),
];

export const isOriginAllowed = (origin, allowed) => {
  if (!origin) return true; // permintaan non-browser (curl) dari mesin yang sama
  if (allowed.includes('*') || allowed.includes(origin)) return true;
  return ORIGIN_PATTERNS.some(re => re.test(origin));
};

/** Cegah DNS rebinding: hanya terima Host localhost/127.0.0.1. */
export const isHostAllowed = host => /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host || '');

export const validateUrl = raw => {
  if (typeof raw !== 'string' || raw.length > 2048) return null;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.toString();
  } catch {
    return null;
  }
};

const PROGRESS_PREFIX = '@@P ';
const TITLE_PREFIX = '@@T ';
const FILE_PREFIX = '@@F ';

/**
 * Argumen yt-dlp untuk satu unduhan. URL selalu diletakkan setelah "--".
 * `workDir` adalah folder kerja khusus job; hasil akhir dipindahkan server ke folder unduhan,
 * sehingga yt-dlp tidak pernah melihat, menimpa, atau menghapus file milik pengguna.
 */
export const buildDownloadArgs = ({ url, format, quality, hasFfmpeg, workDir, ffmpegLocation }) => {
  const q = QUALITIES.includes(quality) ? quality : 'best';
  const h = q === 'best' ? '' : `[height<=${q}]`;
  const args = [
    '--no-playlist',
    '--newline',
    '--no-colors',
    '--progress',
    '--progress-template',
    `download:${PROGRESS_PREFIX}%(progress.downloaded_bytes)s %(progress.total_bytes)s %(progress.total_bytes_estimate)s %(progress.speed)s %(progress.eta)s`,
    '--print',
    `before_dl:${TITLE_PREFIX}%(title)s`,
    '--print',
    `after_move:${FILE_PREFIX}%(filepath)s`,
    '--no-mtime',
    '-P',
    workDir,
    '-o',
    '%(title).150B [%(id)s].%(ext)s',
  ];
  if (ffmpegLocation) args.push('--ffmpeg-location', ffmpegLocation);

  if (format === 'mp3') {
    if (hasFfmpeg) args.push('-f', 'ba/b', '-x', '--audio-format', 'mp3', '--audio-quality', '0');
    else args.push('-f', 'ba[ext=m4a]/ba/b'); // tanpa ffmpeg: audio asli (m4a/webm)
  } else if (hasFfmpeg) {
    args.push('-f', `bv*${h}[ext=mp4]+ba[ext=m4a]/bv*${h}+ba/b${h}/b`, '--merge-output-format', 'mp4');
  } else {
    // tanpa ffmpeg hanya bisa format "progressive" (video+audio satu file)
    args.push('-f', `b${h}[ext=mp4]/b${h}/b`);
  }
  args.push('--', url);
  return args;
};

const num = v => (v === undefined || v === 'NA' || v === 'None' || v === '' ? null : Number(v));

/** Baca baris output yt-dlp → pembaruan status job. */
export const parseLine = line => {
  if (line.startsWith(PROGRESS_PREFIX)) {
    const [downloaded, total, estimate, speed, eta] = line.slice(PROGRESS_PREFIX.length).trim().split(/\s+/).map(num);
    const size = total ?? estimate;
    return {
      type: 'progress',
      downloaded,
      total: size,
      percent: size && downloaded !== null ? Math.min(100, (downloaded / size) * 100) : null,
      speed,
      eta,
    };
  }
  if (line.startsWith(TITLE_PREFIX)) return { type: 'title', title: line.slice(TITLE_PREFIX.length).trim() };
  if (line.startsWith(FILE_PREFIX)) return { type: 'file', filepath: line.slice(FILE_PREFIX.length).trim() };
  if (/^\[(Merger|ExtractAudio|FixupM3u8|FixupM4a|VideoConvertor|Metadata)\]/.test(line)) return { type: 'processing' };
  if (/^\[download\] Destination:/.test(line)) return { type: 'stream' };
  if (/^ERROR:/.test(line)) {
    // Buang boilerplate "please report this issue ..." agar pesan ringkas
    const message = line.replace(/^ERROR:\s*/, '').split(/;\s*please report this issue/i)[0].trim();
    return { type: 'error', message };
  }
  return null;
};

/** Ringkas hasil `yt-dlp -J` untuk ditampilkan di UI. */
export const summarizeInfo = info => {
  const heights = Array.from(
    new Set((info.formats || []).filter(f => f.vcodec && f.vcodec !== 'none' && f.height).map(f => f.height))
  ).sort((a, b) => b - a);
  return {
    id: info.id,
    title: info.title,
    channel: info.channel || info.uploader || '',
    duration: info.duration || null,
    thumbnail: info.thumbnail || null,
    extractor: info.extractor_key || info.extractor || '',
    heights,
  };
};

// ---------------------------------------------------------------------------
// Deteksi mesin
// ---------------------------------------------------------------------------

const run = (cmd, args, timeoutMs = 15000) =>
  new Promise(resolve => {
    let out = '';
    let err = '';
    let child;
    try {
      child = spawn(cmd, args, { windowsHide: true });
    } catch {
      resolve({ ok: false, out: '', err: 'spawn failed' });
      return;
    }
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.stdout.on('data', d => (out += d));
    child.stderr.on('data', d => (err += d));
    child.on('error', e => {
      clearTimeout(timer);
      resolve({ ok: false, out, err: e.message });
    });
    child.on('close', code => {
      clearTimeout(timer);
      resolve({ ok: code === 0, out, err });
    });
  });

const engine = { ytdlp: null, ytdlpVersion: null, ffmpeg: false, ffmpegLocation: null, ffmpegVersion: null };

const detectEngine = async () => {
  const candidates = [
    ...(process.env.YTDLP_PATH ? [[process.env.YTDLP_PATH, []]] : []),
    ['yt-dlp', []],
    ['python3', ['-m', 'yt_dlp']],
    ['python', ['-m', 'yt_dlp']],
    ['py', ['-m', 'yt_dlp']],
  ];
  engine.ytdlp = null;
  engine.ytdlpVersion = null;
  for (const [cmd, pre] of candidates) {
    const r = await run(cmd, [...pre, '--version']);
    if (r.ok && r.out.trim()) {
      engine.ytdlp = [cmd, pre];
      engine.ytdlpVersion = r.out.trim().split('\n')[0];
      break;
    }
  }

  const ffEnv = process.env.FFMPEG_PATH;
  const ffCmd = ffEnv ? (fs.existsSync(ffEnv) && fs.statSync(ffEnv).isDirectory() ? path.join(ffEnv, 'ffmpeg') : ffEnv) : 'ffmpeg';
  const ff = await run(ffCmd, ['-version']);
  engine.ffmpeg = ff.ok;
  engine.ffmpegLocation = ff.ok && ffEnv ? ffEnv : null;
  engine.ffmpegVersion = ff.ok ? (ff.out.match(/ffmpeg version (\S+)/)?.[1] ?? 'ok') : null;
  return engine;
};

const ytdlp = (args, opts) => spawn(engine.ytdlp[0], [...engine.ytdlp[1], ...args], { windowsHide: true, ...opts });

// ---------------------------------------------------------------------------
// Job manager
// ---------------------------------------------------------------------------

const jobs = new Map();
const queue = [];
let active = 0;

const publicJob = j => {
  const { child, ...rest } = j;
  return rest;
};

const pruneJobs = () => {
  const finished = [...jobs.values()].filter(j => ['done', 'error', 'canceled'].includes(j.status));
  while (jobs.size > MAX_JOBS_KEPT && finished.length) jobs.delete(finished.shift().id);
};

const startNext = () => {
  while (active < MAX_CONCURRENT && queue.length) {
    const job = queue.shift();
    if (job.status === 'queued') runJob(job);
  }
};

const runJob = job => {
  active++;
  job.status = 'downloading';
  job.startedAt = Date.now();
  const workDir = path.join(DOWNLOAD_DIR, '.tmp', job.id);
  fs.mkdirSync(workDir, { recursive: true });

  const args = buildDownloadArgs({
    url: job.url,
    format: job.format,
    quality: job.quality,
    hasFfmpeg: engine.ffmpeg,
    workDir,
    ffmpegLocation: engine.ffmpegLocation,
  });
  const child = ytdlp(args);
  job.child = child;

  const onLine = line => {
    const evt = parseLine(line);
    if (!evt) return;
    if (evt.type === 'progress') {
      // Format gabungan (video + audio) diunduh sebagai 2 stream: total berubah = stream baru
      if (!job.part || (job.total && evt.total && evt.total !== job.total && (evt.downloaded ?? 0) < (job.downloaded ?? 0))) {
        job.part = (job.part || 0) + 1;
      }
      job.percent = evt.percent;
      job.downloaded = evt.downloaded;
      job.total = evt.total;
      job.speed = evt.speed;
      job.eta = evt.eta;
    } else if (evt.type === 'stream') {
      job.part = (job.part || 0) + 1;
      job.percent = 0;
    } else if (evt.type === 'title') job.title = evt.title;
    else if (evt.type === 'file') {
      job.filepath = evt.filepath;
      job.filename = path.basename(evt.filepath);
    } else if (evt.type === 'processing') job.status = 'processing';
    else if (evt.type === 'error') job.error = evt.message;
  };

  const attach = stream => {
    let buf = '';
    stream.on('data', d => {
      buf += d.toString();
      const lines = buf.split(/\r?\n/);
      buf = lines.pop();
      lines.forEach(l => onLine(l.trim()));
    });
    stream.on('end', () => buf && onLine(buf.trim()));
  };
  attach(child.stdout);
  attach(child.stderr);

  child.on('error', e => {
    job.error = e.message;
  });
  child.on('close', code => {
    active--;
    delete job.child;
    job.finishedAt = Date.now();
    if (job.status === 'canceled') {
      // biarkan status canceled
    } else if (code === 0 && job.filepath && fs.existsSync(job.filepath)) {
      try {
        job.filepath = moveToDownloads(job.filepath);
        job.filename = path.basename(job.filepath);
        job.size = fs.statSync(job.filepath).size;
        job.status = 'done';
        job.percent = 100;
      } catch (e) {
        job.status = 'error';
        job.error = `Gagal memindahkan file: ${e.message}`;
      }
    } else {
      job.status = 'error';
      job.error = job.error || `yt-dlp keluar dengan kode ${code}`;
    }
    fs.rm(workDir, { recursive: true, force: true }, () =>
      fs.rmdir(path.join(DOWNLOAD_DIR, '.tmp'), () => {}) // hapus bila sudah kosong
    );
    pruneJobs();
    startNext();
  });
};

/** Nama file unik di folder tujuan: "judul.mp4" → "judul (1).mp4" bila sudah ada. */
export const uniqueTarget = (dir, name, exists = p => fs.existsSync(p)) => {
  const ext = path.extname(name);
  const base = name.slice(0, name.length - ext.length);
  let candidate = path.join(dir, name);
  for (let i = 1; exists(candidate); i++) candidate = path.join(dir, `${base} (${i})${ext}`);
  return candidate;
};

const moveToDownloads = src => {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
  const target = uniqueTarget(DOWNLOAD_DIR, path.basename(src));
  try {
    fs.renameSync(src, target);
  } catch (e) {
    if (e.code !== 'EXDEV') throw e;
    fs.copyFileSync(src, target);
    fs.unlinkSync(src);
  }
  return target;
};

const createJob = ({ url, format, quality }) => {
  const job = {
    id: randomUUID(),
    url,
    format,
    quality,
    status: 'queued',
    percent: 0,
    part: 0,
    title: null,
    filename: null,
    filepath: null,
    error: null,
    createdAt: Date.now(),
  };
  jobs.set(job.id, job);
  queue.push(job);
  startNext();
  return job;
};

const cancelJob = job => {
  if (job.status === 'queued') {
    job.status = 'canceled';
    job.finishedAt = Date.now();
  } else if (job.child) {
    job.status = 'canceled';
    job.child.kill(process.platform === 'win32' ? undefined : 'SIGTERM');
  }
};

const fetchInfo = url =>
  new Promise((resolve, reject) => {
    const child = ytdlp(['-J', '--no-playlist', '--no-warnings', '--', url]);
    let out = '';
    let err = '';
    const timer = setTimeout(() => child.kill(), 60000);
    child.stdout.on('data', d => (out += d));
    child.stderr.on('data', d => (err += d));
    child.on('error', e => {
      clearTimeout(timer);
      reject(e);
    });
    child.on('close', code => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error((err.match(/ERROR:\s*(.+)/)?.[1] || 'Gagal membaca info video').trim()));
        return;
      }
      try {
        resolve(summarizeInfo(JSON.parse(out)));
      } catch {
        reject(new Error('Output yt-dlp tidak valid'));
      }
    });
  });

const openFolder = target => {
  const dir = target && fs.existsSync(target) ? target : DOWNLOAD_DIR;
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
  const isFile = fs.existsSync(dir) && fs.statSync(dir).isFile();
  if (process.platform === 'win32') {
    spawn('explorer.exe', isFile ? [`/select,${dir}`] : [dir], { detached: true, stdio: 'ignore' }).unref();
  } else if (process.platform === 'darwin') {
    spawn('open', isFile ? ['-R', dir] : [dir], { detached: true, stdio: 'ignore' }).unref();
  } else {
    spawn('xdg-open', [isFile ? path.dirname(dir) : dir], { detached: true, stdio: 'ignore' }).on('error', () => {}).unref();
  }
};

// ---------------------------------------------------------------------------
// HTTP server
// ---------------------------------------------------------------------------

const allowedOrigins = parseAllowedOrigins(process.env.ALLOWED_ORIGINS);

const send = (res, status, body, origin) => {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Vary'] = 'Origin';
  }
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
};

const readBody = req =>
  new Promise((resolve, reject) => {
    let size = 0;
    let data = '';
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('Body terlalu besar'));
        req.destroy();
        return;
      }
      data += chunk;
    });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error('JSON tidak valid'));
      }
    });
    req.on('error', reject);
  });

export const createServer = () =>
  http.createServer(async (req, res) => {
    const origin = req.headers.origin;

    if (!isHostAllowed(req.headers.host)) return send(res, 403, { error: 'Host tidak diizinkan' });
    if (!isOriginAllowed(origin, allowedOrigins)) {
      return send(res, 403, { error: `Origin ${origin} tidak diizinkan. Tambahkan lewat ALLOWED_ORIGINS.` });
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': origin || '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        // Chrome Private Network Access (halaman HTTPS → localhost)
        'Access-Control-Allow-Private-Network': 'true',
        'Access-Control-Max-Age': '600',
        Vary: 'Origin',
      });
      return res.end();
    }

    const url = new URL(req.url, `http://${HOST}`);
    const parts = url.pathname.split('/').filter(Boolean);

    try {
      if (req.method === 'GET' && url.pathname === '/health') {
        if (url.searchParams.has('refresh')) await detectEngine();
        return send(
          res,
          200,
          {
            ok: true,
            app: 'yt-analyzer-local-downloader',
            version: VERSION,
            ytdlp: engine.ytdlpVersion,
            ffmpeg: engine.ffmpegVersion,
            downloadDir: DOWNLOAD_DIR,
            platform: process.platform,
            active,
            queued: queue.filter(j => j.status === 'queued').length,
          },
          origin
        );
      }

      if (!engine.ytdlp && url.pathname !== '/open-folder') {
        return send(res, 503, { error: 'yt-dlp tidak ditemukan di perangkat ini. Instal yt-dlp lalu jalankan ulang server.' }, origin);
      }

      if (req.method === 'POST' && url.pathname === '/info') {
        const body = await readBody(req);
        const target = validateUrl(body.url);
        if (!target) return send(res, 400, { error: 'URL tidak valid' }, origin);
        return send(res, 200, await fetchInfo(target), origin);
      }

      if (req.method === 'POST' && url.pathname === '/download') {
        const body = await readBody(req);
        const target = validateUrl(body.url);
        if (!target) return send(res, 400, { error: 'URL tidak valid' }, origin);
        const format = FORMATS.includes(body.format) ? body.format : 'mp4';
        const quality = QUALITIES.includes(String(body.quality)) ? String(body.quality) : 'best';
        return send(res, 202, publicJob(createJob({ url: target, format, quality })), origin);
      }

      if (req.method === 'GET' && url.pathname === '/jobs') {
        const list = [...jobs.values()].sort((a, b) => b.createdAt - a.createdAt).map(publicJob);
        return send(res, 200, { jobs: list }, origin);
      }

      if (parts[0] === 'jobs' && parts[1]) {
        const job = jobs.get(parts[1]);
        if (!job) return send(res, 404, { error: 'Job tidak ditemukan' }, origin);
        if (req.method === 'GET') return send(res, 200, publicJob(job), origin);
        if (req.method === 'DELETE') {
          if (['queued', 'downloading', 'processing'].includes(job.status)) cancelJob(job);
          else jobs.delete(job.id);
          return send(res, 200, { ok: true }, origin);
        }
      }

      if (req.method === 'POST' && url.pathname === '/open-folder') {
        const body = await readBody(req);
        const job = body.jobId ? jobs.get(body.jobId) : null;
        openFolder(job?.filepath);
        return send(res, 200, { ok: true }, origin);
      }

      return send(res, 404, { error: 'Endpoint tidak ditemukan' }, origin);
    } catch (e) {
      return send(res, 500, { error: e instanceof Error ? e.message : 'Kesalahan server' }, origin);
    }
  });

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  await detectEngine();
  const server = createServer();
  server.on('error', e => {
    if (e.code === 'EADDRINUSE') console.error(`✖ Port ${PORT} sudah dipakai. Jalankan dengan PORT=xxxxx.`);
    else console.error(e);
    process.exit(1);
  });
  server.listen(PORT, HOST, () => {
    console.log(`\n  YT Analyzer — Local Downloader v${VERSION}`);
    console.log(`  ➜ http://${HOST}:${PORT}`);
    console.log(`  yt-dlp : ${engine.ytdlpVersion ?? '✖ tidak ditemukan (https://github.com/yt-dlp/yt-dlp#installation)'}`);
    console.log(`  ffmpeg : ${engine.ffmpegVersion ?? '✖ tidak ditemukan — MP3 & resolusi >720p tidak tersedia'}`);
    console.log(`  Folder : ${DOWNLOAD_DIR}\n`);
    console.log('  Biarkan jendela ini terbuka selama mengunduh. Tekan Ctrl+C untuk berhenti.\n');
  });
}
