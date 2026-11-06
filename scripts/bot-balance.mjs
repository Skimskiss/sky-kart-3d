// Difficulty check with simulated human players that use the real input path (steer / throttle / drift / boost):
//   "casual"  : slower, wobbly steering, never drifts, boosts rarely      "good": drifts, boosts, small steering errors
// Prints each bot's finishing position and time per track so the AI difficulty curve can be tuned.
//   node scripts/bot-balance.mjs [runs=3]
import { TRACK_LIST } from '../src/game/tracks.js';
import { defaultSave } from '../src/game/save.js';
import { makeRaceWorld } from '../src/game/setup.js';
import { step, STEP } from '../src/game/sim.js';
import { aiControl } from '../src/game/ai.js';

const runs = Number(process.argv[2] || 3);
// KART=skyhawk UPG=3 node scripts/bot-balance.mjs  -> test with another kart / upgrade level
const save = defaultSave();
if (process.env.KART) { save.garage.owned.push(process.env.KART); save.garage.kart = process.env.KART; const u = Number(process.env.UPG || 0); save.garage.upgrades[process.env.KART] = { spd: u, acc: u, hnd: u, bst: u }; }
const tmp = {};
function race(ti, kind, seed) {
  const w = makeRaceWorld(save, ti, 3);
  const k = w.player;
  k.forceBr = kind === 'good' ? true : seed % 2 === 0; k.wantBr = k.forceBr; // good players take the shortcut every lap
  k.skill = kind === 'good' ? 1.0 : 0.9; k.lane = (seed % 3 - 1) * 2.5;
  let wob = 0, rs = seed * 7919 + 1;
  const rnd = () => { rs = (rs * 16807) % 2147483647; return rs / 2147483647; };
  const input = { steer: 0, throttle: 1, brake: 0, drift: false, boost: false, reset: false };
  let t = 0;
  while (w.state !== 'done' && t < 400) {
    // the bot "sees" the road like the AI does, then adds human-like imperfection
    const d0 = w.difficulty; w.difficulty = kind === 'good' ? 1.0 : 0.9; // a human is not limited by the rivals' difficulty factor
    aiControl(w, k, tmp);
    w.difficulty = d0;
    wob += (rnd() - 0.5) * (kind === 'good' ? 0.07 : 0.2); wob *= 0.9;
    input.steer = Math.max(-1, Math.min(1, tmp.steer + wob));
    input.throttle = tmp.throttle; input.brake = tmp.brake;
    input.drift = false; // (the bot has no feel for drifting; real players gain mini-boosts from it)
    input.boost = tmp.boost && (kind === 'good' || rnd() < 0.02);
    step(w, input, STEP); w.events.length = 0; t += STEP;
  }
  const me = w.results && w.results.find((r) => r.isPlayer);
  return { pos: me ? me.pos : 4, time: me && me.time ? me.time : NaN, shortcuts: k.shortcuts };
}
console.log('track'.padEnd(10), 'casual pos/time'.padEnd(22), 'good pos/time');
for (const [ti, def] of TRACK_LIST.entries()) {
  const row = {};
  for (const kind of ['casual', 'good']) {
    const rs = Array.from({ length: runs }, (_, i) => race(ti, kind, i + 1));
    row[kind] = `${rs.map((r) => r.pos).join(',')} / ${(rs.reduce((a, r) => a + r.time, 0) / runs).toFixed(0)}s`;
  }
  console.log(def.id.padEnd(10), row.casual.padEnd(22), row.good);
}
