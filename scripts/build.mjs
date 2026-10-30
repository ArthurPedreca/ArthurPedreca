// Builds the profile images and data from the public contribution calendar.
// Usage: node scripts/build.mjs            (fetches github.com)
//        FIXTURE=data/fixture.json node scripts/build.mjs   (offline)
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import fonts from './fonts.mjs';
import metrics from './metrics.mjs';
import config from '../config.mjs';

const W = 840;
const PAD = 30;

// ---------- data ----------
async function loadDays() {
  if (process.env.FIXTURE) return JSON.parse(await readFile(process.env.FIXTURE, 'utf8'));
  const res = await fetch(`https://github.com/users/${config.user}/contributions`, {
    headers: { 'user-agent': 'profile-status-builder' },
  });
  if (!res.ok) throw new Error(`calendar ${res.status}`);
  const html = await res.text();
  const tips = {};
  for (const m of html.matchAll(/<tool-tip\b[^>]*\bfor="([^"]+)"[^>]*>([^<]*)<\/tool-tip>/g)) tips[m[1]] = m[2].trim();
  const days = [];
  for (const m of html.matchAll(/<td\b([^>]*class="ContributionCalendar-day"[^>]*)>/g)) {
    const a = m[1];
    const date = a.match(/data-date="([^"]+)"/)?.[1];
    const id = a.match(/\bid="([^"]+)"/)?.[1];
    if (!date) continue;
    const t = tips[id] || '';
    const c = t.match(/^(\d[\d,]*|No) contribution/);
    days.push({ date, count: c ? (c[1] === 'No' ? 0 : Number(c[1].replace(/,/g, ''))) : 0 });
  }
  days.sort((x, y) => (x.date < y.date ? -1 : 1));
  const total = Number((html.match(/([\d,]+)\s+contributions?\s+in the last year/) || [])[1]?.replace(/,/g, '')) ||
    days.reduce((s, d) => s + d.count, 0);
  if (days.length < 300) throw new Error(`calendar parse looks wrong (${days.length} days)`);
  return { total, days };
}

// ---------- text helpers ----------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function measure(text, font, size) {
  const m = metrics[font];
  let w = 0;
  for (const ch of text) w += (m[ch] ?? 0.55) * size;
  return w;
}
function wrap(text, font, size, max) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (measure(next, font, size) > max && line) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}
const fmt = (n) => n.toLocaleString('en-US');

// ---------- themes ----------
const THEMES = {
  light: {
    bg: '#fbfbfa', border: '#e4e4e1', text: '#1b1d1f', muted: '#5f6469', faint: '#8f9499', line: '#ececea',
    green: '#1a7f45', greenSoft: '#e5f3ea', blue: '#2557a7', blueSoft: '#e8eef8', banner: '#1f8a4c', bannerText: '#ffffff', amber: '#b7791f',
    bars: ['#e4e5e2', '#c4e6d0', '#86cfa1', '#3fae6c', '#1a7f45'], logoBg: '#16181a', logoText: '#fbfbfa',
  },
  dark: {
    bg: '#0f1318', border: '#262c36', text: '#e6edf3', muted: '#a0a8b2', faint: '#6e7681', line: '#1f252d',
    green: '#3fb871', greenSoft: '#12261b', blue: '#79a8f0', blueSoft: '#152238', banner: '#1f7a45', bannerText: '#ffffff', amber: '#d69e2e',
    bars: ['#1d232b', '#1b4430', '#22663f', '#2f9257', '#46c07a'], logoBg: '#e6edf3', logoText: '#0f1318',
  },
};

function fontFaces(keys) {
  const fam = { sans400: ['Plex', 400], sans500: ['Plex', 500], sans600: ['Plex', 600], mono400: ['PlexMono', 400], mono500: ['PlexMono', 500] };
  return keys.map((k) => `@font-face{font-family:${fam[k][0]};font-weight:${fam[k][1]};src:url(data:font/woff2;base64,${fonts[k]}) format('woff2')}`).join('');
}

function svg(h, body, css, title) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title>
<style>${fontFaces(['sans400', 'sans500', 'sans600', 'mono400', 'mono500'])}
.s{font-family:Plex,-apple-system,'Segoe UI',sans-serif}.m{font-family:PlexMono,ui-monospace,Menlo,monospace}
${css}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
</style>
${body}
</svg>`;
}

const card = (t, h) => `<rect x="0.5" y="0.5" width="${W - 1}" height="${h - 1}" rx="12" fill="${t.bg}" stroke="${t.border}"/>`;

// ---------- status card ----------
function statusSVG(t, data, now) {
  const last = data.days.slice(-90);
  const active = last.filter((d) => d.count > 0).length;
  const sum90 = last.reduce((s, d) => s + d.count, 0);
  const nz = last.map((d) => d.count).filter(Boolean).sort((a, b) => a - b);
  const q = (p) => nz[Math.min(nz.length - 1, Math.floor(p * nz.length))] || 1;
  const cuts = [q(0.25), q(0.5), q(0.75)];
  const level = (c) => (c === 0 ? 0 : c <= cuts[0] ? 1 : c <= cuts[1] ? 2 : c <= cuts[2] ? 3 : 4);

  const H = 318;
  const busy = !config.available;
  const bannerFill = busy ? t.amber : t.banner;
  const bannerTitle = busy ? 'Partial capacity' : 'All systems operational';
  const bannerNote = busy ? config.busyNote : config.availableNote;
  const nameW = measure(config.name, 'sans600', 16);
  const updated = now.toLocaleString('en-GB', { timeZone: config.timezone, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });

  const bx = PAD, bw = W - PAD * 2, gap = 2.2, n = 90;
  const barW = (bw - gap * (n - 1)) / n;
  let bars = '';
  last.forEach((d, i) => {
    const x = bx + i * (barW + gap);
    bars += `<rect class="b" style="animation-delay:${(i * 9)}ms" x="${x.toFixed(2)}" y="172" width="${barW.toFixed(2)}" height="36" rx="1.6" fill="${t.bars[level(d.count)]}"><title>${d.date}: ${d.count} contribution${d.count === 1 ? '' : 's'}</title></rect>`;
  });

  const body = `${card(t, H)}
<rect x="${PAD}" y="28" width="30" height="30" rx="7" fill="${t.logoBg}"/>
<text class="m" x="${PAD + 15}" y="47.5" text-anchor="middle" font-size="13" font-weight="500" fill="${t.logoText}" letter-spacing="-0.5">ap</text>
<text class="s" x="${PAD + 42}" y="48.5" font-size="16" font-weight="600" fill="${t.text}">${esc(config.name)}</text>
<text class="s" x="${PAD + 42 + nameW + 8}" y="48.5" font-size="16" fill="${t.faint}">/ status</text>
<text class="m" x="${W - PAD}" y="47.5" text-anchor="end" font-size="11.5" fill="${t.faint}">updated ${esc(updated)} · São Paulo</text>

<rect x="${PAD}" y="76" width="${W - PAD * 2}" height="50" rx="8" fill="${bannerFill}"/>
<circle class="pulse" cx="${PAD + 26}" cy="101" r="10" fill="none" stroke="#ffffff" stroke-opacity=".55"/>
<circle cx="${PAD + 26}" cy="101" r="10" fill="#ffffff"/>
<path d="M${PAD + 21.5} 101.2l3.2 3.2 6-6.4" fill="none" stroke="${bannerFill}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
<text class="s" x="${PAD + 46}" y="106.5" font-size="16.5" font-weight="600" fill="${t.bannerText}">${bannerTitle}</text>
<text class="m" x="${W - PAD - 16}" y="105.5" text-anchor="end" font-size="11.5" fill="${t.bannerText}" fill-opacity=".9">${esc(bannerNote)}</text>

<text class="s" x="${PAD}" y="158" font-size="14" font-weight="500" fill="${t.text}">Shipping activity<tspan fill="${t.faint}" font-weight="400"> · commits, pull requests and reviews</tspan></text>
<text class="s" x="${W - PAD}" y="158" text-anchor="end" font-size="12.5" font-weight="500" fill="${t.green}">${active} of 90 days active</text>
${bars}
<text class="m" x="${PAD}" y="228" font-size="10.5" fill="${t.faint}">90 days ago</text>
<text class="m" x="${W / 2}" y="228" text-anchor="middle" font-size="10.5" fill="${t.faint}">${fmt(sum90)} contributions in this window</text>
<text class="m" x="${W - PAD}" y="228" text-anchor="end" font-size="10.5" fill="${t.faint}">today</text>
<line x1="${PAD}" x2="${W - PAD}" y1="252" y2="252" stroke="${t.line}"/>
<circle cx="${PAD + 4}" cy="281" r="4" fill="${t.green}"/>
<text class="m" x="${PAD + 15}" y="285" font-size="11.5" fill="${t.muted}"><tspan fill="${t.text}" font-weight="500">São Paulo</tspan> · UTC−3</text>
<text class="m" x="${PAD + 200}" y="285" font-size="11.5" fill="${t.muted}">replies in <tspan fill="${t.text}" font-weight="500">&lt; 24h</tspan></text>
<text class="m" x="${PAD + 360}" y="285" font-size="11.5" fill="${t.muted}"><tspan fill="${t.text}" font-weight="500">${fmt(data.total)}</tspan> contributions in the last year</text>
<text class="m" x="${W - PAD}" y="285" text-anchor="end" font-size="11.5" fill="${t.muted}">PT · EN</text>`;

  const css = `.b{transform-box:fill-box;transform-origin:50% 100%;animation:up .6s cubic-bezier(.2,.7,.2,1) both}
@keyframes up{from{transform:scaleY(.08);opacity:0}}
.pulse{transform-box:fill-box;transform-origin:center;animation:pulse 2.4s ease-out infinite}
@keyframes pulse{0%{transform:scale(1);opacity:.9}100%{transform:scale(1.9);opacity:0}}`;
  return { svg: svg(H, body, css, `${config.name} status: ${bannerTitle}. ${active} of the last 90 days active.`), active, sum90 };
}

// ---------- services card ----------
function servicesSVG(t) {
  const rowH = 50, top = 60;
  const H = top + config.services.length * rowH + 14;
  let rows = '';
  config.services.forEach((s, i) => {
    const y = top + i * rowH;
    const nW = measure(s.name, 'sans500', 14);
    const color = s.status === 'In production' ? t.blue : s.status === 'In development' ? t.amber : t.green;
    rows += `${i ? `<line x1="${PAD}" x2="${W - PAD}" y1="${y}" y2="${y}" stroke="${t.line}"/>` : ''}
<text class="s" x="${PAD}" y="${y + 30}" font-size="14" font-weight="500" fill="${t.text}">${esc(s.name)}</text>
<text class="s" x="${PAD + nW + 8}" y="${y + 30}" font-size="13.5" fill="${t.faint}">${esc(s.detail)}</text>
<text class="m" x="${W - PAD - 170}" y="${y + 30}" text-anchor="end" font-size="11.5" fill="${t.faint}">${esc(s.note)}</text>
<circle cx="${W - PAD - 150}" cy="${y + 26}" r="4" fill="${color}"/>
<text class="s" x="${W - PAD - 140}" y="${y + 30}" font-size="13" font-weight="500" fill="${color}">${esc(s.status)}</text>`;
  });
  const body = `${card(t, H)}
<text class="s" x="${PAD}" y="38" font-size="13" font-weight="600" fill="${t.text}" letter-spacing=".2">Components</text>
<text class="m" x="${W - PAD}" y="38" text-anchor="end" font-size="11" fill="${t.faint}">full catalog on Upwork →</text>
<line x1="${PAD}" x2="${W - PAD}" y1="${top}" y2="${top}" stroke="${t.line}"/>
${rows}`;
  return svg(H, body, '', 'Services: ' + config.services.map((s) => `${s.name} (${s.status})`).join(', '));
}

// ---------- history card (incidents and releases) ----------
function incidentSVG(t, inc, first) {
  const release = inc.kind === 'release';
  const tag = release ? 'SHIPPED' : 'RESOLVED';
  const tagFg = release ? t.blue : t.green;
  const tagBg = release ? t.blueSoft : t.greenSoft;
  const tagW = measure(tag, 'mono500', 10) + 16 + tag.length * 0.6;
  const head = first ? 46 : 0;
  const x2 = PAD + 96;
  const lines = wrap(inc.summary, 'sans400', 13, W - x2 - PAD);
  const H = head + 34 + 22 + lines.length * 19 + 46;
  const tW = measure(inc.title, 'sans500', 15);
  const y0 = head + 34;
  const body = `${card(t, H)}
${first ? `<text class="s" x="${PAD}" y="36" font-size="13" font-weight="600" fill="${t.text}" letter-spacing=".2">History</text><line x1="${PAD}" x2="${W - PAD}" y1="${head + 8}" y2="${head + 8}" stroke="${t.line}"/>` : ''}
<text class="m" x="${PAD}" y="${y0 + 8}" font-size="11.5" fill="${t.faint}">${esc(inc.date)}</text>
<text class="s" x="${x2}" y="${y0 + 8}" font-size="15" font-weight="500" fill="${t.text}">${esc(inc.title)}</text>
<rect x="${x2 + tW + 10}" y="${y0 - 6}" width="${tagW.toFixed(1)}" height="19" rx="4" fill="${tagBg}"/>
<text class="m" x="${(x2 + tW + 10 + tagW / 2).toFixed(1)}" y="${y0 + 7.5}" text-anchor="middle" font-size="10" font-weight="500" fill="${tagFg}" letter-spacing=".6">${tag}</text>
${lines.map((l, i) => `<text class="s" x="${x2}" y="${y0 + 32 + i * 19}" font-size="13" fill="${t.muted}">${esc(l)}</text>`).join('\n')}
<text class="m" x="${x2}" y="${y0 + 32 + lines.length * 19 + 12}" font-size="11.5" font-weight="500" fill="${tagFg}">${release ? 'Read the release notes' : 'Read the postmortem'} →</text>`;
  return svg(H, body, '', `${release ? 'Release' : 'Resolved incident'}, ${inc.date}: ${inc.title}. ${inc.summary}`);
}

// ---------- README ----------
function readme(stamp) {
  const pic = (name, alt) => `<picture><source media="(prefers-color-scheme: dark)" srcset="assets/${name}-dark.svg"><img src="assets/${name}-light.svg" width="100%" alt="${esc(alt)}"></picture>`;
  const inc = config.incidents.map((i) => `<a href="${config.site}history/${i.slug}.html">${pic(`incident-${i.slug}`, `${i.title}. ${i.summary}`)}</a>`).join('\n\n');
  return `<!-- Generated by scripts/build.mjs. Edit config.mjs instead. -->
<a href="${config.site}">${pic('status', `${config.name} status page`)}</a>

<a href="${config.upwork}">${pic('services', 'Components: ' + config.services.map((s) => `${s.name}, ${s.status.toLowerCase()}`).join('; '))}</a>

${inc}

<p align="center">
  <a href="${config.site}">Portfolio</a> &nbsp;·&nbsp;
  <a href="${config.site}#history">History</a> &nbsp;·&nbsp;
  <a href="${config.upwork}">Hire me on Upwork</a>
</p>

<details>
<summary><sub>How this page works</sub></summary>
<br>

<sub>A GitHub Action reads my public contribution calendar every six hours and redraws these cards as SVG (light and dark), with fonts and animations inside the file. Nothing is hosted elsewhere. The banner flips to amber when I set <code>available: false</code> in <code>config.mjs</code>. Last run: ${stamp}.</sub>
</details>
`;
}

// ---------- main ----------
const data = await loadDays();
const now = new Date();
await mkdir('assets', { recursive: true });
await mkdir('data', { recursive: true });
let summary;
for (const [name, t] of Object.entries(THEMES)) {
  const st = statusSVG(t, data, now);
  summary = st;
  await writeFile(`assets/status-${name}.svg`, st.svg);
  await writeFile(`assets/services-${name}.svg`, servicesSVG(t));
  for (const [i, inc] of config.incidents.entries()) await writeFile(`assets/incident-${inc.slug}-${name}.svg`, incidentSVG(t, inc, i === 0));
}
const stamp = now.toLocaleString('en-GB', { timeZone: config.timezone, dateStyle: 'medium', timeStyle: 'short' }) + ' (São Paulo)';
await writeFile('README.md', readme(stamp));
await writeFile('data/status.json', JSON.stringify({
  updated: now.toISOString(),
  available: config.available,
  note: config.available ? config.availableNote : config.busyNote,
  totalLastYear: data.total,
  active90: summary.active,
  contributions90: summary.sum90,
  days: data.days.slice(-90),
}, null, 1));
console.log(`ok: ${data.days.length} days, ${data.total} total, ${summary.active}/90 active`);
