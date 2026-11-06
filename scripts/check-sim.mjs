// Headless race checks on every track. The player kart is driven by the AI (autoplayer) so we can check that races are finishable.
//   node scripts/check-sim.mjs [trackId]
import { TRACK_LIST } from '../src/game/tracks.js';
import { defaultSave } from '../src/game/save.js';
import { makeRaceWorld } from '../src/game/setup.js';
import { step, STEP } from '../src/game/sim.js';

const only = process.argv[2];
const idle = { throttle: 1, brake: 0, steer: 0, drift: false, boost: false, reset: false };
let bad = 0;
const rows = [];
TRACK_LIST.forEach((def, ti) => {
  if (only && def.id !== only) return;
  const w = makeRaceWorld(defaultSave(), ti, 3);
  let t = 0, respawns = 0, hits = 0, cps = 0, shortcuts = 0, nan = 0, laps = 0;
  while (w.state !== 'done' && t < 600) {
    step(w, idle, STEP, true); w.endT = 0; // keep going until every kart finishes
    for (const e of w.events) { if (e.type === 'respawn') respawns++; if (e.type === 'hit') hits++; if (e.type === 'checkpoint') cps++; if (e.type === 'shortcut') shortcuts++; if (e.type === 'lap') laps++; }
    w.events.length = 0;
    for (const k of w.karts) if (!Number.isFinite(k.x + k.z + k.speed + k.dist)) nan++;
    t += STEP;
  }
  const fin = w.karts.filter((k) => k.finished);
  const first = Math.min(...fin.map((k) => k.finishTime));
  const lapOk = w.karts.every((k) => !k.finished || k.lapTimes.length === 3);
  const ok = w.state === 'done' && fin.length === 4 && respawns < 6 && nan === 0 && lapOk && cps > 0;
  if (!ok) { bad++; console.log(`  FAIL ${def.id}: state=${w.state} finished=${fin.length}/4 respawns=${respawns} nan=${nan} lapOk=${lapOk} cps=${cps}`); }
  rows.push({ id: def.id, finished: `${fin.length}/4`, winner: first.toFixed(1) + 's', par: def.par, respawns, hits, shortcuts, coins: w.stats.coins });
});
console.table(rows);
console.log(bad ? `${bad} track(s) failed` : 'All AI races finished.');
process.exit(bad ? 1 : 0);
