// Laporan HTML satu-file (bisa dibuka offline, dibagikan, atau dicetak ke PDF dengan Unicode penuh)

import { Report, ReportSchedule, ScheduleRow, METHODOLOGY, GRADE_COLORS, APP_NAME, sourceLabel, formatDateId, performanceRgb } from './reportModel';
import { ThumbImage } from './thumbnails';
import { formatNumber, formatFullNumber } from '../../lib/format';

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const gradeBadge = (g: string, score: number) =>
  `<span class="grade" style="background:#${GRADE_COLORS[g as keyof typeof GRADE_COLORS]}">${g}</span><span class="score">${score}</span>`;

const rgb = (p: number | null) => `rgb(${performanceRgb(p).join(',')})`;
const perf = (p: number) => `${p.toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}×`;

const GROUP_TABS: Array<[keyof ReportSchedule['groups'], string]> = [
  ['day', 'Hari'],
  ['daypart', 'Bagian hari'],
  ['block', 'Blok 3 jam'],
  ['hour', 'Jam'],
];

const scheduleHtml = (sc: ReportSchedule) => {
  const groupTable = (rows: ScheduleRow[]) => {
    const max = Math.max(1, ...rows.map(r => r.performance));
    return `<div style="overflow-x:auto"><table class="gt"><thead><tr><th>Waktu</th><th>Upload</th><th>Median views</th><th style="width:34%">Performa</th><th>Keyakinan</th><th>Peringkat</th></tr></thead><tbody>${rows
      .map(
        r => `<tr${r.rank ? '' : ' class="dim"'}><td><b>${esc(r.label)}</b></td><td class="n">${r.uploads}</td><td class="n">${formatFullNumber(r.medianViews)}</td>
<td><div class="pbar"><i style="width:${((r.performance / max) * 100).toFixed(1)}%;background:${r.performance >= 1 ? 'var(--blue)' : 'var(--red)'}"></i><span>${perf(r.performance)}</span></div></td>
<td><span class="conf ${r.confidence}">${r.confidence}</span></td><td class="n">${r.rank ?? '–'}</td></tr>`
      )
      .join('')}</tbody></table></div>`;
  };
  const slotList = (title: string, list: ReportSchedule['bestSlots'], good: boolean) =>
    `<div class="card"><h3>${title}</h3>${
      list.length
        ? `<ol class="slots">${list
            .map(
              sl => `<li><span class="dot ${good ? 'up' : 'down'}">${good ? '▲' : '▼'}</span><div><b>${esc(sl.day)}, ${esc(sl.time)}</b><div class="sub">${sl.uploads} upload • median ${formatNumber(sl.medianViews)} views • <span class="conf ${sl.confidence}">${sl.confidence}</span></div></div><b class="pv">${perf(sl.performance)}</b></li>`
            )
            .join('')}</ol>`
        : '<p class="sub">Data belum cukup — butuh minimal 2 upload per blok 3 jam.</p>'
    }</div>`;
  const kpi = (label: string, value: string, hint: string) => `<div class="kpi"><span>${esc(label)}</span><b class="blue">${esc(value)}</b><small>${esc(hint)}</small></div>`;

  return `<h2 id="jadwal">Jadwal upload</h2>
<p class="sub">${formatFullNumber(sc.totalVideos)} video • waktu dalam zona ${esc(sc.timeZone)} (${esc(sc.utcOffset)}). Performa = views dibanding perkiraan views video seusia (1,0× = rata-rata).</p>
<section class="kpis">
${kpi('Hari terbaik', sc.bestDay?.day ?? '-', sc.bestDay ? `${perf(sc.bestDay.performance)} • ${sc.bestDay.uploads} upload` : 'data belum cukup')}
${kpi('Jam terbaik', sc.bestHour?.hour ?? '-', sc.bestHour ? `${perf(sc.bestHour.performance)} • ${sc.bestHour.uploads} upload` : 'data belum cukup')}
${kpi('Slot 3 jam terbaik', sc.bestSlots[0] ? `${sc.bestSlots[0].day} ${sc.bestSlots[0].time}` : '-', sc.bestSlots[0] ? `${perf(sc.bestSlots[0].performance)} • keyakinan ${sc.bestSlots[0].confidence}` : 'data belum cukup')}
${kpi('Paling sering upload', sc.busiestDay?.day ?? '-', sc.busiestDay ? `${sc.busiestDay.uploads} upload` : '')}
</section>
${sc.recommendation ? `<p class="tip">💡 ${esc(sc.recommendation)}</p>` : ''}
<div class="card" style="margin-top:16px"><h3>Peta panas hari × jam</h3>
<div style="overflow-x:auto"><div class="heat">
<div></div>${Array.from({ length: 24 }, (_, h) => `<div class="hh">${h % 3 === 0 ? String(h).padStart(2, '0') : ''}</div>`).join('')}
${sc.heatmap.days
    .map(
      (day, di) =>
        `<div class="hd">${esc(day.slice(0, 3))}</div>${sc.heatmap.uploads[di]
          .map((n, h) => {
            const p = sc.heatmap.performance[di][h];
            return `<div class="hc${n ? '' : ' e'}" style="background:${n ? rgb(p) : 'var(--chip)'}" title="${esc(day)} ${String(h).padStart(2, '0')}.00 — ${n} upload${p !== null ? `, performa ${perf(p)}` : ''}">${n || ''}</div>`;
          })
          .join('')}`
    )
    .join('')}
</div></div>
<p class="sub" style="margin-bottom:0">Angka = jumlah upload. <span class="sw" style="background:${rgb(0.4)}"></span> di bawah rata-rata <span class="sw" style="background:${rgb(1)}"></span> rata-rata <span class="sw" style="background:${rgb(2.5)}"></span> di atas rata-rata</p></div>
<div class="grid2" style="margin-top:16px">${slotList('Slot 3 jam terbaik', sc.bestSlots, true)}${slotList('Slot 3 jam terendah', sc.worstSlots, false)}</div>
<div class="card" style="margin-top:16px"><h3>Peringkat waktu upload</h3>
<div class="tabs" role="tablist">${GROUP_TABS.map(([k, label], i) => `<button type="button" role="tab" data-g="${k}" aria-selected="${i === 0}">${label}</button>`).join('')}</div>
${GROUP_TABS.map(([k], i) => `<div class="gpanel" data-g="${k}"${i === 0 ? '' : ' hidden'}>${groupTable(sc.groups[k])}</div>`).join('')}
<p class="sub">Baris pudar = kurang dari 2 upload (belum diperingkat).</p></div>
<script>document.querySelectorAll('.tabs button').forEach(function(b){b.addEventListener('click',function(){var g=b.getAttribute('data-g');document.querySelectorAll('.tabs button').forEach(function(x){x.setAttribute('aria-selected',String(x===b))});document.querySelectorAll('.gpanel').forEach(function(p){p.hidden=p.getAttribute('data-g')!==g})})});</script>`;
};

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
h3{font-size:15px;margin:0 0 12px}.blue{color:var(--blue)}
.tip{background:color-mix(in srgb,var(--blue) 12%,transparent);border-radius:12px;padding:12px 16px;margin:16px 0 0}
.heat{display:grid;grid-template-columns:40px repeat(24,minmax(22px,1fr));gap:3px;min-width:640px}
.hh{font-size:10px;color:var(--muted);text-align:center}.hd{font-size:12px;color:var(--muted);display:flex;align-items:center}
.hc{aspect-ratio:1;border-radius:3px;font-size:10px;display:flex;align-items:center;justify-content:center;color:#0f0f0f}
.sw{display:inline-block;width:12px;height:12px;border-radius:3px;vertical-align:-2px;margin:0 2px 0 8px}
.slots{list-style:none;margin:0;padding:0}.slots li{display:flex;gap:12px;align-items:center;padding:8px 0;border-bottom:1px solid var(--line)}.slots li:last-child{border:0}
.slots li>div{flex:1}.pv{font-variant-numeric:tabular-nums}
.dot{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;flex:none}.dot.up{background:#0b80431f;color:#0b8043}.dot.down{background:#cc00001a;color:#cc0000}
.conf{display:inline-block;border-radius:4px;padding:0 6px;font-size:11px;font-weight:500;background:var(--chip);color:var(--muted)}.conf.tinggi{background:#0b80431f;color:#0b8043}.conf.sedang{background:#e8710a1f;color:#e8710a}
.pbar{display:flex;align-items:center;gap:8px}.pbar i{display:block;height:8px;border-radius:4px;flex:none;max-width:calc(100% - 56px)}.pbar span{font-variant-numeric:tabular-nums;font-size:12px}
tr.dim td{opacity:.55}.gt{min-width:600px}.gt td:first-child{white-space:nowrap}
.tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}.tabs button{border:0;border-radius:8px;padding:6px 12px;background:var(--chip);color:var(--fg);font:500 13px Roboto,Arial,sans-serif;cursor:pointer}
.tabs button[aria-selected=true]{background:var(--fg);color:var(--bg)}
@media print{.tabs{display:none}.gpanel[hidden]{display:block!important}.gpanel{margin-bottom:12px}}
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

${scheduleHtml(report.schedule)}

${s.topTags.length ? `<h2>Tag paling sering</h2><div class="tags">${s.topTags.slice(0, 30).map(t => `<span>${esc(t.tag)} · ${t.count}×</span>`).join('')}</div>` : ''}

<h2>Semua video (${formatFullNumber(rows.length)})</h2>
<div style="overflow-x:auto"><table>
<thead><tr><th>#</th><th>Thumbnail</th><th>Video</th><th>Views</th><th>Likes</th><th>Komentar</th><th>ER</th><th>Views/hari</th><th>Judul</th><th>Thumbnail</th></tr></thead>
<tbody>${rows
    .map(
      r => `<tr><td class="n">${r.no}</td><td><a href="${esc(r.url)}" target="_blank" rel="noopener"><img class="thumb" loading="lazy" src="${esc(imgSrc(r.id, r.thumbnails.medium))}" alt=""></a></td>
<td><a class="vt" href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a><div class="sub">${r.type} • ${esc(r.duration)} • ${esc(formatDateId(r.publishedAt))} (${esc(r.uploadDay)} ${esc(r.uploadHour)})${r.isOutlier ? ' <span class="chip out">Outlier</span>' : ''}</div></td>
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
