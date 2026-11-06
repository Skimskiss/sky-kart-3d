// Quick visual check: node scripts/shot.mjs <outdir> [trackIndex] [width height]
// Opens the built game, takes menu / map / garage screenshots and a race screenshot of the given track (the player is driven by autopilot).
import { mkdirSync } from 'node:fs';
import { serveDist, launch, sleep } from './lib/cdp.mjs';

const out = process.argv[2] || 'scripts/out';
const ti = Number(process.argv[3] || 0);
const W = Number(process.argv[4] || 1280), H = Number(process.argv[5] || 720);
mkdirSync(out, { recursive: true });
const srv = await serveDist();
const b = await launch({ width: W, height: H });
try {
  await b.goto(srv.url);
  await b.waitFor("!!document.querySelector(\".menu\")");
  await sleep(1500);
  await b.shot(`${out}/menu.png`);
  await b.eval('window.__store.getState().go("map")'); await sleep(600); await b.shot(`${out}/map.png`);
  await b.eval('window.__store.getState().go("garage")'); await sleep(2000); await b.shot(`${out}/garage.png`);
  await b.eval('window.__store.getState().go("missions")'); await sleep(500); await b.shot(`${out}/missions.png`);
  await b.eval(`window.__store.setState({ save: { ...window.__store.getState().save, unlocked: 12 } }); window.__store.getState().startRace(${ti})`);
  await b.waitFor("!!(window.__sky && window.__sky.world)", 30000);
  await b.eval('window.__sky.autopilot = true; window.__sky.timeScale = 1;');
  await sleep(9000);
  await b.shot(`${out}/race-${ti}.png`);
  console.log('console:', JSON.stringify(b.logs.filter((l) => l.type !== 'log' && l.type !== 'debug').slice(0, 10)));
  console.log('fps', await b.eval('window.__sky.fps'));
} finally { await b.close(); await srv.close(); }
process.exit(0);
