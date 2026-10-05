// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  buildDownloadArgs,
  parseLine,
  validateUrl,
  isOriginAllowed,
  isHostAllowed,
  parseAllowedOrigins,
  summarizeInfo,
  uniqueTarget,
  formatSortFor,
  compatibilityPlan,
  buildTranscodeArgs,
} from '../../local-downloader/server.mjs';

describe('local downloader: validation', () => {
  it('accepts only http(s) URLs', () => {
    expect(validateUrl('https://youtu.be/dQw4w9WgXcQ')).toBe('https://youtu.be/dQw4w9WgXcQ');
    expect(validateUrl('file:///etc/passwd')).toBeNull();
    expect(validateUrl('--exec rm -rf /')).toBeNull();
    expect(validateUrl(42)).toBeNull();
  });

  it('allows the app origins and rejects others', () => {
    const allowed = parseAllowedOrigins('https://my.site/');
    expect(isOriginAllowed('https://youtube-analytics-eta.vercel.app', allowed)).toBe(true);
    expect(isOriginAllowed('https://youtube-analytics-abc123-team.vercel.app', allowed)).toBe(true);
    expect(isOriginAllowed('https://my.site', allowed)).toBe(true);
    expect(isOriginAllowed('https://evil.example', allowed)).toBe(false);
    expect(isOriginAllowed(undefined, allowed)).toBe(true);
  });

  it('guards against DNS rebinding', () => {
    expect(isHostAllowed('127.0.0.1:17890')).toBe(true);
    expect(isHostAllowed('localhost:17890')).toBe(true);
    expect(isHostAllowed('evil.example:17890')).toBe(false);
  });
});

describe('local downloader: yt-dlp arguments', () => {
  const base = { url: 'https://youtu.be/x', workDir: '/dl/.tmp/1' };

  it('always passes the URL after "--"', () => {
    const args = buildDownloadArgs({ ...base, format: 'mp4', quality: 'best', hasFfmpeg: true });
    expect(args.slice(-2)).toEqual(['--', 'https://youtu.be/x']);
    expect(args).toContain('--no-playlist');
    expect(args[args.indexOf('-P') + 1]).toBe('/dl/.tmp/1');
  });

  it('selects video-only + audio-only streams sorted for H.264/AAC (playable MP4)', () => {
    const args = buildDownloadArgs({ ...base, format: 'mp4', quality: '1080', hasFfmpeg: true });
    expect(args[args.indexOf('-f') + 1]).toBe('bv+ba/b');
    expect(args[args.indexOf('-S') + 1]).toBe('vcodec:h264,res:1080,acodec:aac');
    expect(args).toContain('--merge-output-format');
    // Regresi: format lama "bv*[ext=mp4]" memilih AV1 di dalam MP4
    expect(args.join(' ')).not.toContain('bv*');
  });

  it('prefers H.264 first, resolution first only above 1080p', () => {
    expect(formatSortFor('best')).toBe('vcodec:h264,res,acodec:aac');
    expect(formatSortFor('720')).toBe('vcodec:h264,res:720,acodec:aac');
    expect(formatSortFor('2160')).toBe('res:2160,vcodec:h264,acodec:aac');
    expect(formatSortFor('evil')).toBe('vcodec:h264,res,acodec:aac');
  });

  it('falls back to progressive H.264 formats without ffmpeg', () => {
    const args = buildDownloadArgs({ ...base, format: 'mp4', quality: '720', hasFfmpeg: false });
    expect(args[args.indexOf('-f') + 1]).toBe('b[height<=720][vcodec^=avc1]/b[vcodec^=avc1]/b[height<=720]/b');
    expect(args).not.toContain('--merge-output-format');
  });

  it('extracts mp3 only when ffmpeg exists', () => {
    expect(buildDownloadArgs({ ...base, format: 'mp3', quality: 'best', hasFfmpeg: true })).toContain('--audio-format');
    expect(buildDownloadArgs({ ...base, format: 'mp3', quality: 'best', hasFfmpeg: false })).not.toContain('-x');
  });

  it('ignores unknown quality values', () => {
    const args = buildDownloadArgs({ ...base, format: 'mp4', quality: '9999; rm', hasFfmpeg: true });
    expect(args[args.indexOf('-f') + 1]).not.toContain('height');
  });
});

describe('local downloader: playable MP4', () => {
  it('keeps H.264 4:2:0 + AAC untouched', () => {
    expect(compatibilityPlan({ videoCodec: 'h264', pixFmt: 'yuv420p', audioCodec: 'aac' })).toBe('none');
  });
  it('re-encodes AV1/VP9 and non-4:2:0 H.264 video', () => {
    expect(compatibilityPlan({ videoCodec: 'av1', pixFmt: 'yuv420p', audioCodec: 'aac' })).toBe('full');
    expect(compatibilityPlan({ videoCodec: 'vp9', pixFmt: 'yuv420p', audioCodec: 'opus' })).toBe('full');
    expect(compatibilityPlan({ videoCodec: 'h264', pixFmt: 'yuv444p', audioCodec: 'aac' })).toBe('full');
  });
  it('only converts audio when video is already H.264', () => {
    expect(compatibilityPlan({ videoCodec: 'h264', pixFmt: 'yuv420p', audioCodec: 'opus' })).toBe('audio');
  });
  it('builds ffmpeg arguments', () => {
    const full = buildTranscodeArgs('in.webm', 'out.mp4', 'full', 'opus');
    expect(full).toEqual(expect.arrayContaining(['libx264', 'yuv420p', 'aac', '+faststart']));
    const audio = buildTranscodeArgs('in.mp4', 'out.mp4', 'audio', 'opus');
    expect(audio[audio.indexOf('-c:v') + 1]).toBe('copy');
    expect(audio[audio.indexOf('-c:a') + 1]).toBe('aac');
    expect(audio[audio.length - 1]).toBe('out.mp4');
  });
});

describe('local downloader: file placement', () => {
  it('never overwrites existing files', () => {
    const existing = new Set(['/dl/a.mp4', '/dl/a (1).mp4']);
    expect(uniqueTarget('/dl', 'a.mp4', (p: string) => existing.has(p))).toBe('/dl/a (2).mp4');
    expect(uniqueTarget('/dl', 'b.mp3', (p: string) => existing.has(p))).toBe('/dl/b.mp3');
  });
});

describe('local downloader: output parsing', () => {
  it('parses progress lines', () => {
    expect(parseLine('@@P 500 1000 NA 2048.5 3')).toEqual({ type: 'progress', downloaded: 500, total: 1000, percent: 50, speed: 2048.5, eta: 3 });
    expect(parseLine('@@P 500 NA 2000 NA NA')?.percent).toBe(25);
  });

  it('parses title, final file, post-processing and errors', () => {
    expect(parseLine('@@T Judul Video')).toEqual({ type: 'title', title: 'Judul Video' });
    expect(parseLine('@@F /dl/Judul [x].mp4')).toEqual({ type: 'file', filepath: '/dl/Judul [x].mp4' });
    expect(parseLine('[Merger] Merging formats into "a.mp4"')).toEqual({ type: 'processing' });
    expect(parseLine('ERROR: [youtube] x: Video unavailable')).toEqual({ type: 'error', message: '[youtube] x: Video unavailable' });
    expect(parseLine('[youtube] Extracting URL')).toBeNull();
    expect(parseLine('ERROR: Unable to download; please report this issue on https://github.com/yt-dlp/yt-dlp/issues')).toEqual({
      type: 'error',
      message: 'Unable to download',
    });
  });

  it('summarizes video info', () => {
    const info = summarizeInfo({
      id: 'x',
      title: 'T',
      uploader: 'U',
      duration: 61,
      formats: [
        { vcodec: 'avc1', height: 720 },
        { vcodec: 'none', height: null },
        { vcodec: 'vp9', height: 1080 },
        { vcodec: 'avc1', height: 720 },
      ],
    });
    expect(info).toMatchObject({ id: 'x', channel: 'U', duration: 61, heights: [1080, 720] });
  });
});
