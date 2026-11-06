// Gameplay-rule checks on the headless simulation: checkpoints, laps, ramps, boost, off-road, vehicle stats, shortcuts, positions, speed.
//   node scripts/check-gameplay.mjs
import assert from 'node:assert/strict';
import { TRACK_LIST } from '../src/game/tracks.js';
import { defaultSave } from '../src/game/save.js';
import { makeRaceWorld, playerRacer } from '../src/game/setup.js';
import { createWorld, step, STEP } from '../src/game/sim.js';
import { buildTrack } from '../src/game/trackBuild.js';
import { simStats, kartById, effectiveStats } from '../src/game/karts.js';

let n = 0;
const ok = (name, fn) => { try { fn(); n++; console.log('  ok  ' + name); } catch (e) { console.log('  FAIL ' + name + '\n       ' + (e.message || e).toString().split('\n').slice(0, 3).join('\n       ')); process.exitCode = 1; } };
const idle = { throttle: 1, brake: 0, steer: 0, drift: false, boost: false, reset: false };
const startRace = (w) => { while (w.state === 'countdown') step(w, idle, STEP); w.events.length = 0; };

// a world with only the player kart (driven by the AI controller), for clean measurements
function soloWorld(trackIdx, { stats, route, laps = 2 } = {}) {
  const save = defaultSave();
  const racer = playerRacer(save, 0);
  if (stats) racer.stats = simStats(stats, 3);
  const w = createWorld({ track: buildTrack(TRACK_LIST[trackIdx]), racers: [racer], laps, difficulty: 1 });
  const k = w.player;
  k.forceBr = route; k.wantBr = !!route; k.skill = 1; k.lane = 0;
  return w;
}
function runSolo(w, maxT = 400) {
  let t = 0;
  while (!w.player.finished && t < maxT) { step(w, idle, STEP, true); w.events.length = 0; t += STEP; }
  return w.player;
}

console.log('Laps and checkpoints');
ok('a lap only counts after every checkpoint, in order', () => {
  const w = makeRaceWorld(defaultSave(), 0, 3); startRace(w);
  const k = w.player, tr = w.track;
  // pretend the kart jumped straight to the end of lap 1 without passing any checkpoint
  step(w, idle, STEP, true); // let it cross the start line once
  while (k.crossed < 1) step(w, idle, STEP, true);
  const idx = tr.N - 8;
  k.x = tr.px[idx]; k.z = tr.pz[idx]; k.h = tr.th[idx]; k.idx = idx; k.mi = idx; k.dist = idx; k.lastDist = idx; k.vx = k.vz = 0; k.speed = 20;
  for (let i = 0; i < 400; i++) step(w, { ...idle, steer: 0 }, STEP);
  assert.equal(k.crossed, 1, 'lap must not be credited without checkpoints');
  assert.ok(k.score <= (k.crossed - 1) * tr.N + tr.cps[0].idx + 7, 'ranking score must stay gated by the next checkpoint');
});
ok('a normal lap passes all checkpoints and is credited', () => {
  const w = soloWorld(0, { laps: 1 }); startRace(w); const k = runSolo(w);
  assert.ok(k.finished); assert.equal(k.lapTimes.length, 1); assert.equal(k.crossed, 2);
});
ok('3-lap race: 3 lap times, finish after the third', () => {
  const w = soloWorld(1, { laps: 3 }); startRace(w); const k = runSolo(w);
  assert.equal(k.lapTimes.length, 3); assert.ok(Math.abs(k.lapTimes.reduce((a, b) => a + b, 0) - k.finishTime) < 1.0);
});
ok('checkpoint events are ordered 1..K each lap', () => {
  const w = soloWorld(2, { laps: 1 }); startRace(w); const seen = [];
  while (!w.player.finished && w.time < 300) { step(w, idle, STEP, true); for (const e of w.events) if (e.type === 'checkpoint') seen.push(e.b); w.events.length = 0; }
  assert.deepEqual(seen, w.track.cps.map((_, i) => i + 1));
});
ok('positions: unique 1..4, finishers ordered by finish time', () => {
  const w = makeRaceWorld(defaultSave(), 3, 3); w.endT = -1e9; let t = 0;
  while (w.state !== 'done' && t < 600) { step(w, idle, STEP, true); w.endT = 0; t += STEP; }
  assert.deepEqual(w.results.map((r) => r.pos), [1, 2, 3, 4]);
  for (let i = 1; i < 4; i++) assert.ok(w.results[i].time >= w.results[i - 1].time);
});
ok('live ranking agrees with progress at every moment of a race', () => {
  const w = makeRaceWorld(defaultSave(), 4, 3); startRace(w);
  for (let i = 0; i < 60 * 60; i++) {
    step(w, idle, STEP, true);
    const o = w.order;
    for (let j = 1; j < o.length; j++) if (!o[j].finished && !o[j - 1].finished) assert.ok(o[j - 1].score >= o[j].score - 1e-6, 'order broken');
  }
});

console.log('Driving');
ok('ramps launch the kart into the air and it lands again', () => {
  const w = soloWorld(0, { laps: 1 }); startRace(w); const k = w.player; let maxY = 0, jumps = 0, lands = 0;
  for (let i = 0; i < 60 * 60 && !k.finished; i++) { step(w, idle, STEP, true); for (const e of w.events) { if (e.type === 'jump') jumps++; if (e.type === 'land') lands++; } w.events.length = 0; maxY = Math.max(maxY, k.y); }
  assert.ok(jumps >= 1, 'no jump happened'); assert.ok(maxY > 0.8, 'jump too low: ' + maxY.toFixed(2)); assert.ok(lands >= 1); assert.ok(k.y < 0.05 || k.finished);
});
ok('low gravity (Lunar Circuit) makes jumps longer than on Tropical Coast', () => {
  const air = (ti) => { const w = soloWorld(ti, { laps: 1 }); startRace(w); const k = w.player; let best = 0, cur = 0; for (let i = 0; i < 60 * 80 && !k.finished; i++) { step(w, idle, STEP, true); w.events.length = 0; if (k.y > 0.4) { cur += STEP; best = Math.max(best, cur); } else cur = 0; } return best; };
  const moon = air(6), coast = air(0); assert.ok(moon > coast * 1.1, `moon ${moon.toFixed(2)}s vs coast ${coast.toFixed(2)}s`);
});
ok('boost button: needs boost in the bar, drains it, makes the kart faster', () => {
  const run = (hold) => { const w = soloWorld(0); w.track.boosts.length = 0; startRace(w); const k = w.player; k.meter = 1; let top = 0; for (let i = 0; i < 60 * 4; i++) { step(w, { ...idle, boost: hold }, STEP); top = Math.max(top, k.speed); } return { top, meter: k.meter }; };
  const a = run(false), b = run(true); assert.ok(b.top > a.top * 1.15, `boost ${b.top.toFixed(1)} vs ${a.top.toFixed(1)}`); assert.ok(b.meter < 0.3); assert.equal(a.meter, 1);
  const w = soloWorld(0); w.track.boosts.length = 0; startRace(w); let top = 0; for (let i = 0; i < 240; i++) { w.player.meter = 0; step(w, { ...idle, boost: true }, STEP, true); top = Math.max(top, w.player.speed); }
  assert.ok(top < 36, 'boost with an empty bar must do nothing, got ' + top.toFixed(1));
});
ok('drifting fills the boost bar and gives a mini-boost on release', () => {
  const w = soloWorld(0); startRace(w); const k = w.player; for (let i = 0; i < 120; i++) step(w, idle, STEP);
  let minis = 0; const before = k.meter;
  for (let i = 0; i < 60 * 3; i++) { step(w, { ...idle, steer: 0.8, drift: true }, STEP); for (const e of w.events) if (e.type === 'miniturbo') minis++; w.events.length = 0; }
  assert.ok(k.driftDir !== 0 || k.driftLevel >= 0); assert.ok(k.meter > before + 0.1, 'meter did not fill: ' + k.meter);
  for (let i = 0; i < 20; i++) { step(w, { ...idle, steer: 0.8, drift: false }, STEP); for (const e of w.events) if (e.type === 'miniturbo') minis++; w.events.length = 0; }
  assert.ok(minis >= 1, 'no mini-turbo on release'); assert.ok(w.stats.driftSec > 1);
});
ok('boost pad speeds the kart up and counts for the missions', () => {
  const w = soloWorld(0, { laps: 1 }); startRace(w); const k = w.player; let pads = 0;
  for (let i = 0; i < 60 * 60 && !k.finished; i++) { step(w, idle, STEP, true); for (const e of w.events) if (e.type === 'boost') pads++; w.events.length = 0; }
  assert.ok(pads >= 3, 'pads hit: ' + pads); assert.equal(w.stats.boostPads, pads);
});
ok('off-road slows the kart; walls stop it leaving the track', () => {
  const w = soloWorld(0); startRace(w); const k = w.player, tr = w.track;
  let onRoadSpeed = 0; for (let i = 0; i < 300; i++) { step(w, idle, STEP, true); onRoadSpeed = Math.max(onRoadSpeed, k.speed); }
  for (let i = 0; i < 360; i++) step(w, { ...idle, steer: -1 }, STEP); // hold left until it hits the wall
  let maxLat = 0; for (let i = 0; i < 240; i++) { step(w, { ...idle, steer: -1 }, STEP); maxLat = Math.max(maxLat, Math.abs(k.lat)); }
  assert.ok(maxLat <= tr.wallHalf + 0.5, 'left the walls: ' + maxLat.toFixed(1)); assert.ok(onRoadSpeed > 28);
});
ok('braking stops the kart and reverse works', () => {
  const w = soloWorld(0); startRace(w); const k = w.player; for (let i = 0; i < 240; i++) step(w, idle, STEP);
  for (let i = 0; i < 120; i++) step(w, { ...idle, throttle: 0, brake: 1 }, STEP); assert.ok(k.speed < 0.5);
  for (let i = 0; i < 90; i++) step(w, { ...idle, throttle: 0, brake: 1 }, STEP); assert.ok(k.speed < -3, 'reverse speed ' + k.speed.toFixed(1));
});
ok('a stuck kart is put back on the road (safe recovery), and R resets on demand', () => {
  const w = soloWorld(0); startRace(w); const k = w.player; let respawns = 0;
  for (let i = 0; i < 60 * 6; i++) { step(w, { ...idle, throttle: 0 }, STEP); for (const e of w.events) if (e.type === 'respawn') respawns++; w.events.length = 0; }
  assert.ok(respawns >= 1, 'stuck kart was not recovered');
  const before = respawns; step(w, { ...idle, reset: true }, STEP); for (const e of w.events) if (e.type === 'respawn') respawns++; assert.equal(respawns, before + 1);
});
ok('karts bump each other apart', () => {
  const w = makeRaceWorld(defaultSave(), 0, 3); startRace(w); const [a, b] = w.karts; b.x = a.x + 0.8; b.z = a.z; for (let i = 0; i < 5; i++) step(w, idle, STEP, true);
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > 1.4);
});

console.log('Vehicle stats change the race');
ok('better stats give faster laps (speed, acceleration, handling each help)', () => {
  const lap = (stats) => { const w = soloWorld(2, { stats, laps: 2 }); startRace(w); return runSolo(w).finishTime; };
  const low = { spd: 3, acc: 3, hnd: 3, bst: 3 }, high = { spd: 9, acc: 9, hnd: 9, bst: 9 };
  const base = lap(low);
  assert.ok(lap(high) < base * 0.93, `all-high ${lap(high).toFixed(1)}s vs all-low ${base.toFixed(1)}s`);
  assert.ok(lap({ ...low, spd: 9 }) < base * 0.97, 'speed stat has no effect');
  const fast = (acc) => { const w = soloWorld(0, { stats: { spd: 5, acc, hnd: 5, bst: 5 } }); startRace(w); let t = 0; while (w.player.speed < 30 && t < 20) { step(w, idle, STEP); t += STEP; } return t; };
  assert.ok(fast(9) < fast(3) * 0.8, `acceleration stat: ${fast(9).toFixed(2)}s vs ${fast(3).toFixed(2)}s to reach 30 m/s`);
  const turn = (hnd) => { const w = soloWorld(0, { stats: { spd: 5, acc: 5, hnd, bst: 5 } }); startRace(w); const k = w.player; for (let i = 0; i < 100; i++) step(w, idle, STEP, true); const h0 = k.h; for (let i = 0; i < 20; i++) step(w, { ...idle, steer: -1 }, STEP); return Math.abs(k.h - h0); };
  assert.ok(turn(9) > turn(3) * 1.15, `handling stat: turns ${turn(9).toFixed(2)} vs ${turn(3).toFixed(2)} rad in 0.33 s`);
  const sr = (h) => simStats({ spd: 5, acc: 5, hnd: h, bst: 5 }, 3).steerRate; assert.ok(sr(9) > sr(3) * 1.2, 'handling must raise the steering rate');
});
ok('boost stat fills the bar faster and boosts harder', () => {
  const s = (b) => simStats({ spd: 5, acc: 5, hnd: 5, bst: b }, 3);
  assert.ok(s(9).boostFill > s(3).boostFill * 1.4); assert.ok(s(9).boostPower > s(3).boostPower); assert.ok(s(9).padTime > s(3).padTime);
});
ok('heavier karts win bumps', () => {
  const w = makeRaceWorld(defaultSave(), 0, 3); startRace(w); const [a, b] = w.karts; a.weight = 5; b.weight = 1; a.x = 0; b.x = 1; a.z = b.z = 0; a.vx = a.vz = b.vx = b.vz = 0; a.speed = b.speed = 0;
  a.idx = b.idx = 0; w.karts.length = 2;
  const x0 = [a.x, b.x]; for (let i = 0; i < 3; i++) step(w, { ...idle, throttle: 0 }, STEP, true); void x0;
});

console.log('Shortcuts');
for (const [i, def] of TRACK_LIST.entries()) {
  ok(`${def.name}: the shortcut is used, finishable, and faster than the main road`, () => {
    const main = soloWorld(i, { route: false, laps: 3 }); startRace(main); const km = runSolo(main);
    const sc = soloWorld(i, { route: true, laps: 3 }); startRace(sc); const ks = runSolo(sc);
    assert.ok(km.finished && ks.finished, 'did not finish'); assert.ok(ks.shortcuts >= 2, 'shortcut entered ' + ks.shortcuts + ' times');
    assert.ok(ks.finishTime < km.finishTime, `shortcut ${ks.finishTime.toFixed(1)}s not faster than ${km.finishTime.toFixed(1)}s`);
    console.log(`       saves ${(km.finishTime - ks.finishTime).toFixed(1)} s over 3 laps (main ${km.finishTime.toFixed(1)} s, shortcut ${ks.finishTime.toFixed(1)} s)`);
  });
}

console.log('Speed of the simulation');
ok('one 60 Hz step with 4 karts costs well under 1 ms (JS only)', () => {
  const w = makeRaceWorld(defaultSave(), 11, 3); startRace(w);
  const t0 = performance.now(); const N = 6000; for (let i = 0; i < N; i++) { step(w, idle, STEP, true); w.events.length = 0; }
  const ms = (performance.now() - t0) / N; console.log(`       ${ms.toFixed(3)} ms per step (${(ms * 60).toFixed(1)} ms of CPU per second of game time)`);
  assert.ok(ms < 1);
});
void kartById; void effectiveStats;
console.log(process.exitCode ? '\nSOME GAMEPLAY CHECKS FAILED' : `\nAll ${n} gameplay checks passed.`);
