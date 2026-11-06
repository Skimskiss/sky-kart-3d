// Screenshots of every track: node scripts/tour.mjs <outdir> [aerial|drive] [width height] [firstIndex lastIndex]
// "aerial" is also what scripts/make-previews.mjs uses for the track thumbnails.
import { mkdirSync } from 'node:fs';
import { serveDist, launch, sleep } from './lib/cdp.mjs';

const out = process.argv[2] || 'scripts/out/tour';
const mode = process.argv[3] || 'drive';
const W = Number(process.argv[4] || 960), H = Number(process.argv[5] || 540);
const first = Number(process.argv[6] || 0), last = Number(process.argv[7] || 11);
mkdirSync(out, { recursive: true });
const srv = await serveDist();
const b = await launch({ width: W, height: H });
try {
  await b.goto(srv.url);
  await b.waitFor('!!window.__store');
  for (let ti = first; ti <= last; ti++) {
    await b.eval(`window.__store.setState({ save: { ...window.__store.getState().save, unlocked: 12 } }); window.__store.getState().startRace(${ti})`);
    await b.waitFor('!!(window.__sky && window.__sky.world && window.__sky.visuals)', 40000);
    if (mode === 'aerial') {
      await b.eval(`(() => { const w = window.__sky.world, tr = w.track; let cx = 0, cz = 0; for (let i = 0; i < tr.N; i++) { cx += tr.px[i]; cz += tr.pz[i]; } cx /= tr.N; cz /= tr.N; let R = 0; for (let i = 0; i < tr.N; i++) R = Math.max(R, Math.hypot(tr.px[i] - cx, tr.pz[i] - cz)); const a = 0.9; window.__sky.debugCam = { x: cx + Math.cos(a) * R * 1.55, y: R * 1.0, z: cz + Math.sin(a) * R * 1.55, lx: cx, ly: -6, lz: cz, fov: 42 }; window.__sky.timeScale = 0.01; document.querySelectorAll('.hud, .touch').forEach((e) => { e.style.display = 'none'; }); })()`);
      await sleep(2500);
    } else {
      await b.eval('window.__sky.autopilot = true; window.__sky.debugCam = null; window.__sky.timeScale = 1;');
      await sleep(11000);
    }
    const id = await b.eval('window.__sky.world.track.id');
    await b.shot(mode === 'aerial' && out.endsWith('previews') ? `${out}/${id}.jpg` : `${out}/${String(ti + 1).padStart(2, '0')}-${id}-${mode}.${mode === 'aerial' ? 'jpg' : 'png'}`);
    await b.eval('window.__store.getState().go("map")');
    await sleep(300);
  }
  const errs = b.logs.filter((l) => l.type === 'error' || l.type === 'exception' || l.type === 'warning');
  console.log('console problems:', errs.length, JSON.stringify(errs.slice(0, 6)));
} finally { await b.close(); await srv.close(); }
process.exit(0);
