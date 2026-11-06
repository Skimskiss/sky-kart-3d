// Screenshots of every menu screen at a given size: node scripts/screens.mjs <outdir> <width> <height> [mobile]
import { mkdirSync } from 'node:fs';
import { serveDist, launch, sleep } from './lib/cdp.mjs';
const [out = 'scripts/out/screens', W = '390', H = '844', mob = 'mobile'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const srv = await serveDist();
const b = await launch({ width: +W, height: +H, mobile: mob === 'mobile' });
try {
  await b.goto(srv.url); await b.waitFor('!!window.__store');
  await b.eval('(() => { const s = window.__store.getState(); const sv = { ...s.save, coins: 1234, unlocked: 4, tracks: { tropical: { stars: 3, best: 98.5, bestLap: 31, tasks: [true, true, true], finished: true }, snow: { stars: 2, best: 101.2, bestLap: 32, tasks: [true, true, false], finished: true }, desert: { stars: 1, best: 120, bestLap: 38, tasks: [true, false, false], finished: true } }, totals: { ...s.save.totals, coins: 40, driftSec: 6, pads: 3, wins: 1, races: 3, fastest: 98.5 } }; window.__store.setState({ save: sv, selected: 3 }); })()');
  for (const scr of ['menu', 'map', 'garage', 'missions', 'settings']) {
    await b.eval(`window.__store.getState().go(${JSON.stringify(scr)})`); await sleep(scr === 'garage' ? 2200 : 900); await b.shot(`${out}/${scr}.png`);
  }
  await b.eval(`window.__store.setState({ screen: 'results', results: { trackIndex: 1, laps: 3, summary: { finished: true, pos: 2, time: 101.2, stars: 2, newStars: 1, placeCoins: 100, pickupCoins: 64, starCoins: 100, taskCoins: 50, total: 314, newBest: true, unlockedNext: true, tasks: [true, true, false], newTasks: [false, true, false] }, rows: [{ id: 'a', name: 'Mochi', look: { body: '#ec4899' }, isPlayer: false, pos: 1, time: 99.8 }, { id: 'p', name: 'You', look: { body: '#e63946' }, isPlayer: true, pos: 2, time: 101.2 }, { id: 'c', name: 'Gus', look: { body: '#22c55e' }, isPlayer: false, pos: 3, time: 104.4 }, { id: 'd', name: 'Rusty', look: { body: '#f97316' }, isPlayer: false, pos: 4, time: 110.1 }] } })`);
  await sleep(600); await b.shot(`${out}/results.png`);
  await b.eval('window.__store.getState().startRace(0)'); await b.waitFor('!!(window.__sky && window.__sky.world)', 40000);
  await b.waitFor('window.__sky.world.state === "racing"', 15000); await b.eval('window.__sky.autopilot = true;'); await sleep(4000);
  await b.eval('window.__store.getState().setPaused(true)'); await sleep(500); await b.shot(`${out}/pause.png`);
  const bad = b.logs.filter((l) => l.type === 'error' || l.type === 'exception' || l.type === 'warning');
  console.log('console problems:', bad.length, JSON.stringify(bad.slice(0, 3)));
} finally { await b.close(); await srv.close(); }
process.exit(0);
