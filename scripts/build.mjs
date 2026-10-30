// Draws the profile cards and data from the public contribution calendar.
// Usage: node scripts/build.mjs                         (fetches github.com)
//        FIXTURE=path/to/days.json node scripts/build.mjs   (offline)
// Direction: "The dark room" — one dark field, lit things in it, no ornaments.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import fonts from './fonts.mjs';
import metrics from './metrics.mjs';
import config from '../config.mjs';

const W = 840;
const M = 36; // one pair of margins for every card
const C = { bg: '#111111', surface: '#1c1c1c', ink: '#f2f2f2', muted: '#a8a8a8', accent: '#a08672', accentInk: '#111111', lit: '#f2f2f2', litInk: '#111111' };

// ---------- data ----------
async function loadDays() {
  if (process.env.FIXTURE) return JSON.parse(await readFile(process.env.FIXTURE, 'utf8'));
  const res = await fetch(`https://github.com/users/${config.user}/contributions`, { headers: { 'user-agent': 'profile-card-builder' } });
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
    const c = (tips[id] || '').match(/^(\d[\d,]*|No) contribution/);
    days.push({ date, count: c ? (c[1] === 'No' ? 0 : Number(c[1].replace(/,/g, ''))) : 0 });
  }
  days.sort((x, y) => (x.date < y.date ? -1 : 1));
  const total = Number((html.match(/([\d,]+)\s+contributions?\s+in the last year/) || [])[1]?.replace(/,/g, '')) || days.reduce((s, d) => s + d.count, 0);
  if (days.length < 300) throw new Error(`calendar parse looks wrong (${days.length} days)`);
  return { total, days };
}

// ---------- text ----------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const measure = (text, font, size) => [...text].reduce((w, ch) => w + (metrics[font][ch] ?? 0.55) * size, 0);
function wrap(text, font, size, max) {
  const lines = []; let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (measure(next, font, size) > max && line) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}
const fmt = (n) => Number(n).toLocaleString('en-US');
const lines = (arr, x, y, lh, attrs) => arr.map((l, i) => `<text x="${x}" y="${y + i * lh}" ${attrs}>${esc(l)}</text>`).join('');

// ---------- shell ----------
function svg(h, body, title, extraCss = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${h}" width="${W}" height="${h}" role="img" aria-labelledby="t">
<title id="t">${esc(title)}</title>
<style>
@font-face{font-family:A;font-weight:400;src:url(data:font/woff2;base64,${fonts.sans400}) format("woff2")}
@font-face{font-family:A;font-weight:500;src:url(data:font/woff2;base64,${fonts.sans500}) format("woff2")}
@font-face{font-family:Mo;font-weight:400;src:url(data:font/woff2;base64,${fonts.mono400}) format("woff2")}
text{font-family:A,"Helvetica Neue",Arial,sans-serif;letter-spacing:-0.01em}
.d{letter-spacing:-0.03em}
.code{font-family:Mo,ui-monospace,Menlo,monospace;letter-spacing:0}
${extraCss}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
</style>
<rect width="${W}" height="${h}" fill="${C.bg}"/>
${body}
</svg>`;
}
const img = async (name) => `data:image/jpeg;base64,${(await readFile(new URL(`./img/${name}.jpg`, import.meta.url))).toString('base64')}`;

// ---------- 1. the first screen: two prints in darkness ----------
async function heroSVG() {
  const H = 420;
  const sent = wrap(config.sentence + (config.available ? '' : ` ${config.busyNote}`), 'sans400', 14, 176);
  const sy = H - 36 - (sent.length - 1) * 20;
  const frames = ['app', 'foxie', 'property'];
  const small = await Promise.all(frames.map(img));
  const css = `
.f{opacity:0;animation:cf 21s ease-in-out infinite}
.f1{animation-delay:0s}.f2{animation-delay:7s}.f3{animation-delay:14s}
@keyframes cf{0%{opacity:0}6%{opacity:1}33%{opacity:1}39%{opacity:0}100%{opacity:0}}
.f0{opacity:1}
.p{animation:dr 26s ease-in-out infinite alternate;transform-origin:520px 210px}
@keyframes dr{to{transform:scale(1.05)}}
.r{opacity:0;animation:up .9s cubic-bezier(.22,1,.36,1) forwards}
.r1{animation-delay:.15s}.r2{animation-delay:.3s}.r3{animation-delay:.45s}
@keyframes up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}`;
  const body = `
<text x="${M}" y="48" font-size="14" font-weight="500" fill="${C.ink}">${esc(config.name)}</text>
<rect x="${W - M - 150}" y="26" width="150" height="34" fill="${C.accent}"/>
<text x="${W - M - 75}" y="48" font-size="13" font-weight="500" fill="${C.accentInk}" text-anchor="middle">Hire me on Upwork</text>
<clipPath id="pc"><rect x="420" y="80" width="200" height="250"/></clipPath>
<g clip-path="url(#pc)" class="r r1"><image class="p" href="${await img('portrait')}" x="420" y="80" width="200" height="250" preserveAspectRatio="xMidYMid slice"/></g>
<g class="r r2">
<image class="f0" href="${small[0]}" x="${M + 60}" y="132" width="96" height="96"/>
${small.map((s, i) => `<image class="f f${i + 1}" href="${s}" x="${M + 60}" y="132" width="96" height="96"/>`).join('')}
<text x="${M + 60}" y="248" font-size="13" fill="${C.muted}">Flexiestays, Bournemouth.</text>
<text x="${M + 60}" y="265" font-size="13" fill="${C.muted}">I run the app, the site and Foxie.</text>
</g>
<g class="r r3">
${lines(config.headline, M, H - 74, 38, `class="d" font-size="34" fill="${C.ink}"`)}
${lines(sent, W - M - 176, sy, 20, `font-size="14" fill="${C.muted}"`)}
</g>`;
  return svg(H, body, `${config.headline.join(' ')}. ${config.sentence}`, css);
}

// ---------- 2. the exhibit: one line, every client ----------
function exhibitSVG() {
  const H = 360, half = W / 2;
  const note = wrap('A 60,000-line booking platform built with Lovable had this rule on four tables. Anyone holding the app’s public key could read every row.', 'sans400', 14, half - M * 2 - 10);
  const fixed = wrap('Fixed before a single real user signed up: each business now reads only its own rows.', 'sans400', 14, half - M * 2 - 10);
  const rows = [['0142', 'Ana R.', '12 Oct'], ['0143', 'Bruno T.', '14 Oct'], ['0144', 'Carla M.', '15 Oct'], ['0145', 'Diego S.', '17 Oct']];
  const px = half + M, pw = half - M * 2, py = 40;
  const css = `
.open{animation:op 12s infinite}.shut{opacity:0;animation:sh 12s infinite}
@keyframes op{0%,42%{opacity:1}50%,92%{opacity:0}100%{opacity:1}}
@keyframes sh{0%,42%{opacity:0}50%,92%{opacity:1}100%{opacity:0}}
.lit{animation:lt 12s infinite}
@keyframes lt{0%,42%{fill:${C.lit}}50%,92%{fill:${C.surface}}100%{fill:${C.lit}}}`;
  const body = `
<rect class="lit" x="${half}" y="0" width="${half}" height="${H}" fill="${C.lit}"/>
<text class="code" x="${M}" y="64" font-size="15" fill="${C.muted}">create policy <tspan fill="${C.ink}">"read clients"</tspan></text>
<text class="code" x="${M + 18}" y="88" font-size="15" fill="${C.muted}">on <tspan fill="${C.ink}">clients</tspan> for select</text>
<g class="open"><rect x="${M + 18 + 62}" y="97" width="44" height="22" fill="${C.surface}"/>
<text class="code" x="${M + 18}" y="112" font-size="15" fill="${C.muted}">using (<tspan fill="${C.ink}" dx="4">true</tspan><tspan dx="4">);</tspan></text></g>
<g class="shut"><text class="code" x="${M + 18}" y="112" font-size="15" fill="${C.muted}">using (<tspan fill="${C.ink}">business_id in</tspan></text>
<text class="code" x="${M + 18}" y="136" font-size="15" fill="${C.ink}">  (select my_businesses())<tspan fill="${C.muted}">);</tspan></text></g>
<g class="open">${lines(note, M, 172, 21, `font-size="14" fill="${C.muted}"`)}</g>
<g class="shut">${lines(fixed, M, 172, 21, `font-size="14" fill="${C.ink}"`)}</g>
<text class="d" x="${M}" y="${H - 32}" font-size="46" fill="${C.ink}">Readable by</text>

<g>
<rect x="${px}" y="${py}" width="${pw}" height="186" rx="6" fill="#ffffff" stroke="#d9d9d9"/>
<rect x="${px + 12}" y="${py + 12}" width="34" height="18" rx="3" fill="#e8f2ec"/>
<text class="code" x="${px + 18}" y="${py + 25}" font-size="11" fill="#1d6b3f">GET</text>
<text class="code" x="${px + 54}" y="${py + 25}" font-size="12" fill="#1b1b1b">/rest/v1/clients?select=*</text>
<line x1="${px}" x2="${px + pw}" y1="${py + 40}" y2="${py + 40}" stroke="#e6e6e6"/>
<text x="${px + 12}" y="${py + 58}" font-size="12" fill="#5e5e5e">Public key · no login</text>
<text x="${px + 12}" y="${py + 82}" font-size="12" font-weight="500" fill="#1d6b3f">200 OK</text>
<g class="open"><text x="${px + pw - 12}" y="${py + 82}" font-size="12" fill="#5e5e5e" text-anchor="end">4 rows</text>
${rows.map((r, i) => `<text x="${px + 12}" y="${py + 108 + i * 20}" font-size="12" fill="#1b1b1b">${r[0]}</text><text x="${px + 70}" y="${py + 108 + i * 20}" font-size="12" fill="#1b1b1b">${esc(r[1])}</text><text x="${px + pw - 12}" y="${py + 108 + i * 20}" font-size="12" fill="#5e5e5e" text-anchor="end">${r[2]}</text>`).join('')}</g>
<g class="shut"><text x="${px + pw - 12}" y="${py + 82}" font-size="12" fill="#5e5e5e" text-anchor="end">0 rows</text>
<text class="code" x="${px + 12}" y="${py + 112}" font-size="12" fill="#5e5e5e">[]</text>
<text x="${px + 32}" y="${py + 112}" font-size="12" fill="#5e5e5e">The policy refused the stranger.</text></g>
</g>
<text x="${px}" y="${py + 206}" font-size="12" fill="#6b6b6b" class="open">Sample rows, not client data.</text>
<text class="d open" x="${W - M}" y="${H - 32}" font-size="46" fill="${C.litInk}" text-anchor="end">anyone</text>
<text class="d shut" x="${W - M}" y="${H - 32}" font-size="46" fill="${C.ink}" text-anchor="end">its owner</text>`;
  return svg(H, body, 'Readable by anyone: the one line, using (true), that left a client database open, and the fix that closed it.', css);
}

// ---------- 3. work: the real calendar ----------
function workSVG(data) {
  const H = 330;
  const last = data.days.slice(-91);
  const last90 = data.days.slice(-90);
  const active = last90.filter((d) => d.count > 0).length;
  const sum90 = last90.reduce((s, d) => s + d.count, 0);
  const nz = last.map((d) => d.count).filter(Boolean).sort((a, b) => a - b);
  const q = (p) => nz[Math.min(nz.length - 1, Math.floor(p * nz.length))] || 1;
  const cuts = [q(0.25), q(0.5), q(0.75)];
  const level = (c) => (c === 0 ? 0 : c <= cuts[0] ? 1 : c <= cuts[1] ? 2 : c <= cuts[2] ? 3 : 4);
  const fills = ['#151b23', '#033a16', '#196c2e', '#2ea043', '#56d364'];
  const gx = 430, gy = 74, cell = 22, gap = 4;
  const first = new Date(last[0].date + 'T12:00:00Z').getUTCDay();
  let cells = '';
  last.forEach((d, i) => {
    const k = i + first, col = Math.floor(k / 7), row = k % 7;
    cells += `<rect x="${gx + col * (cell + gap)}" y="${gy + row * (cell + gap)}" width="${cell}" height="${cell}" rx="4" fill="${fills[level(d.count)]}"><title>${d.date}: ${d.count}</title></rect>`;
  });
  const gw = 14 * (cell + gap) - gap;
  const about = wrap(config.about, 'sans400', 14, 330);
  const css = '';
  const body = `
<text class="d" x="${M}" y="70" font-size="26" fill="${C.ink}">Every lit square is a day</text>
<text class="d" x="${M}" y="102" font-size="26" fill="${C.ink}">I shipped: ${active} of the last 90.</text>
${lines(about, M, 150, 21, `font-size="14" fill="${C.muted}"`)}
<text x="${M}" y="${H - 36}" font-size="14" fill="${C.ink}">${fmt(data.total)} contributions in the last year</text>
<rect x="${gx - 18}" y="${gy - 38}" width="${gw + 36}" height="${7 * (cell + gap) + 64}" rx="6" fill="#0d1117" stroke="#30363d"/>
<text x="${gx}" y="${gy - 14}" font-size="12" fill="#9198a1"><tspan fill="#e6edf3" font-weight="500">${fmt(sum90)}</tspan> contributions</text>
<text x="${gx + gw}" y="${gy - 14}" font-size="12" fill="#9198a1" text-anchor="end">last 90 days</text>
${cells}
<text x="${gx}" y="${gy + 7 * (cell + gap) + 14}" font-size="12" fill="#9198a1">${esc(config.user)}</text>`;
  return svg(H, body, `Every lit square is a day I shipped: ${active} of the last 90 days, ${sum90} contributions. ${config.about}`, css);
}

// ---------- 4. prices, set like a menu ----------
function pricesSVG() {
  const H = 270;
  const colX = [210, 420, 630], cw = 174;
  let cols = '';
  config.prices.forEach((g, i) => {
    const x = colX[i];
    cols += `<text x="${x}" y="66" font-size="16" fill="${C.ink}">${esc(g.group)}</text>`;
    g.items.forEach(([name, price], j) => {
      const y = 100 + j * 30;
      cols += `<text x="${x}" y="${y}" font-size="14" font-weight="500" fill="${C.ink}">${esc(name)}</text><text x="${x + cw}" y="${y}" font-size="14" font-weight="500" fill="${C.ink}" text-anchor="end">${esc(price)}</text>`;
    });
  });
  const body = `
<text class="d" x="${M}" y="68" font-size="26" fill="${C.ink}">Prices</text>
<text x="${M}" y="100" font-size="14" fill="${C.muted}">Fixed, booked</text>
<text x="${M}" y="121" font-size="14" fill="${C.muted}">through Upwork.</text>
${cols}
<text x="${colX[0]}" y="${H - 36}" font-size="14" fill="${C.muted}">Every package starts with read access to your project. I never need your passwords.</text>`;
  return svg(H, body, 'Prices: ' + config.prices.map((g) => `${g.group}: ${g.items.map((i) => i.join(' ')).join(', ')}`).join('. '));
}

// ---------- README ----------
function readme(stamp) {
  const card = (name, href, alt) => `<a href="${href}"><img src="assets/${name}.svg" width="100%" alt="${esc(alt)}"></a>`;
  return `<!-- Generated by scripts/build.mjs. Edit config.mjs instead. -->
${card('hero', config.upwork, `${config.headline.join(' ')}. ${config.sentence}`)}

${card('exhibit', `${config.site}history/open-database.html`, 'Readable by anyone: the one line that left a client database open, and the fix.')}

${card('work', `${config.site}#work`, 'Every lit square is a day I shipped. My contribution calendar for the last 90 days.')}

${card('prices', config.upwork, 'Prices for security audits, production rescue and AI chatbots, booked through Upwork.')}

<p align="center">
  <a href="${config.site}">Portfolio</a> &nbsp;·&nbsp;
  <a href="${config.site}history/open-database.html">The audit</a> &nbsp;·&nbsp;
  <a href="${config.site}history/foxie.html">Foxie</a> &nbsp;·&nbsp;
  <a href="${config.upwork}">Hire me on Upwork</a>
</p>

<details>
<summary><sub>How this page works</sub></summary>
<br>

<sub>A GitHub Action reads my public contribution calendar every six hours and redraws these cards as SVG, with the fonts, pictures and motion inside each file. The portfolio reads the same data. Last run: ${stamp}.</sub>
</details>
`;
}

// ---------- main ----------
const data = await loadDays();
const now = new Date();
const stamp = now.toLocaleString('en-GB', { timeZone: config.timezone, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' (São Paulo)';
await mkdir('assets', { recursive: true });
await mkdir('data', { recursive: true });
await writeFile('assets/hero.svg', await heroSVG());
await writeFile('assets/exhibit.svg', exhibitSVG());
await writeFile('assets/work.svg', workSVG(data));
await writeFile('assets/prices.svg', pricesSVG());
await writeFile('README.md', readme(stamp));
const last90 = data.days.slice(-90);
await writeFile('data/status.json', JSON.stringify({
  updated: now.toISOString(),
  available: config.available,
  note: config.available ? config.availableNote : config.busyNote,
  totalLastYear: data.total,
  active90: last90.filter((d) => d.count > 0).length,
  contributions90: last90.reduce((s, d) => s + d.count, 0),
  days: last90,
}, null, 1));
console.log(`ok: ${data.days.length} days, ${data.total} total, ${last90.filter((d) => d.count > 0).length}/90 active`);
