// Pictures for the PDF guide (docs/guide/images/*.jpg), taken from the built game in headless Chrome.
//   npm run build && node scripts/guide-shots.mjs
import { mkdirSync } from 'node:fs';
import { serveDist, launch, sleep } from './lib/cdp.mjs';

const out = 'docs/guide/images';
mkdirSync(out, { recursive: true });
const srv = await serveDist();

// a save in the middle of the campaign, so the screens show stars, times and claimable missions
const DEMO = `(() => { const s = window.__store.getState(); const sv = { ...s.save, coins: 1860, unlocked: 5,
  tracks: { tropical: { stars: 3, best: 98.5, bestLap: 31.2, tasks: [true, true, true], finished: true }, snow: { stars: 2, best: 101.2, bestLap: 32.6, tasks: [true, true, false], finished: true },
            desert: { stars: 2, best: 96.4, bestLap: 31.0, tasks: [true, true, true], finished: true }, jungle: { stars: 1, best: 131.0, bestLap: 42.1, tasks: [true, false, false], finished: true } },
  totals: { ...s.save.totals, coins: 160, driftSec: 64, pads: 12, wins: 1, races: 5, ramps: 7, shortcuts: 6, boostSec: 14, fastest: 96.4 } };
  window.__store.setState({ save: sv, selected: 4 }); })()`;

async function desktop() {
  const b = await launch({ width: 1280, height: 720 });
  try {
    await b.goto(srv.url); await b.waitFor('!!window.__store');
    await b.shot(`${out}/menu-new.jpg`);
    await b.eval(DEMO);
    for (const scr of ['menu', 'map', 'garage', 'missions', 'settings']) {
      await b.eval(`window.__store.getState().go(${JSON.stringify(scr)})`); await sleep(scr === 'garage' || scr === 'menu' ? 2200 : 900);
      await b.shot(`${out}/${scr}.jpg`);
    }
    await b.eval('window.__store.getState().go("garage")'); await sleep(600);
    await b.clickText('UPGRADES', '.gtabs button'); await sleep(1200); await b.shot(`${out}/garage-upgrades.jpg`);
    // races: a driving picture of three tracks, then a real finished race for the results screen
    for (const [i, name] of [[0, 'race-tropical'], [6, 'race-lunar'], [10, 'race-aurora'], [11, 'race-castle']]) {
      await b.eval(`window.__store.setState({ save: { ...window.__store.getState().save, unlocked: 12 } }); window.__store.getState().startRace(${i})`);
      await b.waitFor('!!(window.__sky && window.__sky.world && window.__sky.visuals)', 40000);
      await b.eval('window.__sky.autopilot = true;');
      await sleep(i === 0 ? 3200 : 11000);
      await b.shot(`${out}/${name}.jpg`);
      if (i === 0) { await b.eval('window.__store.getState().setPaused(true)'); await sleep(500); await b.shot(`${out}/pause.jpg`); await b.eval('window.__store.getState().setPaused(false)'); }
    }
    await b.eval('window.__store.getState().startRace(1)'); await b.waitFor('!!(window.__sky && window.__sky.world)', 40000);
    await b.eval('window.__sky.autopilot = true; window.__sky.timeScale = 9;');
    await b.waitFor('window.__store.getState().screen === "results"', 150000); await sleep(800);
    await b.shot(`${out}/results.jpg`);
    // a shortcut seen from above (Tropical Coast, Sand Spit)
    await b.eval('window.__store.getState().startRace(0)'); await b.waitFor('!!(window.__sky && window.__sky.world && window.__sky.visuals)', 40000);
    await b.eval(`(() => { const w = window.__sky.world, tr = w.track, sc = tr.branch; const i = sc ? Math.floor(sc.M / 2) : 0; const x = sc ? sc.px[i] : tr.px[0], z = sc ? sc.pz[i] : tr.pz[0];
      window.__sky.debugCam = { x: x + 120, y: 150, z: z + 120, lx: x, ly: 0, lz: z, fov: 45 }; window.__sky.timeScale = 0.01; document.querySelectorAll('.hud').forEach((e) => { e.style.display = 'none'; }); })()`);
    await sleep(2500); await b.shot(`${out}/shortcut-aerial.jpg`);
    const errs = b.logs.filter((l) => l.type === 'error' || l.type === 'exception');
    console.log('desktop console errors:', errs.length, JSON.stringify(errs.slice(0, 3)));
  } finally { await b.close(); }
}

async function phone() {
  const b = await launch({ width: 844, height: 390, mobile: true });
  try {
    await b.goto(srv.url); await b.waitFor('!!window.__store');
    await b.eval(DEMO);
    await b.eval('window.__store.getState().startRace(0)'); await b.waitFor('!!(window.__sky && window.__sky.world && window.__sky.visuals)', 40000);
    await b.eval('window.__sky.autopilot = true;'); await sleep(7000);
    await b.shot(`${out}/phone-race.jpg`);
    await b.eval('window.__store.getState().quitRace()'); await sleep(300);
    await b.setSize(390, 844, true); await sleep(900);
    for (const scr of ['menu', 'map', 'garage']) { await b.eval(`window.__store.getState().go(${JSON.stringify(scr)})`); await sleep(scr === 'map' ? 900 : 2200); await b.shot(`${out}/phone-${scr}.jpg`); }
  } finally { await b.close(); }
}

try { await desktop(); await phone(); } finally { await srv.close(); }
console.log('pictures written to', out);
process.exit(0);
