// Fixed-timestep race simulation. Pure JS (no three.js, no DOM) so it also runs in Node tests.
// Conventions: forward = (sin h, cos h); increasing h turns LEFT; steer +1 = right; lat +1 = right of the centre line.
import { locate, resolveWalls, rampAt, angDiff, wrapIdx } from './trackBuild.js';
import { aiControl } from './ai.js';

export const STEP = 1 / 60;
const GRAV = 30;
const GLIDE_GRAV = 11;
const MINI = [0, 0.75, 1.3, 2.0];     // seconds of boost for drift levels 1..3
const DRIFT_T = [0.9, 2.0, 3.4];      // seconds of drifting needed for each level
const PAD_POWER = 1.38;               // top-speed factor of pad / mini-turbo boosts
const BURN = 0.34;                    // boost bar used per second while the boost button is held
// chance that an AI kart goes for the shortcut on a given lap
const SHORTCUT_CHANCE = 0.55;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ev = (w, type, a, b, c) => w.events.push({ type, a, b, c });

function makeKart(w, racer, slot) {
  const tr = w.track;
  const row = Math.floor(slot / 2), col = slot % 2;
  const idx = (tr.N - 6 - row * 3 + tr.N) % tr.N;
  const lat = col ? 3.4 : -3.4;
  const st = racer.stats;
  return {
    id: racer.id, name: racer.name, look: racer.look, isPlayer: !!racer.isPlayer,
    maxSpeed: st.maxSpeed, accel: st.accel, steerRate: st.steerRate, boostFill: st.boostFill, boostPower: st.boostPower, padTime: st.padTime, weight: st.weight,
    x: tr.px[idx] + tr.nx[idx] * lat, z: tr.pz[idx] + tr.nz[idx] * lat, y: 0, vy: 0, h: tr.th[idx],
    px: 0, pz: 0, ph: 0, py: 0,
    vx: 0, vz: 0, speed: 0, steerVis: 0, spinAngle: 0,
    driftDir: 0, driftTime: 0, driftLevel: 0, boostT: 0, boosting: false, meter: racer.isPlayer ? 0 : 0.25, spinT: 0, invT: 0, glide: false, airT: 0,
    padCool: 0, bumpCool: 0, gh: 0, onRamp: null, rampVy: 0, rampPow: 0, rampGlide: false,
    idx, lat, dist: idx - tr.N, lastDist: idx - tr.N, lastGoodIdx: idx, stuckT: 0, wrongT: 0,
    crossed: 0, nextCp: 0, lapStart: 0, lapTimes: [], bestLap: Infinity, lap: 0,
    finished: false, finishTime: 0, rank: slot, lane: (Math.random() * 2 - 1) * 3.5,
    skill: racer.skill ?? (0.95 + Math.random() * 0.06),
    th: tr.th[idx], half: tr.halfRoad, wall: tr.wallHalf, zone: 0, onRoad: true, br: false, bj: 0, mi: idx, bvalid: false, wnx: 0, wnz: 0,
    wantBr: false, forceBr: undefined, brIn: false, shortcuts: 0, dodgeFor: null, dodgeSide: 1,
  };
}

// An AI kart decides at the start of every lap whether to try the shortcut.
function pickRoute(w, k) {
  if (!w.track.branch) { k.wantBr = false; return; }
  if (k.forceBr !== undefined) { k.wantBr = k.forceBr; return; }
  k.wantBr = Math.random() < SHORTCUT_CHANCE;
}

export function createWorld({ track, racers, laps = 3, difficulty = 0.9 }) {
  const w = {
    track, laps, difficulty, state: 'countdown', cd: 3.99, cdShown: 4, time: 0, karts: [], order: [],
    events: [], movers: track.movers, coins: track.coins, endT: 0, results: null,
    shake: 0, player: null, ctl: { throttle: 0, brake: 0, steer: 0, drift: false, boost: false, reset: false },
    stats: { coins: 0, driftSec: 0, boostPads: 0, ramps: 0, shortcuts: 0, miniTurbos: 0, hits: 0, boostSec: 0, maxSpeed: 0 },
  };
  racers.forEach((r, i) => {
    const k = makeKart(w, r, r.slot ?? i);
    w.karts.push(k);
    if (k.isPlayer) w.player = k;
  });
  for (const k of w.karts) if (!k.isPlayer) pickRoute(w, k);
  w.order = w.karts.slice();
  syncPrev(w);
  return w;
}

function syncPrev(w) { for (const k of w.karts) { k.px = k.x; k.pz = k.z; k.ph = k.h; k.py = k.y; } }

// Position score: laps are only counted through validated checkpoints, so skipping ahead cannot gain places.
export function progressScore(w, k) {
  const tr = w.track, N = tr.N;
  if (k.crossed === 0) return Math.min(k.dist, 0);
  const base = (k.crossed - 1) * N;
  const lim = k.nextCp < tr.cps.length ? base + tr.cps[k.nextCp].idx + 6 : base + N;
  return Math.min(k.dist, lim);
}

export function rankOrder(w) {
  for (const k of w.karts) k.score = progressScore(w, k);
  const o = w.order;
  for (let i = 1; i < o.length; i++) {
    const k = o[i];
    let j = i - 1;
    while (j >= 0 && ahead(k, o[j])) { o[j + 1] = o[j]; j--; }
    o[j + 1] = k;
  }
  for (let i = 0; i < o.length; i++) o[i].rank = i;
}

function ahead(a, b) {
  if (a.finished && b.finished) return a.finishTime < b.finishTime;
  if (a.finished) return true;
  if (b.finished) return false;
  return a.score > b.score;
}

function hitKart(w, k) {
  if (k.invT > 0 || k.spinT > 0) return false;
  k.spinT = 1.0;
  k.speed *= 0.35;
  k.boostT = 0; k.driftDir = 0; k.driftTime = 0; k.driftLevel = 0;
  if (k.y <= k.gh + 0.01) k.vy = 7;
  ev(w, 'hit', k);
  if (k.isPlayer) { w.shake = 1; w.stats.hits++; }
  return true;
}

function respawn(w, k) {
  const tr = w.track;
  k.idx = k.lastGoodIdx; k.dist = k.lastDist;
  k.x = tr.px[k.idx]; k.z = tr.pz[k.idx]; k.h = tr.th[k.idx];
  k.vx = k.vz = k.speed = 0; k.y = 0; k.vy = 0; k.gh = 0; k.onRamp = null;
  k.spinT = 0; k.boostT = 0; k.driftDir = 0; k.driftTime = 0; k.driftLevel = 0;
  k.invT = 2.2; k.stuckT = 0; k.wrongT = 0; k.lat = 0;
  k.br = false; k.bj = 0; k.mi = k.idx; k.bvalid = false; k.brIn = false;
  k.th = tr.th[k.idx]; k.half = tr.halfRoad; k.wall = tr.wallHalf; k.zone = tr.zone[k.idx]; k.onRoad = true;
  k.px = k.x; k.pz = k.z; k.ph = k.h;
  ev(w, 'respawn', k);
}

function addMeter(k, v) { k.meter = clamp(k.meter + v * k.boostFill, 0, 1); }

function updateKart(w, k, c, dt) {
  const tr = w.track;
  if (k.spinT > 0) k.spinT -= dt;
  if (k.boostT > 0) k.boostT -= dt;
  if (k.invT > 0) k.invT -= dt;
  if (k.padCool > 0) k.padCool -= dt;
  if (k.bumpCool > 0) k.bumpCool -= dt;

  const grounded = k.y <= k.gh + 0.02 && k.vy <= 0;
  const spinning = k.spinT > 0;
  const racing = w.state !== 'countdown';
  const throttle = racing && !spinning ? c.throttle : 0;
  const brake = racing && !spinning ? c.brake : 0;
  const steer = racing && !spinning ? c.steer : 0;
  const off = !k.onRoad;
  const zone = k.zone;

  // boost bar: hold the button to burn it
  k.boosting = racing && !spinning && c.boost && k.meter > 0.01;
  if (k.boosting) { k.meter = Math.max(0, k.meter - BURN * dt); if (k.isPlayer) w.stats.boostSec += dt; }
  if (!k.isPlayer && racing) addMeter(k, 0.05 * dt);

  let surf = 1, grip = 9;
  if (off) surf = 0.55;
  if (k.br) {
    surf = Math.min(surf, tr.branch.speed);
    if (zone === 3) grip = 2.4;
  } else if (zone === 1) surf = Math.min(surf, 0.62);
  else if (zone === 2) surf = Math.min(surf, 0.72);
  else if (zone === 3) grip = 2.4;
  const bm = k.boosting ? Math.max(k.boostPower, k.boostT > 0 ? PAD_POWER : 0) : k.boostT > 0 ? PAD_POWER : 1;
  if (bm > 1) surf = Math.max(surf, 1) * bm;
  const maxS = k.maxSpeed * surf;

  // drift
  if (k.driftDir === 0) {
    if (c.drift && grounded && !spinning && k.speed > 13 && Math.abs(steer) > 0.3) {
      k.driftDir = steer > 0 ? 1 : -1; k.driftTime = 0; k.driftLevel = 0;
      if (k.gh <= 0.01) { k.vy = 3.2; k.y = 0.01; }
      ev(w, 'driftstart', k);
    }
  } else {
    const d = k.driftDir;
    const rate = clamp(1 + 0.5 * steer * d, 0.5, 1.5);
    k.driftTime += dt * rate;
    addMeter(k, 0.14 * dt);
    if (k.isPlayer && grounded) w.stats.driftSec += dt;
    const lvl = k.driftTime > DRIFT_T[2] ? 3 : k.driftTime > DRIFT_T[1] ? 2 : k.driftTime > DRIFT_T[0] ? 1 : 0;
    if (lvl > k.driftLevel) { k.driftLevel = lvl; ev(w, 'driftlevel', k, lvl); }
    if (!c.drift || k.speed < 9 || spinning) {
      if (k.driftLevel > 0 && !spinning) {
        k.boostT = Math.max(k.boostT, MINI[k.driftLevel] * (k.padTime / 1.35));
        k.speed += 1.5 * k.driftLevel;
        addMeter(k, 0.05 * k.driftLevel);
        if (k.isPlayer) w.stats.miniTurbos++;
        ev(w, 'miniturbo', k, k.driftLevel);
      }
      k.driftDir = 0; k.driftTime = 0; k.driftLevel = 0;
    }
  }

  // speed
  if (throttle > 0) {
    const a = k.accel * (bm > 1 ? 3 : 1);
    k.speed += (maxS - k.speed) * Math.min(1, a * dt * throttle);
  } else if (brake > 0) {
    k.speed -= (k.speed > 0 ? 38 : 12) * dt * brake;
    if (k.speed < -9) k.speed = -9;
  } else {
    k.speed *= 1 - (spinning ? 2.5 : 0.35) * dt;
  }
  if (off && k.speed > maxS) k.speed += (maxS - k.speed) * Math.min(1, 3 * dt);
  if (k.driftDir !== 0) k.speed *= 1 - 0.06 * dt;

  // steering
  k.steerVis += (steer - k.steerVis) * Math.min(1, 10 * dt);
  const sp = k.speed;
  const speedF = (Math.min(1, Math.abs(sp) / 9) * (sp < 0 ? -1 : 1)) / (1 + Math.max(0, sp - 24) * 0.012);
  let dh;
  if (k.driftDir !== 0) {
    const d = k.driftDir;
    dh = -d * (0.9 + 0.55 * steer * d) * k.steerRate * speedF;
  } else {
    dh = -steer * k.steerRate * speedF;
  }
  if (spinning) k.spinAngle += dt * 13; else k.spinAngle *= 0.8;
  k.h += dh * dt;

  // velocity (lags the heading, more while drifting)
  const g = 1 - Math.exp(-(grounded ? (k.driftDir ? 3.4 : grip) : 0.5) * dt);
  k.vx += (Math.sin(k.h) * sp - k.vx) * g;
  k.vz += (Math.cos(k.h) * sp - k.vz) * g;
  k.x += k.vx * dt; k.z += k.vz * dt;

  locate(tr, k);

  // walls
  const over = resolveWalls(tr, k);
  if (over > 0) {
    const vn = k.vx * k.wnx + k.vz * k.wnz;
    if (vn > 0) {
      k.vx -= 1.35 * vn * k.wnx; k.vz -= 1.35 * vn * k.wnz;
      k.speed *= 0.88;
      k.h += angDiff(k.th, k.h) * 0.25;
      if (k.bumpCool <= 0) { ev(w, 'bump', k, Math.min(1, Math.abs(vn) / 20)); k.bumpCool = 0.25; if (k.isPlayer) w.shake = Math.max(w.shake, 0.4); }
    }
  }

  // vertical: ramps are real surfaces; leaving the top of one launches the kart
  const rp = rampAt(tr, k);
  const gh = rp ? rp.r.h * rp.f : 0;
  const gravity = (k.glide ? GLIDE_GRAV : GRAV) * tr.grav;
  if (k.y > gh + 0.02 || k.vy > 0) {
    if (k.onRamp && !rp && k.speed > 0 && k.y > 0.3 && k.vy <= 0) { // flew off the ramp edge
      k.vy = k.rampVy + k.onRamp.power; k.glide = k.onRamp.glide;
      if (k.isPlayer) w.stats.ramps++;
      ev(w, 'jump', k);
    }
    k.onRamp = null;
    k.y += k.vy * dt;
    k.vy -= gravity * dt;
    k.airT += dt;
    if (k.y <= gh) {
      k.y = gh;
      if (k.vy < -6 || k.airT > 0.5) ev(w, 'land', k);
      k.vy = 0; k.airT = 0; k.glide = false;
    }
  } else {
    k.y = gh; k.vy = 0; k.airT = 0;
    if (rp) { k.onRamp = rp.r; k.rampVy = (rp.r.h / (rp.r.len * rp.ds)) * Math.max(0, k.speed) * 0.92; } else k.onRamp = null;
  }
  k.gh = gh;

  // boost pads (the main road's pads only count on the main road, the shortcut's own pads only on the shortcut)
  if (k.y <= k.gh + 0.3) {
    const pads = k.br ? tr.branch.boosts : tr.boosts;
    for (const p of pads) {
      const near = k.br ? Math.abs(k.bj - p.j) <= 2 : Math.abs(wrapIdx(k.idx - p.idx, tr.N)) <= 3;
      if (near && k.padCool <= 0 && Math.abs(k.lat - p.lat) < p.w) {
        k.boostT = Math.max(k.boostT, k.padTime); k.speed = Math.max(k.speed, k.maxSpeed * 0.95); k.padCool = 0.8;
        addMeter(k, 0.12);
        if (k.isPlayer) w.stats.boostPads++;
        ev(w, 'boost', k);
      }
    }
  }

  // shortcut entered (counted once the kart is a few samples inside)
  if (tr.branch) {
    const br = tr.branch;
    if (!k.brIn && k.br && k.bj >= 6) { k.brIn = true; k.shortcuts++; if (k.isPlayer) w.stats.shortcuts++; ev(w, 'shortcut', k); }
    else if (k.brIn && !k.br && (k.idx >= br.b || k.idx < br.a)) k.brIn = false;
  }

  // coins (player only; they come back every lap)
  if (k.isPlayer && racing) {
    for (const co of w.coins) {
      if (co.takenLap === k.crossed) continue;
      const dx = k.x - co.x, dz = k.z - co.z;
      if (dx * dx + dz * dz < 6.5 && Math.abs(k.y + 0.7 - co.y - 0.8) < 2.4) {
        co.takenLap = k.crossed; w.stats.coins++; addMeter(k, 0.025);
        ev(w, 'coin', k, co);
      }
    }
  }

  // progress / stuck
  const da = Math.abs(angDiff(k.h, k.th));
  k.wrongT = da > 2.0 && k.speed > 3 ? k.wrongT + dt : 0;
  if (k.dist - k.lastDist >= 2) { k.lastDist = k.dist; k.lastGoodIdx = k.idx; k.stuckT = 0; }
  else if (racing && !k.finished && k.y <= k.gh + 0.01) k.stuckT += dt;
  if (!k.finished && (k.stuckT > 3.5 || k.wrongT > 2.8 || (c.reset && k.isPlayer && racing))) respawn(w, k);

  // ordered checkpoints, then the finish line. A lap only counts when every checkpoint was passed in order.
  if (racing && !k.finished) {
    const N = tr.N, cps = tr.cps;
    if (k.crossed >= 1) {
      while (k.nextCp < cps.length) {
        const rel = wrapIdx(k.idx - cps[k.nextCp].idx, N);
        if (rel >= 0 && rel < N / 4) { k.nextCp++; if (k.isPlayer) ev(w, 'checkpoint', k, k.nextCp); } else break;
      }
    }
    if (k.dist >= k.crossed * N && (k.crossed === 0 || k.nextCp >= cps.length)) {
      if (k.crossed >= 1) {
        const lt = w.time - k.lapStart;
        k.lapTimes.push(lt);
        if (lt < k.bestLap) k.bestLap = lt;
      }
      k.crossed++;
      k.lap = Math.min(w.laps, k.crossed);
      k.lapStart = w.time;
      k.nextCp = 0;
      if (k.crossed > w.laps) {
        k.finished = true; k.finishTime = w.time;
        ev(w, 'finish', k);
      } else {
        if (k.crossed >= 2) ev(w, 'lap', k, k.crossed);
        if (!k.isPlayer) pickRoute(w, k);
      }
    }
  }
}

function updateWorldObjects(w, dt) {
  const tr = w.track;
  for (const m of w.movers) {
    const lat = m.amp * Math.sin(w.time * m.speed + m.phase);
    m.lat = lat;
    if (m.j !== undefined) {
      const br = tr.branch;
      m.x = br.px[m.j] + br.nx[m.j] * lat;
      m.z = br.pz[m.j] + br.nz[m.j] * lat;
    } else {
      m.x = tr.px[m.idx] + tr.nx[m.idx] * lat;
      m.z = tr.pz[m.idx] + tr.nz[m.idx] * lat;
    }
    for (const k of w.karts) {
      const dx = k.x - m.x, dz = k.z - m.z;
      if (dx * dx + dz * dz < 4.6 && k.y < 1.2) hitKart(w, k);
    }
  }
  void dt;
}

function collideKarts(w) {
  const ks = w.karts;
  for (let i = 0; i < ks.length; i++) {
    for (let j = i + 1; j < ks.length; j++) {
      const a = ks[i], b = ks[j];
      if (Math.abs(a.y - b.y) > 1.5) continue;
      const dx = b.x - a.x, dz = b.z - a.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > 5.8 || d2 < 1e-6) continue;
      const d = Math.sqrt(d2);
      const nx = dx / d, nz = dz / d;
      const push = (2.4 - d) * 0.5;
      const wa = b.weight / (a.weight + b.weight), wb = 1 - wa;
      a.x -= nx * push * wa * 2; a.z -= nz * push * wa * 2;
      b.x += nx * push * wb * 2; b.z += nz * push * wb * 2;
      const rel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
      if (rel < 0) {
        const imp = -rel * 0.6;
        a.vx -= nx * imp * wa * 2; a.vz -= nz * imp * wa * 2;
        b.vx += nx * imp * wb * 2; b.vz += nz * imp * wb * 2;
        if ((a.isPlayer || b.isPlayer) && a.bumpCool <= 0 && b.bumpCool <= 0) { ev(w, 'bump', a.isPlayer ? a : b, 0.3); a.bumpCool = b.bumpCool = 0.3; }
      }
    }
  }
}

// `input` is the player's controls: { steer, throttle, brake, drift, boost, reset }. `autoplayer` (tests / demo) lets the AI drive the player.
export function step(w, input, dt = STEP, autoplayer = false) {
  syncPrev(w);

  if (w.state === 'countdown') {
    w.cd -= dt;
    if (w.cd <= 0) { w.state = 'racing'; w.time = 0; ev(w, 'go'); }
    else {
      const s = Math.ceil(w.cd);
      if (s !== w.cdShown && s <= 3) { w.cdShown = s; ev(w, 'count', s); }
    }
  } else w.time += dt;

  const c = w.ctl;
  for (const k of w.karts) {
    if (k.isPlayer && !k.finished && !autoplayer) {
      c.throttle = input.throttle; c.brake = input.brake; c.steer = input.steer; c.drift = input.drift; c.boost = input.boost; c.reset = input.reset;
    } else {
      aiControl(w, k, c);
      c.reset = false;
    }
    updateKart(w, k, c, dt);
    if (k.isPlayer) w.stats.maxSpeed = Math.max(w.stats.maxSpeed, Math.hypot(k.vx, k.vz));
  }
  collideKarts(w);
  updateWorldObjects(w, dt);
  rankOrder(w);

  if (w.shake > 0) w.shake = Math.max(0, w.shake - dt * 2.2);

  // end of race: when everyone is done, or 8 s after the player finished
  if (w.state === 'racing' && w.player && w.player.finished) {
    w.endT += dt;
    if (w.karts.every((k) => k.finished) || w.endT > 8) finishWorld(w);
  }
}

function finishWorld(w) {
  w.state = 'done';
  rankOrder(w);
  w.results = w.order.map((k, i) => ({
    id: k.id, name: k.name, look: k.look, isPlayer: k.isPlayer, pos: i + 1,
    time: k.finished ? k.finishTime : null, bestLap: k.bestLap === Infinity ? null : k.bestLap, shortcuts: k.shortcuts,
  }));
}
