// AI drivers: follow the track spline with a personal lane offset, brake for curvature, rubber-band to the player.
// A kart that has decided to use the shortcut (k.wantBr) follows a "virtual path": main road -> shortcut -> main road.
import { angDiff } from './trackBuild.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const INNER_LANE = 6.8; // metres from the main centre line while lining up for the shortcut mouth

// Steering nudge away from an obstacle at (x, z) that lies just ahead of kart k (module-level: no per-frame closure).
function avoid(k, fx, fz, x, z, r) {
  const dx = x - k.x, dz = z - k.z;
  const f = dx * fx + dz * fz;
  if (f < 1 || f > 18) return 0;
  const l = dx * -fz + dz * fx; // + = to the right of the kart
  if (Math.abs(l) >= r) return 0;
  return l > 0 ? -0.7 : 0.7;
}

// The shortcut's swaying boulders cover a strip down the middle of the road. When the aim point is about to pass one, move
// the racing line to a lane that clears the whole sway (instead of nudging the steering at the last moment, which the
// pull back to the line cancels out). The side is chosen once per boulder, from where the kart is when it first sees it.
function boulderLane(w, k, j, br) {
  for (const m of w.movers) {
    if (m.j === undefined || j < m.j - 12 || j > m.j + 4) continue;
    if (k.dodgeFor !== m) { k.dodgeFor = m; k.dodgeSide = k.lat >= 0 ? 1 : -1; }
    return k.dodgeSide * Math.min(m.amp + 3.1, br.half - 0.9);
  }
  return null;
}

// Which part of the virtual path is the kart on?  0 = main road, 1 = lining up for the mouth, 2 = on the shortcut
function routeState(tr, k) {
  const br = tr.branch;
  if (!br || !k.wantBr) return 0;
  if (k.br) return 2;
  if (k.idx >= br.a - 40 && k.idx <= br.a + 8) return 1;
  return 0;
}

// Sets aim.x / aim.z to the point the kart should steer for.
const aim = { x: 0, z: 0 };
function aimPoint(w, tr, k, look, state) {
  const N = tr.N, br = tr.branch;
  if (state === 2) {
    let laneB = k.lane * (br.half / tr.halfRoad) * 0.6; // the shortcut is narrower: shrink the lane offset
    const j = k.bj + look;
    if (j <= br.M - 1) {
      const bl = boulderLane(w, k, j, br);
      if (bl !== null) laneB = bl;
      aim.x = br.px[j] + br.nx[j] * laneB; aim.z = br.pz[j] + br.nz[j] * laneB;
    }
    else { // past the end: head for the main road just after the merge
      const mi = (br.b + (j - (br.M - 1))) % N;
      aim.x = tr.px[mi] + tr.nx[mi] * k.lane * 0.5; aim.z = tr.pz[mi] + tr.nz[mi] * k.lane * 0.5;
    }
  } else if (state === 1) {
    const toMouth = br.a - k.idx;
    if (toMouth > 6) { // hug the inside of the main road, never aiming past the mouth
      const mi = (k.idx + Math.max(3, Math.min(look, toMouth - 2))) % N;
      const lane = br.side * INNER_LANE;
      aim.x = tr.px[mi] + tr.nx[mi] * lane; aim.z = tr.pz[mi] + tr.nz[mi] * lane;
    } else { // at the mouth: aim a few samples into the shortcut
      const j = clamp(Math.max(0, k.idx - br.a) + 6, 4, br.M - 1);
      aim.x = br.px[j]; aim.z = br.pz[j];
    }
  } else {
    const ti = (k.idx + look) % N;
    aim.x = tr.px[ti] + tr.nx[ti] * k.lane; aim.z = tr.pz[ti] + tr.nz[ti] * k.lane;
  }
}

export function aiControl(w, k, out) {
  const tr = w.track, N = tr.N;
  const look = 5 + Math.floor(Math.max(0, k.speed) * 0.3);
  const state = routeState(tr, k);
  aimPoint(w, tr, k, look, state);
  const want = Math.atan2(aim.x - k.x, aim.z - k.z);
  const da = angDiff(want, k.h);
  let steer = clamp(-da * 2.2, -1, 1);

  // avoid hazards just ahead
  const fx = Math.sin(k.h), fz = Math.cos(k.h);
  for (const m of w.movers) steer += avoid(k, fx, fz, m.x, m.z, 3.2);
  steer = clamp(steer, -1, 1);

  // target speed from upcoming curvature (of the shortcut while on it)
  let cmax = 0;
  if (state === 2) {
    const br = tr.branch;
    for (let o = 0; o <= 28; o += 4) cmax = Math.max(cmax, br.curv[Math.min(br.M - 1, k.bj + o)]);
  } else {
    for (let o = 0; o <= 28; o += 4) cmax = Math.max(cmax, tr.curv[(k.idx + o) % N]);
  }
  const diff = w.difficulty;
  let rb = 1;
  if (w.player && !k.isPlayer) {
    const gap = (w.player.dist - k.dist) * tr.ds; // + = player is ahead of this AI
    rb = 1 + clamp(gap / 220, -1, 1) * 0.07;
  }
  const cap = k.maxSpeed * diff * k.skill * rb;
  const target = Math.min(cap, Math.sqrt(16 / Math.max(cmax, 1e-4)));
  out.steer = steer;
  out.throttle = k.speed < target ? 1 : 0.15;
  out.brake = k.speed > target * 1.15 ? 1 : 0;
  out.drift = false;
  out.boost = k.meter > 0.55 && cmax < 0.004 && k.speed > 22 && !k.finished;
  if (k.finished) { out.throttle = 0.5; out.brake = 0; }
}

