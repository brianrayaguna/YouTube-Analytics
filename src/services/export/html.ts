// Laporan HTML satu-file (bisa dibuka offline, dibagikan, atau dicetak ke PDF dengan Unicode penuh)

import { Report, METHODOLOGY, GRADE_COLORS, APP_NAME, sourceLabel, formatDateId } from './reportModel';
import { ThumbImage } from './thumbnails';
import { formatNumber, formatFullNumber } from '../../lib/format';

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const gradeBadge = (g: string, score: number) =>
  `<span class="grade" style="background:#${GRADE_COLORS[g as keyof typeof GRADE_COLORS]}">${g}</span><span class="score">${score}</span>`;

export const buildHtml = (report: Report, thumbs: Map<string, ThumbImage> | null, avatar?: ThumbImage): Blob => {
  const { context: ctx, summary: s, rows } = report;
  const ch = ctx.channelStats;
  const top = [...rows].sort((a, b) => b.views - a.views).slice(0, 30);
  const maxViews = Math.max(1, ...top.map(r => r.views));

  const kpis: Array<[string, string, string?]> = [
    ['Video dianalisis', formatFullNumber(s.totalVideos), `${s.long} video • ${s.shorts} Shorts`],
    ['Total views', formatNumber(s.totalViews), `rata-rata ${formatNumber(s.avgViews)} • median ${formatNumber(s.medianViews)}`],
    ['Engagement rate', `${s.avgEngagementRate.toFixed(2)}%`, `${formatNumber(s.totalLikes)} likes • ${formatNumber(s.totalComments)} komentar`],
    ['Outlier', String(s.outliers), 'views ≥ 3× median'],
    ['Skor judul', String(s.avgTitleScore), 'rata-rata dari 100'],
    ['Skor thumbnail', String(s.avgThumbnailScore), 'rata-rata dari 100'],
  ];
  if (ch && !ch.hiddenSubscriberCount) kpis.unshift(['Subscriber', formatNumber(ch.subCountRaw), `${formatNumber(ch.viewCountRaw ?? 0)} total views channel`]);

  const imgSrc = (id: string, fallback: string) => thumbs?.get(id)?.dataUrl ?? fallback;

  const html = `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(ctx.title)} — Laporan ${esc(APP_NAME)}</title>
<style>
:root{--bg:#fff;--fg:#0f0f0f;--muted:#606060;--line:#e5e5e5;--chip:#f2f2f2;--red:#ff0000;--blue:#065fd4}
@media (prefers-color-scheme:dark){:root{--bg:#0f0f0f;--fg:#f1f1f1;--muted:#aaa;--line:#333;--chip:#272727;--blue:#3ea6ff}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.5 Roboto,Arial,sans-serif}
.wrap{max-width:1200px;margin:0 auto;padding:32px 24px 64px}
header{display:flex;gap:20px;align-items:center;border-bottom:1px solid var(--line);padding-bottom:24px}
.logo{display:flex;align-items:center;gap:6px;font-weight:700;font-size:13px;color:var(--muted);margin-bottom:6px}
.avatar{width:88px;height:88px;border-radius:50%;object-fit:cover;flex:none;background:var(--chip)}
h1{margin:0;font-size:28px;line-height:1.2}h2{font-size:18px;margin:36px 0 12px}
.meta{color:var(--muted);margin-top:4px}
.kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px;margin-top:24px}
.kpi{border:1px solid var(--line);border-radius:12px;padding:14px 16px}.kpi b{display:block;font-size:24px;font-weight:500;margin-top:4px}
.kpi span{color:var(--muted);font-size:12px}.kpi small{color:var(--muted);font-size:11px}
.bars{border:1px solid var(--line);border-radius:12px;padding:16px}
.bar{display:grid;grid-template-columns:minmax(0,1fr) 120px;gap:12px;align-items:center;margin:4px 0;font-size:12px}
.bar i{display:block;height:8px;border-radius:4px;background:var(--blue)}.bar i.o{background:var(--red)}
.bar .t{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.bar .v{text-align:right;color:var(--muted)}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}@media(max-width:800px){.grid2{grid-template-columns:1fr}}
.card{border:1px solid var(--line);border-radius:12px;padding:16px}
table{width:100%;border-collapse:collapse;font-size:13px}th{position:sticky;top:0;background:var(--fg);color:var(--bg);text-align:left;font-weight:500;padding:8px;font-size:12px}
td{padding:8px;border-bottom:1px solid var(--line);vertical-align:middle}tr:nth-child(even) td{background:color-mix(in srgb,var(--chip) 50%,transparent)}
td.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.thumb{width:128px;aspect-ratio:16/9;object-fit:cover;border-radius:8px;display:block;background:var(--chip)}
a{color:var(--blue);text-decoration:none}a:hover{text-decoration:underline}
.vt{font-weight:500;color:var(--fg)}.sub{color:var(--muted);font-size:12px}
.grade{display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;border-radius:6px;color:#fff;font-weight:700;font-size:12px;margin-right:6px}
.score{font-variant-numeric:tabular-nums}
.chip{display:inline-block;background:var(--chip);border-radius:6px;padding:1px 6px;font-size:11px;margin:1px}.out{background:#ff00001a;color:#cc0000}
.tags{display:flex;flex-wrap:wrap;gap:6px}.tags span{background:var(--chip);border-radius:8px;padding:4px 10px;font-size:12px}
dl{display:grid;grid-template-columns:200px 1fr;gap:6px 16px;margin:0}dt{font-weight:500}dd{margin:0;color:var(--muted)}
footer{margin-top:40px;color:var(--muted);font-size:12px;border-top:1px solid var(--line);padding-top:16px}
@media print{body{font-size:11px}.wrap{padding:0}th{position:static}.thumb{width:96px}tr{break-inside:avoid}h2{break-after:avoid}}
</style>
</head>
<body><div class="wrap">
<header>
  ${avatar ? `<img class="avatar" src="${avatar.dataUrl}" alt="">` : ''}
  <div>
    <div class="logo"><svg width="22" height="16" viewBox="0 0 28 20"><rect width="28" height="20" rx="5.5" fill="#f00"/><path d="M11.2 5.6v8.8l7.6-4.4z" fill="#fff"/></svg>${esc(APP_NAME)} • Laporan analisis</div>
    <h1>${esc(ctx.title)}</h1>
    <div class="meta">${esc(sourceLabel(ctx))}${ch?.customUrl ? ` • ${esc(ch.customUrl)}` : ''} • ${formatFullNumber(s.totalVideos)} video • upload ${esc(formatDateId(s.firstPublished))} – ${esc(formatDateId(s.lastPublished))} • dibuat ${esc(formatDateId(ctx.generatedAt, true))}${ctx.scopeNote ? ` • ${esc(ctx.scopeNote)}` : ''}</div>
  </div>
</header>

<section class="kpis">${kpis.map(([l, v, h]) => `<div class="kpi"><span>${esc(l)}</span><b>${esc(v)}</b>${h ? `<small>${esc(h)}</small>` : ''}</div>`).join('')}</section>

<h2>Video dengan views tertinggi</h2>
<div class="bars">${top
    .map(r => `<div class="bar"><div><div class="t" title="${esc(r.title)}">${r.no}. ${esc(r.title)}</div><i class="${r.isOutlier ? 'o' : ''}" style="width:${((r.views / maxViews) * 100).toFixed(1)}%"></i></div><div class="v">${formatFullNumber(r.views)}</div></div>`)
    .join('')}</div>

<div class="grid2" style="margin-top:16px">
  <div class="card"><h2 style="margin-top:0">Format konten</h2>${s.formats
    .map(f => `<p><b>${f.type}</b> — ${f.count} video • rata-rata ${formatNumber(f.avgViews)} views • ER ${f.avgEngagementRate}%</p>`)
    .join('')}<p class="sub">Upload ±${s.uploadsPerWeek} video per minggu.</p></div>
  <div class="card"><h2 style="margin-top:0">Distribusi nilai</h2><table><tr><th>Nilai</th><th>Judul</th><th>Thumbnail</th></tr>${(['A', 'B', 'C', 'D', 'F'] as const)
    .map(g => `<tr><td>${gradeBadge(g, 0).replace('<span class="score">0</span>', '')}</td><td class="n">${s.titleGrades[g]}</td><td class="n">${s.thumbnailGrades[g]}</td></tr>`)
    .join('')}</table></div>
</div>

${s.topTags.length ? `<h2>Tag paling sering</h2><div class="tags">${s.topTags.slice(0, 30).map(t => `<span>${esc(t.tag)} · ${t.count}×</span>`).join('')}</div>` : ''}

<h2>Semua video (${formatFullNumber(rows.length)})</h2>
<div style="overflow-x:auto"><table>
<thead><tr><th>#</th><th>Thumbnail</th><th>Video</th><th>Views</th><th>Likes</th><th>Komentar</th><th>ER</th><th>Views/hari</th><th>Judul</th><th>Thumbnail</th></tr></thead>
<tbody>${rows
    .map(
      r => `<tr><td class="n">${r.no}</td><td><a href="${esc(r.url)}" target="_blank" rel="noopener"><img class="thumb" loading="lazy" src="${esc(imgSrc(r.id, r.thumbnails.medium))}" alt=""></a></td>
<td><a class="vt" href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a><div class="sub">${r.type} • ${esc(r.duration)} • ${esc(formatDateId(r.publishedAt))}${r.isOutlier ? ' <span class="chip out">Outlier</span>' : ''}</div></td>
<td class="n">${formatFullNumber(r.views)}</td><td class="n">${r.likes === null ? '—' : formatFullNumber(r.likes)}</td><td class="n">${r.comments === null ? '—' : formatFullNumber(r.comments)}</td>
<td class="n">${r.engagementRate === null ? '—' : `${r.engagementRate.toFixed(2)}%`}</td><td class="n">${formatFullNumber(r.viewsPerDay)}</td>
<td class="n">${gradeBadge(r.titleGrade, r.titleScore)}</td><td class="n">${gradeBadge(r.thumbnailGrade, r.thumbnailScore)}</td></tr>`
    )
    .join('')}</tbody></table></div>

<h2>Metodologi</h2>
<dl>${METHODOLOGY.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>

<footer>Dibuat dengan ${esc(APP_NAME)} dari data publik YouTube Data API v3 pada ${esc(formatDateId(ctx.generatedAt, true))}. Gunakan Ctrl/⌘+P untuk menyimpan sebagai PDF.</footer>
</div></body></html>`;
  return new Blob([html], { type: 'text/html;charset=utf-8' });
};
