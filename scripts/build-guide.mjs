// Builds docs/Sky-Kart-3D-Complete-Guide.pdf from the Markdown chapters in docs/guide/.
//   node scripts/build-guide.mjs        (or: npm run guide)   - the pictures come from scripts/guide-shots.mjs
// Google Chrome or Microsoft Edge prints the PDF (it is only started, nothing is downloaded). Needs Node.js 22 or newer
// (for the built-in WebSocket). The page numbers in the table of contents come from a first print: pdftotext (part of
// Git for Windows and of poppler) reads them back; without it the contents page simply has no page numbers.
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { freePort } from './lib/network.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const docs = join(root, 'docs', 'guide');
const OUT = join(root, 'docs', 'Sky-Kart-3D-Complete-Guide.pdf');
const TITLE = 'Sky Kart 3D - Complete Guide';
const CHAPTERS = ['01-overview.md', '02-folder-structure.md', '03-how-it-fits.md', '04-build-step-by-step.md', '05-features.md', '06-run-and-host.md', '07-testing.md', '08-change-and-extend.md', '09-words.md'];
// temporary files (browser profile, HTML) stay inside the project, in scripts/out: the C: drive of this PC is almost full
const scratch = join(root, 'scripts', 'out');
mkdirSync(scratch, { recursive: true });
const tmpdir = () => scratch;

if (typeof WebSocket === 'undefined') { console.error('This needs Node.js 22 or newer (it uses the built-in WebSocket).'); process.exit(1); }

/* ------------------------------------------------------------------ Markdown -> HTML (the small part of Markdown the chapters use) */
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };
const uriCache = new Map();

function assetPath(src) {
  const file = resolve(docs, src);
  if (!existsSync(file)) throw new Error(`Picture not found: docs/${src}`);
  return file;
}
function dataUri(src) {
  const file = assetPath(src);
  if (!uriCache.has(file)) uriCache.set(file, `data:${MIME[extname(file).toLowerCase()]};base64,${readFileSync(file).toString('base64')}`);
  return uriCache.get(file);
}
function inlineSvg(src) {
  return readFileSync(assetPath(src), 'utf8').replace(/<\?xml[^>]*\?>/, '').replace('<svg ', '<svg class="diagram" ').trim();
}

function inline(text, chapterIds) {
  const codes = [];
  let s = text.replace(/`([^`]+)`/g, (_, c) => { codes.push(esc(c)); return `\u0000${codes.length - 1}\u0000`; });
  s = s.replace(/<br\s*\/?>/g, '\u0001');
  s = esc(s).replace(/(\d) (m|s|km\/h|km|KB|MB|GB|ms|Hz|FPS|px)\b/g, '$1 $2'); // a number and its unit stay on one line
  s = s.replace(/(\d) (\d{3})(?!\d)/g, '$1 $2'); // 2 042 stays on one line
  s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => `<img src="${dataUri(src)}" alt="${alt.replace(/"/g, '&quot;')}">`);
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, href) => `<a href="${href.endsWith('.md') ? '#' + (chapterIds[href] || '') : href}">${t}</a>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, '$1<em>$2</em>');
  return s.replace(/\u0001/g, '<br>').replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[i]}</code>`);
}

const plain = (t) => t.replace(/[`*]/g, '');
const LIST = /^(\s*)([-*]|\d+\.)\s+(.*)$/;

// ctx = { chapter, headings: [], marks: bool, ids }
function blocks(md, ctx) {
  const lines = md.replace(/\r/g, '').split('\n');
  const out = [];
  const tableAt = (k) => /^\s*\|/.test(lines[k]) && k + 1 < lines.length && /^\s*\|[\s:|-]+\|?\s*$/.test(lines[k + 1]) && /-{3}/.test(lines[k + 1]);
  const startsBlock = (k) => /^```/.test(lines[k]) || /^#{1,4}\s/.test(lines[k]) || /^---+\s*$/.test(lines[k]) || /^>/.test(lines[k]) || LIST.test(lines[k]) || tableAt(k);
  const I = (t) => inline(t, ctx.ids);
  let i = 0, m;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    if (/^```/.test(line)) {
      const body = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) body.push(lines[i++]);
      i++;
      const tree = /^```tree/.test(line); // folder trees may run over a page break
      out.push(`<pre class="code${tree ? ' tree' : ''}"><code>${esc(body.join('\n'))}</code></pre>`);
      continue;
    }
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) {
      const level = m[1].length;
      let id = '';
      if (level <= 2) {
        id = level === 1 ? `ch${ctx.chapter}` : `ch${ctx.chapter}-s${ctx.headings.filter((h) => h.level === 2).length + 1}`;
        ctx.headings.push({ level, text: plain(m[2]), id });
      }
      const mark = id && ctx.marks ? `<span class="mark">@@${id}@@</span>` : '';
      out.push(`<h${level}${id ? ` id="${id}"` : ''}>${I(m[2])}${mark}</h${level}>`);
      i++;
      continue;
    }
    if (/^---+\s*$/.test(line)) { out.push('<hr>'); i++; continue; }

    if (tableAt(i)) {
      const row = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
      const head = row(lines[i]);
      i += 2;
      const body = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) body.push(row(lines[i++]));
      const gallery = body.length > 0 && body.every((r) => r.every((c) => !c || c.includes('![')));
      const thead = head.every((c) => !c) ? '' : `<thead><tr>${head.map((c) => `<th>${I(c)}</th>`).join('')}</tr></thead>`;
      const cls = gallery ? 'gallery' : body.length <= 6 ? 'keep' : ''; // small tables stay in one piece
      out.push(`<table${cls ? ` class="${cls}"` : ''}>${thead}<tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${I(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
      continue;
    }

    if (/^>/.test(line)) {
      const inner = [];
      while (i < lines.length && /^>/.test(lines[i])) inner.push(lines[i++].replace(/^>\s?/, ''));
      const text = inner.join('\n');
      const kind = (text.match(/^\*\*(Note|Tip|Honest status|Not tested yet|Warning|Rule)/) || [])[1];
      const cls = kind === 'Note' || kind === 'Rule' ? 'note' : kind === 'Tip' ? 'tip' : 'warn';
      out.push(`<div class="callout ${cls}">${blocks(text, ctx)}</div>`);
      continue;
    }

    if (LIST.test(line)) {
      const items = [];
      while (i < lines.length && lines[i].trim()) {
        const lm = lines[i].match(LIST);
        if (lm) items.push({ ordered: /\d/.test(lm[2]), num: parseInt(lm[2], 10), text: lm[3] });
        else if (items.length && /^\s+\S/.test(lines[i])) items[items.length - 1].text += ' ' + lines[i].trim();
        else break;
        i++;
      }
      const tag = items[0].ordered ? 'ol' : 'ul';
      out.push(`<${tag}${tag === 'ol' && items[0].num > 1 ? ` start="${items[0].num}"` : ''}>${items.map((it) => `<li>${I(it.text)}</li>`).join('')}</${tag}>`);
      continue;
    }

    const para = [];
    while (i < lines.length && lines[i].trim() && !(para.length && startsBlock(i))) para.push(lines[i++].trim());
    const text = para.join(' ');
    if ((m = text.match(/^!\[([^\]]*)\]\(([^)]+)\)$/))) {
      const svg = m[2].endsWith('.svg');
      out.push(`<figure>${svg ? inlineSvg(m[2]) : `<img src="${dataUri(m[2])}" alt="${m[1].replace(/"/g, '&quot;')}">`}${m[1] ? `<figcaption>${I(m[1])}</figcaption>` : ''}</figure>`);
    } else out.push(`<p>${I(text)}</p>`);
  }
  return out.join('\n');
}

/* ------------------------------------------------------------------ the page */
const CSS = `
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font-family: "Segoe UI", system-ui, Arial, sans-serif; font-size: 10pt; line-height: 1.5; color: #1b1f3b; }
h1, h2, h3, h4 { font-weight: 700; line-height: 1.25; break-after: avoid; position: relative; }
h1 { font-size: 23pt; margin: 0 0 14pt; padding-bottom: 8pt; border-bottom: 4px solid #ffb703; color: #14193d; break-before: page; }
h2 { font-size: 14.5pt; margin: 20pt 0 7pt; padding-left: 9pt; border-left: 5px solid #2f7de1; color: #14193d; }
h3 { font-size: 11.5pt; margin: 14pt 0 5pt; color: #1d4f9c; }
p { margin: 0 0 8pt; }
ul, ol { margin: 0 0 9pt; padding-left: 20pt; }
li { margin: 0 0 3pt; }
code { font-family: Consolas, "Cascadia Mono", monospace; font-size: 0.9em; background: #eef1f8; padding: 0.5pt 3pt; border-radius: 3pt; }
pre.code { margin: 0 0 10pt; padding: 8pt 10pt; background: #f4f6fb; border-left: 3px solid #2f7de1; border-radius: 4pt; break-inside: avoid; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 8.2pt; line-height: 1.4; }
pre.code code { background: none; padding: 0; font-size: inherit; }
pre.code.tree { break-inside: auto; font-size: 7.6pt; line-height: 1.34; white-space: pre; overflow-wrap: normal; border-left-color: #ffb703; }
hr { border: 0; border-top: 1px solid #cfd6e6; margin: 14pt 0; }
a { color: #1d4f9c; text-decoration: none; }
.mark { position: absolute; left: 0; top: 0; font-size: 1px; line-height: 1px; color: #fff; white-space: nowrap; }

table { width: 100%; border-collapse: collapse; margin: 0 0 12pt; font-size: 8.6pt; line-height: 1.38; }
th { background: #1b1f3b; color: #fff; text-align: left; padding: 4pt 6pt; font-weight: 600; }
th code { background: rgba(255, 255, 255, 0.2); color: #fff; }
table.keep, table.gallery { break-inside: avoid; }
td { padding: 4pt 6pt; vertical-align: top; border-bottom: 1px solid #dde3f0; overflow-wrap: break-word; }
tbody tr:nth-child(even) td { background: #f6f8fd; }
tr { break-inside: avoid; }
td img { display: block; width: 100%; border-radius: 4pt; margin-bottom: 2pt; }
table.gallery td { width: 33.33%; padding: 4pt; text-align: center; background: none !important; border: 0; }
table.gallery td img { margin-bottom: 3pt; }

figure { margin: 4pt 0 12pt; text-align: center; break-inside: avoid; }
figure img { max-width: 100%; max-height: 92mm; border-radius: 5pt; box-shadow: 0 0 0 1px #cfd6e6; }
figure svg.diagram { width: 100%; height: auto; max-height: 215mm; }
figcaption { margin-top: 4pt; font-size: 8.6pt; color: #475569; font-style: italic; }

.callout { margin: 0 0 11pt; padding: 7pt 11pt 1pt; border-radius: 6pt; border-left: 5px solid; break-inside: avoid; font-size: 9.4pt; }
.callout.note { background: #e8f1fd; border-color: #2f7de1; }
.callout.tip { background: #e3f6ea; border-color: #22a35a; }
.callout.warn { background: #fff3cf; border-color: #d99a00; }

.cover { height: 247mm; display: flex; flex-direction: column; break-after: page; overflow: hidden; }
.cover .band { background: #1b1f3b; color: #fff; padding: 22mm 14mm 12mm; border-radius: 8pt; }
.cover .band small { display: block; font-size: 11pt; letter-spacing: 3pt; color: #ffb703; font-weight: 700; margin-bottom: 8pt; }
.cover .band h1 { all: unset; display: block; font-size: 40pt; line-height: 1.05; font-weight: 800; }
.cover .band h1 span { color: #ffb703; }
.cover .band p { margin: 12pt 0 0; font-size: 13pt; color: #cfd6f2; }
.cover .hero { margin-top: 9mm; }
.cover .hero img { width: 100%; height: 82mm; object-fit: cover; object-position: 50% 100%; border-radius: 8pt; display: block; }
.cover .tiles { display: flex; gap: 6pt; margin-top: 8mm; }
.cover .tiles div { flex: 1; text-align: center; background: #fff3cf; border: 1px solid #f0d27a; border-radius: 6pt; padding: 7pt 2pt; }
.cover .tiles b { display: block; font-size: 19pt; color: #14193d; line-height: 1.1; }
.cover .tiles span { font-size: 8pt; color: #5b4a10; }
.cover .note { margin-top: auto; font-size: 9pt; color: #475569; }

.toc { break-after: page; }
.toc h1 { break-before: auto; }
.toc a { display: flex; align-items: baseline; color: inherit; }
.toc .l1 { margin-top: 7pt; font-weight: 700; font-size: 10.5pt; }
.toc .l2 { padding-left: 16pt; font-size: 9pt; line-height: 1.55; }
.toc .dots { flex: 1; border-bottom: 1px dotted #9aa5c4; margin: 0 5pt 3pt; }
.toc .n { min-width: 16pt; text-align: right; color: #475569; font-weight: 600; }
`;

function buildHtml({ pages, marks }) {
  const ids = Object.fromEntries(CHAPTERS.map((f, k) => [f, `ch${k + 1}`]));
  const headings = [];
  const bodies = CHAPTERS.map((file, k) => blocks(readFileSync(join(docs, file), 'utf8'), { chapter: k + 1, headings, marks, ids }));
  const toc = headings.map((h) => `<a class="l${h.level}" href="#${h.id}"><span>${esc(h.text)}</span><span class="dots"></span><span class="n">${pages[h.id] ?? '00'}</span></a>`).join('\n');
  const cover = `<section class="cover">
  <div class="band"><small>COMPLETE GUIDE · FOLDER STRUCTURE</small><h1>SKY KART 3D<br><span>ISLAND GRAND PRIX</span></h1><p>Every folder and every file of the game, what each one does, how they work together, and how to build, run, test and host it.</p></div>
  <div class="hero"><img src="${dataUri('images/race-aurora.jpg')}" alt=""></div>
  <div class="tiles"><div><b>12</b><span>tracks</span></div><div><b>5</b><span>karts</span></div><div><b>20</b><span>missions</span></div><div><b>34</b><span>source files</span></div><div><b>0</b><span>downloaded art</span></div></div>
  <div class="note">Written with Claude, 23 October 2026, from the project folder the Sky Kart 3D project. The game was tested by programs and in headless Chrome (desktop and phone emulation). It has not been tried on a real phone yet (see chapters 7 and 8).</div>
</section>`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${TITLE}</title><style>${CSS}</style></head><body>
${cover}
<section class="toc"><h1>Contents</h1>${toc}</section>
${bodies.join('\n')}
</body></html>`;
  return { html, headings };
}

/* ------------------------------------------------------------------ Chrome */
function findBrowser() {
  const pf = process.env.ProgramFiles || 'C:\\Program Files', pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', local = process.env.LOCALAPPDATA || '';
  const list = [process.env.CHROME, `${pf}\\Google\\Chrome\\Application\\chrome.exe`, `${pf86}\\Google\\Chrome\\Application\\chrome.exe`, `${local}\\Google\\Chrome\\Application\\chrome.exe`,
    `${pf86}\\Microsoft\\Edge\\Application\\msedge.exe`, `${pf}\\Microsoft\\Edge\\Application\\msedge.exe`,
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
  return list.find((p) => p && existsSync(p));
}

async function printToPdf(browser, htmlFile) {
  const port = await freePort(9400);
  const profile = mkdtempSync(join(tmpdir(), '.chrome-guide-'));
  const proc = spawn(browser, ['--headless=new', '--mute-audio', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' });
  const stop = () => { try { if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); else proc.kill(); } catch { /* already gone */ } };
  try {
    let wsUrl = null;
    for (let n = 0; n < 80 && !wsUrl; n++) {
      try { wsUrl = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === 'page')?.webSocketDebuggerUrl; } catch { /* not up yet */ }
      if (!wsUrl) await new Promise((r) => setTimeout(r, 250));
    }
    if (!wsUrl) throw new Error('The browser did not start.');
    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('Could not talk to the browser.')); });
    let id = 0;
    const waiting = new Map();
    ws.onmessage = (m) => { const d = JSON.parse(m.data); const w = d.id && waiting.get(d.id); if (w) { waiting.delete(d.id); d.error ? w.rej(new Error(d.error.message)) : w.res(d.result); } };
    const send = (method, params = {}) => new Promise((res, rej) => { waiting.set(++id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); });

    await send('Page.enable');
    await send('Page.navigate', { url: pathToFileURL(htmlFile).href });
    for (let n = 0; n < 200; n++) {
      const r = await send('Runtime.evaluate', { expression: 'document.readyState', returnByValue: true });
      if (r.result.value === 'complete') break;
      await new Promise((res) => setTimeout(res, 100));
    }
    await send('Runtime.evaluate', { expression: 'Promise.all([document.fonts.ready, ...Array.from(document.images, (i) => i.decode().catch(() => {}))]).then(() => true)', awaitPromise: true });
    const footer = '<div style="font-family:Segoe UI,Arial,sans-serif;font-size:8px;color:#5b6480;width:100%;padding:0 17mm;display:flex;justify-content:space-between"><span>Sky Kart 3D - Complete Guide</span><span>Page <span class="pageNumber"></span> / <span class="totalPages"></span></span></div>';
    const r = await send('Page.printToPDF', {
      printBackground: true, displayHeaderFooter: true, headerTemplate: '<div></div>', footerTemplate: footer,
      paperWidth: 8.27, paperHeight: 11.69, marginTop: 0.7, marginBottom: 0.8, marginLeft: 0.67, marginRight: 0.67,
      generateDocumentOutline: true, generateTaggedPDF: true,
    });
    ws.close();
    return Buffer.from(r.data, 'base64');
  } finally {
    stop();
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* the browser may still hold a file for a moment */ }
  }
}

function findPdftotext() {
  const list = ['pdftotext', 'C:\\Program Files\\Git\\mingw64\\bin\\pdftotext.exe', 'C:\\Program Files\\Git\\usr\\bin\\pdftotext.exe'];
  for (const p of list) { try { execFileSync(p, ['-v'], { stdio: 'ignore' }); return p; } catch (e) { if (e.status !== undefined && e.code !== 'ENOENT') return p; } }
  return null;
}

// page number (1-based) of every heading marker in a PDF, and the number of pages
function readPages(pdfFile, tool) {
  const text = execFileSync(tool, ['-enc', 'UTF-8', pdfFile, '-'], { maxBuffer: 1 << 28 }).toString('utf8');
  const pages = text.split('\f');
  if (pages.length && !pages[pages.length - 1].trim()) pages.pop();
  const found = {};
  pages.forEach((p, k) => { for (const m of p.matchAll(/@@(ch[\w-]+)@@/g)) if (!(m[1] in found)) found[m[1]] = k + 1; });
  return { found, count: pages.length };
}

/* ------------------------------------------------------------------ main */
const browser = findBrowser();
if (!browser) { console.error('Google Chrome or Microsoft Edge was not found. Install one of them (or set the CHROME environment variable to its path) and run again.'); process.exit(1); }
const work = mkdtempSync(join(tmpdir(), 'guide-html-'));
try {
  const tool = findPdftotext();
  let pages = {};
  let pass1Count = 0;
  if (tool) {
    console.log('Pass 1: printing to find the page of every heading...');
    const first = buildHtml({ pages: {}, marks: true });
    const htmlFile = join(work, 'pass1.html');
    writeFileSync(htmlFile, first.html);
    const pdfFile = join(work, 'pass1.pdf');
    writeFileSync(pdfFile, await printToPdf(browser, htmlFile));
    const r = readPages(pdfFile, tool);
    pages = r.found;
    pass1Count = r.count;
    const missing = first.headings.filter((h) => !(h.id in pages));
    if (missing.length) console.warn(`  (no page found for ${missing.length} headings; they will show no number)`);
  } else console.warn('pdftotext was not found: the contents page will have no page numbers.');

  console.log('Printing the guide...');
  const { html, headings } = buildHtml({ pages, marks: false });
  const htmlFile = join(work, 'guide.html');
  writeFileSync(htmlFile, html);
  const pdf = await printToPdf(browser, htmlFile);
  writeFileSync(OUT, pdf);
  if (tool) {
    const check = join(work, 'final.pdf');
    writeFileSync(check, pdf);
    const count = execFileSync(tool, ['-enc', 'UTF-8', check, '-'], { maxBuffer: 1 << 28 }).toString('utf8').split('\f').filter((p, k, a) => p.trim() || k < a.length - 1).length;
    if (count !== pass1Count) console.warn(`  WARNING: page count changed between the two prints (${pass1Count} then ${count}); the contents page numbers may be off.`);
  }
  console.log(`Done: ${OUT}  (${(pdf.length / 1048576).toFixed(1)} MB, ${headings.length} contents entries)`);
} finally {
  try { rmSync(work, { recursive: true, force: true }); } catch { /* ignore */ }
}
