// Tiny Chrome DevTools-protocol driver for headless browser tests and screenshots (no extra dependencies; Node 22+ has WebSocket).
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { preview } from 'vite';
import { fileURLToPath } from 'node:url';

export const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const root = fileURLToPath(new URL('../../', import.meta.url));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function serveDist(port = 4599) {
  const server = await preview({ root, logLevel: 'error', preview: { host: '127.0.0.1', port, strictPort: false } });
  const addr = server.httpServer.address();
  return { url: `http://127.0.0.1:${addr.port}/`, close: () => server.close() };
}

export async function launch({ width = 1280, height = 720, mobile = false, port = 9333 + Math.floor(Math.random() * 500) } = {}) {
  // the throw-away browser profile lives inside the project (scripts/out) and is deleted again on close
  const base = join(root, 'scripts', 'out');
  mkdirSync(base, { recursive: true });
  const dir = mkdtempSync(join(base, '.chrome-'));
  // --mute-audio: the game's sound still runs (so audio code is tested) but nothing comes out of the speakers
  const args = [`--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, '--headless=new', '--mute-audio', '--no-first-run', '--disk-cache-size=1', '--media-cache-size=1', '--no-default-browser-check', '--disable-extensions',
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', `--window-size=${width},${height}`, 'about:blank'];
  const proc = spawn(CHROME, args, { stdio: 'ignore' });
  let info = null;
  for (let i = 0; i < 80 && !info; i++) {
    await sleep(250);
    try { const r = await fetch(`http://127.0.0.1:${port}/json`); info = (await r.json()).find((t) => t.type === 'page'); } catch { /* not ready */ }
  }
  if (!info) { proc.kill(); throw new Error('Chrome did not start'); }
  const ws = new WebSocket(info.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map(); const logs = [];
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { const { res, rej } = pending.get(d.id); pending.delete(d.id); d.error ? rej(new Error(d.error.message)) : res(d.result); }
    else if (d.method === 'Runtime.consoleAPICalled') logs.push({ type: d.params.type, text: d.params.args.map((a) => a.value ?? a.description ?? '').join(' ') });
    else if (d.method === 'Runtime.exceptionThrown') logs.push({ type: 'exception', text: d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text });
  };
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Page.enable'); await send('Runtime.enable');
  const setSize = async (w, h, mob = mobile) => {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: mob ? 2 : 1, mobile: mob });
    if (mob) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  };
  await setSize(width, height);
  const api = {
    send, logs, setSize,
    goto: async (url) => { await send('Page.navigate', { url }); await sleep(800); },
    eval: async (expr) => {
      const run = (e) => send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true });
      let r;
      try { r = await run(expr); } catch (e) {
        // a DOM node cannot be returned by value: report whether it exists instead
        if (/reference chain/.test(e.message)) r = await run(`!!(${expr})`); else throw e;
      }
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    },
    shot: async (file) => { const r = await send('Page.captureScreenshot', { format: file.endsWith('.jpg') ? 'jpeg' : 'png', quality: 82 }); writeFileSync(file, Buffer.from(r.data, 'base64')); },
    click: async (x, y) => { for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 }); },
    key: async (type, code, key) => send('Input.dispatchKeyEvent', { type, code, key: key || code, windowsVirtualKeyCode: 0 }),
    touch: (type, points) => send('Input.dispatchTouchEvent', { type, touchPoints: points }),
    // click the first visible button / element whose text contains `text`
    clickText: async (text, sel = 'button') => {
      const pos = await api.eval(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(sel)})].find((b) => b.textContent.includes(${JSON.stringify(text)}) && b.offsetParent !== null); if (!e) return null; e.scrollIntoView({block:'center'}); const r = e.getBoundingClientRect(); return [r.left + r.width/2, r.top + r.height/2]; })()`);
      if (!pos) throw new Error('no element with text: ' + text);
      await api.click(pos[0], pos[1]); await sleep(250);
    },
    waitFor: async (expr, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await api.eval(expr)) return true; } catch { /* page navigating */ } await sleep(200); } throw new Error('timeout waiting for ' + expr); },
    close: async () => { try { ws.close(); } catch { /* ignore */ } proc.kill(); await sleep(600); try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ } },
  };
  return api;
}
