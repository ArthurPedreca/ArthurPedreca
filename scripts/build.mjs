// Redraws the profile: a terminal session whose every line comes from a real source
// (config.mjs, the contribution calendar, the clock at build time), plus the README around it.
// Usage: node scripts/build.mjs                              (fetches github.com)
//        FIXTURE=path/to/calendar.json node scripts/build.mjs   (offline: {total, days:[{date,count}]})
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import fonts from './fonts.mjs';
import config from '../config.mjs';

const art = JSON.parse(await readFile(new URL('./portrait.json', import.meta.url), 'utf8'));
const C = { field: '#15181c', ink: '#e9e7e2', dim: '#8d939b', accent: '#39d353' };
const ADV = 0.6; // JetBrains Mono advance, in em

// ---------- data ----------
async function loadCalendar() {
  if (process.env.FIXTURE) return JSON.parse(await readFile(process.env.FIXTURE, 'utf8'));
  const res = await fetch(`https://github.com/users/${config.user}/contributions`, { headers: { 'user-agent': 'profile-builder' } });
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

function stats({ total, days }) {
  const year = days.slice(-365);
  const weeks = [];
  for (let i = year.length; i > 0; i -= 7) weeks.unshift(year.slice(Math.max(0, i - 7), i).reduce((s, d) => s + d.count, 0));
  return { total, weeks: weeks.slice(-52), active: year.filter((d) => d.count > 0).length };
}

// ---------- text helpers ----------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fmt = (n) => Number(n).toLocaleString('en-US');
function wrap(text, cols) {
  const out = []; let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > cols && line) { out.push(line); line = word; } else line = next;
  }
  if (line) out.push(line);
  // no short widows: pull words down from the line above
  const n = out.length;
  while (n > 1 && out[n - 1].length < 14) {
    const prev = out[n - 2].split(' ');
    if (prev.length < 4) break;
    out[n - 1] = `${prev.pop()} ${out[n - 1]}`; out[n - 2] = prev.join(' ');
  }
  return out;
}
function parts(date, tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: tz, weekday: 'short', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', year: 'numeric', hourCycle: 'h23',
  }).formatToParts(date).map((x) => [x.type, x.value]));
  const local = Date.UTC(+p.year, ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(p.month), +p.day, +p.hour, +p.minute, +p.second);
  const off = Math.round((local - Math.floor(date.getTime() / 1000) * 1000) / 60000);
  return { ...p, off };
}
// zdump's own format: "Europe/London  Thu Oct 30 18:11:24 2026 GMT"
function zdump(date, tz, pad) {
  const p = parts(date, tz);
  const abbr = tz === 'Europe/London' ? (p.off ? 'BST' : 'GMT') : `${p.off < 0 ? '-' : '+'}${String(Math.abs(p.off / 60)).padStart(2, '0')}`;
  return `${tz.padEnd(pad)}${p.weekday} ${p.month} ${String(+p.day).padStart(2, ' ')} ${p.hour}:${p.minute}:${p.second} ${p.year} ${abbr}`;
}

// ---------- the session, as rows of text ----------
// Each row: { cmd } | { out: [[text, cls], ...] } | { bars } | { gap }
function session(s, now, cols) {
  const rows = [];
  const cmd = (c) => rows.push({ cmd: c });
  const out = (...segs) => rows.push({ out: segs });
  const gap = () => rows.push({ gap: true });

  cmd('whoami');
  out([config.handle, 'o']);
  gap();

  cmd('cat now.txt');
  const key = Math.max(...config.now.map(([k]) => k.length)) + 3;
  config.now.forEach(([k, v], j) => {
    if (j) rows.push({ space: 0.5 }); // a little air between projects
    wrap(v, cols - key).forEach((l, i) => out([(i ? '' : k).padEnd(key) + l, 'o']));
  });
  gap();

  cmd('./contributions --weeks 52');
  rows.push({ bars: s.weeks });
  wrap(`${fmt(s.total)} contributions in 12 months, on ${s.active} days`, cols).forEach((l) => out([l, 'o']));
  gap();

  const pad = Math.max(config.timezone.length, config.workTimezone.length) + 2;
  cmd(`zdump ${config.timezone} ${config.workTimezone}`);
  out([zdump(now, config.timezone, pad), 'o']);
  out([zdump(now, config.workTimezone, pad), 'o']);
  gap();

  const ran = now.toLocaleString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  cmd('crontab -l');
  wrap(`# redraws this page. Last run ${ran} UTC`, cols).forEach((l) => out([l, 'c']));
  out(['17 */6 * * *  node scripts/build.mjs', 'o']);
  gap();

  rows.push({ prompt: true });
  return rows;
}

// ---------- drawing ----------
const V = {
  wide: {
    W: 880, M: 44, top: 46,
    name: 84, sent: 18, sentLh: 28, sentCols: 35,
    pic: { art: art.wide, size: 8, top: 38 },
    term: 15, lh: 24, gapLh: 10, after: 34,
  },
  mid: {
    W: 620, M: 30, top: 34,
    name: 62, sent: 16, sentLh: 25, sentCols: 30,
    pic: { art: art.wide, size: 5.2, top: 30 },
    term: 13, lh: 21, gapLh: 9, after: 40,
  },
  narrow: {
    W: 420, M: 18, top: 26,
    name: 46, sent: 15, sentLh: 23, sentCols: 42,
    pic: { art: art.narrow, size: 6.2, top: 22 },
    term: 12, lh: 19.5, gapLh: 8, after: 40,
  },
};

function draw(v, s, now) {
  const { W, M } = v;
  const cw = v.term * ADV;
  const cols = Math.floor((W - 2 * M) / cw);
  let t = 0; // animation clock, seconds
  const body = [];
  const css = [];

  // name, two lines, ending in a block cursor
  const [first, last] = config.name.split(' ');
  const b1 = v.top + v.name * 0.74;
  const b2 = b1 + v.name * 0.98;
  body.push(`<text class="nm" x="${M}" y="${b1}" font-size="${v.name}">${esc(first)}</text>`);
  body.push(`<text class="nm" x="${M}" y="${b2}" font-size="${v.name}">${esc(last)}</text>`);
  const cx = M + last.length * v.name * ADV + v.name * 0.06;
  body.push(`<rect class="cur1" x="${cx.toFixed(1)}" y="${(b2 - v.name * 0.73).toFixed(1)}" width="${(v.name * 0.52).toFixed(1)}" height="${(v.name * 0.73).toFixed(1)}" fill="${C.accent}"/>`);

  // the sentence that says what this is
  const sent = wrap(config.sentence, v.sentCols);
  const pa = v.pic.art; const pcw = v.pic.size * ADV;
  const picBottom = v.pic.top + pa.length * v.pic.size;
  const sentW = v.sentCols * v.sent * ADV;
  const clear = M + sentW < W - M - Math.max(...pa.map((r) => r.length)) * pcw - 16; // does the sentence fit beside the portrait?
  const sy = Math.max(b2 + v.sentLh * 1.9, clear ? 0 : picBottom + v.sentLh * 1.2);
  sent.forEach((l, i) => body.push(`<text class="se" x="${M}" y="${sy + i * v.sentLh}" font-size="${v.sent}">${esc(l)}</text>`));
  const textBottom = sy + (sent.length - 1) * v.sentLh;

  // the portrait, printed row by row
  const pw = Math.max(...pa.map((r) => r.length)) * pcw;
  const px = W - M - pw;
  pa.forEach((row, i) => {
    if (!row.trim()) return;
    body.push(`<text class="pt r" x="${px.toFixed(1)}" y="${(v.pic.top + (i + 0.8) * v.pic.size).toFixed(1)}" font-size="${v.pic.size}" style="animation-delay:${(0.15 + i * 0.012).toFixed(3)}s" xml:space="preserve">${esc(row)}</text>`);
  });
  t = 0.15 + pa.length * 0.012 + 0.2;

  // the session
  let y = Math.max(textBottom, picBottom) + v.after;
  const rows = session(s, now, cols);
  for (const r of rows) {
    if (r.gap) { y += v.gapLh; t += 0.25; continue; }
    if (r.space) { y += v.lh * r.space; continue; }
    if (r.cmd || r.prompt) {
      const base = y + v.lh * 0.72;
      const promptX = M; const textX = M + 2 * cw;
      body.push(`<text class="pr r" x="${promptX}" y="${base}" font-size="${v.term}" style="animation-delay:${t.toFixed(2)}s">$</text>`);
      if (r.cmd) {
        const n = r.cmd.length; const dur = Math.min(0.9, 0.035 * n + 0.1);
        body.push(`<text class="cm r" x="${textX}" y="${base}" font-size="${v.term}" style="animation-delay:${t.toFixed(2)}s" xml:space="preserve">${esc(r.cmd)}</text>`);
        // a strip of the field's colour slides off the command, a character at a time
        body.push(`<rect class="ty" x="${textX - 1}" y="${y}" width="${(n + 1) * cw + 2}" height="${v.lh}" fill="${C.field}" style="--w:${((n + 1) * cw + 2).toFixed(1)}px;animation:ty ${dur.toFixed(2)}s steps(${n}) ${t.toFixed(2)}s both"/>`);
        t += dur + 0.12;
      } else {
        body.push(`<rect class="cur2 r" x="${textX}" y="${(y + v.lh * 0.12).toFixed(1)}" width="${(cw * 0.9).toFixed(1)}" height="${(v.lh * 0.76).toFixed(1)}" fill="${C.accent}" style="animation-delay:${t.toFixed(2)}s"/>`);
      }
      y += v.lh;
      continue;
    }
    if (r.out) {
      const base = y + v.lh * 0.72;
      const segs = r.out.map(([txt, cls]) => `<tspan class="${cls}">${esc(txt)}</tspan>`).join('');
      body.push(`<text class="r" x="${M}" y="${base}" font-size="${v.term}" style="animation-delay:${t.toFixed(2)}s" xml:space="preserve">${segs}</text>`);
      y += v.lh; t += 0.04;
      continue;
    }
    if (r.bars) {
      const hMax = v.lh * 2 - 4; const peak = Math.max(1, ...r.bars);
      const by = y + v.lh * 2 - 2;
      r.bars.forEach((n, i) => {
        if (!n) return;
        const level = Math.max(1, Math.round(Math.sqrt(n / peak) * 16)); // eighths of two cells, like ▁▂▃▄▅▆▇█ stacked; square root so one huge week doesn't flatten the rest
        const h = (level / 16) * hMax;
        body.push(`<rect class="bar" x="${(M + i * cw + 0.75).toFixed(2)}" y="${(by - h).toFixed(1)}" width="${(cw - 1.5).toFixed(2)}" height="${h.toFixed(1)}" fill="${C.accent}" style="animation-delay:${(t + i * 0.012).toFixed(3)}s"><title>${fmt(n)}</title></rect>`);
      });
      y += v.lh * 2 + 4; t += 0.05 + r.bars.length * 0.012;
      continue;
    }
  }
  const H = Math.ceil(y + M * 0.9);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="t d">
<title id="t">${esc(config.name)}: ${esc(config.sentence)}</title>
<desc id="d">${esc(transcriptText(s, now))}</desc>
<style>
@font-face{font-family:J;font-weight:400;src:url(data:font/woff2;base64,${fonts.mono400}) format("woff2")}
@font-face{font-family:J;font-weight:700;src:url(data:font/woff2;base64,${fonts.mono700}) format("woff2")}
text{font-family:J,ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;fill:${C.ink}}
.nm{font-weight:700;letter-spacing:-0.02em}
.se{fill:${C.ink}}
.pt{fill:${C.ink}}
.pr{fill:${C.accent};font-weight:700}
.cm{font-weight:700}
.c{fill:${C.dim}}
.r{animation:r .01s linear both}
@keyframes r{from{opacity:0}to{opacity:1}}
.ty{opacity:0}
@keyframes ty{from{opacity:1;transform:translateX(0)}to{opacity:1;transform:translateX(var(--w))}}
.bar{transform-box:fill-box;transform-origin:50% 100%;animation:bar .5s cubic-bezier(.2,.8,.2,1) both}
@keyframes bar{from{transform:scaleY(0)}to{transform:scaleY(1)}}
.cur1{animation:bl 1.1s steps(1) 0s 4}
.cur2{animation:r .01s linear both,bl 1.1s steps(1) infinite}
@keyframes bl{50%{opacity:0}}
${css.join('\n')}
@media (prefers-reduced-motion:reduce){.r,.bar,.cur1,.cur2{animation:none}.ty{display:none}}
</style>
<rect width="${W}" height="${H}" fill="${C.field}"/>
${body.join('\n')}
</svg>`;
}

function transcriptText(s, now) {
  return session(s, now, 200).map((r) => {
    if (r.cmd) return `$ ${r.cmd}`;
    if (r.out) return r.out.map(([x]) => x).join('').replace(/\s+/g, ' ');
    if (r.bars) return `[weekly contributions for the last 52 weeks: ${r.bars.join(', ')}]`;
    return '';
  }).filter(Boolean).join(' / ');
}

// ---------- README ----------
function readme(s) {
  const alt = `A terminal. ${config.name}: ${config.sentence} ${fmt(s.total)} contributions in the last year.`;
  const work = config.work.map((w) => `**${w.url ? `[${w.name}](${w.url})` : w.name}** · ${w.text}`).join('\n\n');
  const repos = config.repos.map(([r, d]) => `- **[${r}](https://github.com/${config.user}/${r})** · ${d}`).join('\n');
  return `<!-- Generated by scripts/build.mjs. Edit config.mjs instead. -->
<picture>
  <source media="(max-width: 600px)" srcset="assets/terminal-narrow.svg">
  <source media="(max-width: 1100px)" srcset="assets/terminal-mid.svg">
  <img src="assets/terminal.svg" width="100%" alt="${esc(alt)}">
</picture>

### ~/work

${work}

${config.stack.join(' · ')}

### ~/repos

${repos}

<br>

[Portfolio](${config.site}) · Freelance projects through [Upwork](${config.upwork})
`;
}

// ---------- main ----------
const cal = await loadCalendar();
const s = stats(cal);
const now = process.env.NOW ? new Date(process.env.NOW) : new Date();
await mkdir('assets', { recursive: true });
await mkdir('data', { recursive: true });
await writeFile('assets/terminal.svg', draw(V.wide, s, now));
await writeFile('assets/terminal-mid.svg', draw(V.mid, s, now));
await writeFile('assets/terminal-narrow.svg', draw(V.narrow, s, now));
await writeFile('README.md', readme(s));
const last90 = cal.days.slice(-90);
await writeFile('data/status.json', JSON.stringify({
  updated: now.toISOString(),
  available: config.available,
  note: config.available ? config.availableNote : config.busyNote,
  totalLastYear: cal.total,
  active90: last90.filter((d) => d.count > 0).length,
  contributions90: last90.reduce((t, d) => t + d.count, 0),
  days: last90,
}, null, 1));
console.log(`ok: ${cal.days.length} days, ${cal.total} total, ${s.active} active days`);
