// Pure-JS track building and "where is the kart" queries (no three.js, no DOM), so the simulation also runs in Node tests.
//
// A track is DATA (see tracks.js): control points of a closed smooth curve. buildTrack() turns it into evenly spaced
// samples (2 m apart) with tangents, normals, heading and curvature, plus pads, ramps, coins, checkpoints and zones.
// Conventions: forward = (sin h, cos h); increasing h turns LEFT; lat +1 = right of the centre line.
export const HALF_ROAD = 9;
export const WALL_EXTRA = 5; // wall distance from the road edge

// Surface ids shared by the zone array and shortcut roads: 0 tarmac, 1 sand, 2 water/mud, 3 ice, 4 dirt.
export const SURFACE_ID = { road: 0, sand: 1, water: 2, ice: 3, dirt: 4 };
// Top-speed multiplier of a shortcut by surface (a shortcut can override it with `speed`).
export const SURFACE_SPEED = { road: 1, dirt: 0.9, sand: 0.66, water: 0.76, ice: 1 };

import { resolveAuto } from './autoplace.js';
export const wrapIdx = (d, N) => (d > N / 2 ? d - N : d < -N / 2 ? d + N : d);

export function angDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

const unit = (x, z) => { const l = Math.hypot(x, z) || 1; return [x / l, z / l]; };

/* ---------- closed centripetal Catmull-Rom curve ---------- */
function crSegment(p0, p1, p2, p3, steps, out) {
  const d = (a, b) => Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1]), 0.5) || 1e-4;
  const t0 = 0, t1 = t0 + d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3);
  for (let s = 0; s < steps; s++) {
    const t = t1 + ((t2 - t1) * s) / steps;
    const lerp2 = (a, b, ta, tb) => [a[0] * ((tb - t) / (tb - ta)) + b[0] * ((t - ta) / (tb - ta)), a[1] * ((tb - t) / (tb - ta)) + b[1] * ((t - ta) / (tb - ta))];
    const A1 = lerp2(p0, p1, t0, t1), A2 = lerp2(p1, p2, t1, t2), A3 = lerp2(p2, p3, t2, t3);
    const B1 = lerp2(A1, A2, t0, t2), B2 = lerp2(A2, A3, t1, t3);
    out.push(lerp2(B1, B2, t1, t2));
  }
}

export function sampleSpline(pts, scale = 1, spacing = 2) {
  const P = pts.map(([x, z]) => [x * scale, z * scale]);
  const n = P.length, dense = [];
  for (let i = 0; i < n; i++) crSegment(P[(i + n - 1) % n], P[i], P[(i + 1) % n], P[(i + 2) % n], 60, dense);
  const M = dense.length;
  const cum = new Float64Array(M + 1);
  for (let i = 1; i <= M; i++) { const a = dense[i - 1], b = dense[i % M]; cum[i] = cum[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]); }
  const L = cum[M], N = Math.round(L / spacing);
  const px = new Float32Array(N), pz = new Float32Array(N);
  let j = 0;
  for (let i = 0; i < N; i++) {
    const s = (i / N) * L;
    while (cum[j + 1] < s) j++;
    const a = dense[j], b = dense[(j + 1) % M];
    const f = (s - cum[j]) / (cum[j + 1] - cum[j] || 1);
    px[i] = a[0] + (b[0] - a[0]) * f; pz[i] = a[1] + (b[1] - a[1]) * f;
  }
  return { N, L, px, pz };
}

/* ------------------------------------------------------------------------------------------------
   Shortcut road ("branch"). It leaves the main road on the inside of a bend at main sample `a`, cuts
   across the infield and rejoins at sample `b` (a < b, never crossing the start line). It is a real
   second road with its own centre line, walls and surface. Progress along it is mapped linearly onto
   the main sample range [a, b], so a kart that takes it advances faster per metre - that is what makes
   it a shortcut - while lap counting and ranking keep working on the single main progress index.
   ------------------------------------------------------------------------------------------------ */
export function makeBranch(tr, sc) {
  const { N, px, pz, tx, tz, nx, nz, th } = tr;
  const a = Math.round(sc.from * N), b = Math.round(sc.to * N);
  const half = sc.half ?? 5.5;
  const wall = sc.wall ?? half + 2.5;
  const alpha = ((sc.angle ?? 20) * Math.PI) / 180;
  const handle = sc.handle ?? 0.4;
  const side = sc.side ?? (angDiff(th[b], th[a]) > 0 ? -1 : 1); // inside of the bend: left turns bend towards -lat

  const ca = Math.cos(alpha), sa = Math.sin(alpha);
  const latC = tr.halfRoad + half * ca;
  const A = [px[a] + nx[a] * side * latC, pz[a] + nz[a] * side * latC];
  const B = [px[b] + nx[b] * side * latC, pz[b] + nz[b] * side * latC];
  const dA = unit(tx[a] * ca + nx[a] * side * sa, tz[a] * ca + nz[a] * side * sa);
  const dB = unit(tx[b] * ca - nx[b] * side * sa, tz[b] * ca - nz[b] * side * sa);
  const chord = Math.hypot(B[0] - A[0], B[1] - A[1]);
  const P1 = [A[0] + dA[0] * chord * handle, A[1] + dA[1] * chord * handle];
  const P2 = [B[0] - dB[0] * chord * handle, B[1] - dB[1] * chord * handle];

  const D = 400;
  const dx = new Float64Array(D + 1), dz = new Float64Array(D + 1), cum = new Float64Array(D + 1);
  for (let i = 0; i <= D; i++) {
    const t = i / D, u = 1 - t;
    dx[i] = u * u * u * A[0] + 3 * u * u * t * P1[0] + 3 * u * t * t * P2[0] + t * t * t * B[0];
    dz[i] = u * u * u * A[1] + 3 * u * u * t * P1[1] + 3 * u * t * t * P2[1] + t * t * t * B[1];
    if (i) cum[i] = cum[i - 1] + Math.hypot(dx[i] - dx[i - 1], dz[i] - dz[i - 1]);
  }
  const len = cum[D];
  const M = Math.max(8, Math.round(len / 2) + 1);
  const bx = new Float32Array(M), bz = new Float32Array(M);
  let q = 0;
  for (let j = 0; j < M; j++) {
    const s = (j / (M - 1)) * len;
    while (q < D - 1 && cum[q + 1] < s) q++;
    const f = (s - cum[q]) / (cum[q + 1] - cum[q] || 1);
    bx[j] = dx[q] + (dx[q + 1] - dx[q]) * f;
    bz[j] = dz[q] + (dz[q + 1] - dz[q]) * f;
  }
  const bds = len / (M - 1);
  const btx = new Float32Array(M), btz = new Float32Array(M), bnx = new Float32Array(M), bnz = new Float32Array(M);
  const bth = new Float32Array(M), curv = new Float32Array(M);
  for (let j = 0; j < M; j++) {
    const p = Math.max(0, j - 1), n = Math.min(M - 1, j + 1);
    const [ux, uz] = unit(bx[n] - bx[p], bz[n] - bz[p]);
    btx[j] = ux; btz[j] = uz; bnx[j] = -uz; bnz[j] = ux; bth[j] = Math.atan2(ux, uz);
  }
  const raw = new Float32Array(M);
  for (let j = 1; j < M - 1; j++) raw[j] = Math.abs(angDiff(bth[j + 1], bth[j - 1])) / (2 * bds);
  raw[0] = raw[1]; raw[M - 1] = raw[M - 2];
  for (let j = 0; j < M; j++) {
    let m = 0, c = 0;
    for (let o = -2; o <= 2; o++) { const jj = j + o; if (jj >= 0 && jj < M) { m += raw[jj]; c++; } }
    curv[j] = m / c;
  }

  const surface = sc.surface ?? 'dirt';
  const at = (u) => Math.max(1, Math.min(M - 2, Math.round(u * (M - 1))));
  const pads = sc.pads || [];
  return {
    a, b, M, len, ds: bds, side, half, wall, surface, zone: SURFACE_ID[surface] ?? 4, speed: sc.speed ?? SURFACE_SPEED[surface] ?? 0.9,
    name: sc.name || 'Shortcut', note: sc.note || '',
    px: bx, pz: bz, tx: btx, tz: btz, nx: bnx, nz: bnz, th: bth, curv,
    boosts: pads.filter((p) => p.type === 'boost').map((p) => ({ j: at(p.u), lat: 0, w: 4.2 })),
    ramps: pads.filter((p) => p.type === 'ramp').map((p) => ({ j: at(p.u), len: p.len ?? 6, h: p.h ?? 2.2, power: p.power ?? 0, glide: !!p.glide, lat: 0, w: Math.min(4.2, half - 1) })),
    at,
  };
}

const autoCache = new Map();
export function buildTrack(srcDef) {
  let def = srcDef;
  const half = def.half ?? HALF_ROAD;
  const wallHalf = half + WALL_EXTRA;
  const { N, L, px, pz } = sampleSpline(def.pts, def.scale ?? 1);
  const tx = new Float32Array(N), tz = new Float32Array(N), nx = new Float32Array(N), nz = new Float32Array(N);
  const th = new Float32Array(N), curv = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const a = (i + N - 1) % N, b = (i + 1) % N;
    let dx = px[b] - px[a], dz = pz[b] - pz[a];
    const l = Math.hypot(dx, dz) || 1;
    dx /= l; dz /= l;
    tx[i] = dx; tz[i] = dz; nx[i] = -dz; nz[i] = dx; th[i] = Math.atan2(dx, dz);
  }
  const ds = L / N;
  const raw = new Float32Array(N);
  for (let i = 0; i < N; i++) raw[i] = Math.abs(angDiff(th[(i + 1) % N], th[(i + N - 1) % N])) / (2 * ds);
  for (let i = 0; i < N; i++) {
    let m = 0;
    for (let o = -3; o <= 3; o++) m += raw[(i + o + N) % N];
    curv[i] = m / 7;
  }

  if (srcDef.auto) {
    // object placement is worked out once per track from the road's curvature (see autoplace.js)
    if (!autoCache.has(srcDef.id)) autoCache.set(srcDef.id, resolveAuto(srcDef, { N, ds, px, pz, tx, tz, nx, nz, th, curv, halfRoad: half, wallHalf }));
    const r = autoCache.get(srcDef.id);
    def = { ...srcDef, hazards: r.hazards, coins: r.coins, shortcut: r.shortcut ? JSON.parse(JSON.stringify(r.shortcut)) : undefined };
  }
  const at = (t) => ((Math.round(t * N) % N) + N) % N;
  const hz = def.hazards || {};
  const boosts = (hz.boost || []).map((t) => (typeof t === 'number' ? { idx: at(t), lat: 0, w: 4.4 } : { idx: at(t.t), lat: t.lat || 0, w: t.w || 4.4 }));
  const ramps = (hz.ramps || []).map((r) => ({ idx: at(r.t), len: r.len ?? 7, h: r.h ?? 2.4, power: r.power ?? 0, glide: !!r.glide, lat: r.lat || 0, w: r.w ?? Math.min(5.2, half - 1) }));
  const zone = new Uint8Array(N);
  for (const z of hz.zones || []) {
    const a = at(z.t0), b = at(z.t1);
    for (let i = a; i !== b; i = (i + 1) % N) zone[i] = z.type;
  }
  const movers = (hz.movers || []).map((m) => ({ ...m, idx: at(m.t), x: 0, z: 0, lat: 0 }));

  const tr = { def, id: def.id, N, L, ds, px, pz, tx, tz, nx, nz, th, curv, halfRoad: half, wallHalf, boosts, ramps, zone, movers, coins: [], cps: [], branch: null, grav: def.grav ?? 1 };

  if (def.shortcut) {
    const br = makeBranch(tr, def.shortcut);
    tr.branch = br;
    for (const m of def.shortcut.movers || []) movers.push({ ...m, j: br.at(m.u), idx: Math.round(br.a + (br.at(m.u) / (br.M - 1)) * (br.b - br.a)), x: 0, z: 0, lat: 0 });
  }

  // coins: lines along the road (and the shortcut), 7 m apart. `y` > 0 floats them in the air (above ramps).
  const addCoin = (x, z, y, idx, branch) => tr.coins.push({ x, z, y, idx, branch: !!branch, takenLap: -1, id: tr.coins.length });
  for (const c of def.coins || []) {
    const i0 = Math.round(c.t0 * N), i1 = Math.round(c.t1 * N), step = Math.max(2, Math.round((c.step ?? 7) / ds));
    for (let i = i0; i <= i1; i += step) {
      const ii = ((i % N) + N) % N, lat = (c.lat || 0) + (c.wave ? Math.sin(((i - i0) / step) * 0.9) * c.wave : 0);
      addCoin(px[ii] + nx[ii] * lat, pz[ii] + nz[ii] * lat, c.y || 0, ii, false);
    }
  }
  if (tr.branch) {
    const br = tr.branch;
    for (const c of def.shortcut.coins || []) {
      const j0 = br.at(c.u0), j1 = br.at(c.u1), step = Math.max(2, Math.round((c.step ?? 7) / br.ds));
      for (let j = j0; j <= j1; j += step) addCoin(br.px[j] + br.nx[j] * (c.lat || 0), br.pz[j] + br.nz[j] * (c.lat || 0), c.y || 0, Math.round(br.a + (j / (br.M - 1)) * (br.b - br.a)), true);
    }
  }

  // checkpoints (lap fractions are spread evenly, then nudged out of the shortcut so every kart passes every checkpoint)
  const K = def.cps ?? 6;
  let idxs = [];
  for (let i = 1; i <= K; i++) idxs.push(Math.round((i * N) / (K + 1)));
  if (tr.branch) {
    const { a, b } = tr.branch;
    idxs = idxs.map((v) => (v > a - 6 && v < b + 6 ? (v - a < b - v ? a - 8 : b + 8) : v));
  }
  idxs = [...new Set(idxs)].sort((p, q) => p - q);
  tr.cps = idxs.map((idx) => ({ idx }));
  return tr;
}

// Cached copy for read-only uses (menus, previews). Races build their own because movers and coins are mutated while racing.
const previewCache = new Map();
export function previewTrack(def) {
  if (!previewCache.has(def.id)) previewCache.set(def.id, buildTrack(def));
  return previewCache.get(def.id);
}

/* Work out where kart `k` is on the track. Sets on k:
     idx / dist  progress on the main sample scale (a kart on the shortcut is mapped onto [a, b])
     br / bj     on the shortcut road? / nearest shortcut sample
     lat, th     lateral offset from, and heading of, the road the kart is on
     half, wall, zone   road half width, wall half width and surface of that road
     onRoad      false = off-road (grass shoulder): the sim slows the kart down
     mi, bvalid  nearest main sample, and whether the kart is within the shortcut's length (used by resolveWalls) */
export function locate(tr, k) {
  const N = tr.N, br = tr.branch;
  const wasOnBranch = !!(br && k.br);

  let best = 1e18, bi = k.idx;
  const W = wasOnBranch ? 40 : 14;
  for (let o = -W; o <= W; o++) {
    const i = (k.idx + o + N) % N;
    const dx = k.x - tr.px[i], dz = k.z - tr.pz[i];
    const d = dx * dx + dz * dz;
    if (d < best) { best = d; bi = i; }
  }
  if (best > 1600 && !wasOnBranch) {
    for (let i = 0; i < N; i++) {
      const dx = k.x - tr.px[i], dz = k.z - tr.pz[i];
      const d = dx * dx + dz * dz;
      if (d < best) { best = d; bi = i; }
    }
  }
  const mlat = (k.x - tr.px[bi]) * tr.nx[bi] + (k.z - tr.pz[bi]) * tr.nz[bi];

  let bj = k.bj | 0, blat = 0, bvalid = false;
  if (br && (wasOnBranch || (bi >= br.a - 24 && bi <= br.b + 24))) {
    const M = br.M;
    let bb = 1e18, bjj = 0;
    if (wasOnBranch) {
      for (let o = -10; o <= 10; o++) {
        const j = bj + o;
        if (j < 0 || j >= M) continue;
        const dx = k.x - br.px[j], dz = k.z - br.pz[j];
        const d = dx * dx + dz * dz;
        if (d < bb) { bb = d; bjj = j; }
      }
    }
    if (!wasOnBranch || bb > 900) {
      bb = 1e18;
      for (let j = 0; j < M; j++) {
        const dx = k.x - br.px[j], dz = k.z - br.pz[j];
        const d = dx * dx + dz * dz;
        if (d < bb) { bb = d; bjj = j; }
      }
    }
    const lon = (k.x - br.px[bjj]) * br.tx[bjj] + (k.z - br.pz[bjj]) * br.tz[bjj];
    blat = (k.x - br.px[bjj]) * br.nx[bjj] + (k.z - br.pz[bjj]) * br.nz[bjj];
    bvalid = (bjj > 0 && bjj < M - 1) || (bjj === 0 && lon >= -1) || (bjj === M - 1 && lon <= 1);
    bj = bjj;
  }

  let onBr = false;
  if (bvalid) {
    const inMain = best <= 2500 && Math.abs(mlat) <= tr.halfRoad;
    const inBr = Math.abs(blat) <= br.half;
    if (inMain) onBr = false;
    else if (inBr) onBr = true;
    else onBr = wasOnBranch ? Math.abs(blat) < Math.abs(mlat) + 2 : Math.abs(blat) < Math.abs(mlat) - 2;
  }

  const inBrRoad = bvalid && Math.abs(blat) <= br.half;
  const inNeck = bvalid && best <= 900 && Math.abs(mlat) <= tr.halfRoad + 4 && Math.abs(blat) <= br.half + 4;
  k.onRoad = (best <= 2500 && Math.abs(mlat) <= tr.halfRoad) || inBrRoad || inNeck;

  let newIdx;
  if (onBr) {
    newIdx = Math.round(br.a + (bj / (br.M - 1)) * (br.b - br.a));
    k.lat = blat; k.th = br.th[bj]; k.half = br.half; k.wall = br.wall; k.zone = br.zone;
  } else {
    newIdx = bi;
    k.lat = mlat; k.th = tr.th[bi]; k.half = tr.halfRoad; k.wall = tr.wallHalf; k.zone = tr.zone[bi];
  }
  k.dist += wrapIdx(newIdx - k.idx, N);
  k.idx = newIdx;
  k.br = onBr;
  k.bj = bj;
  k.mi = bi;
  k.bvalid = bvalid;
}

/* Keep `k` inside the drivable area (main road plus shortcut road). Call right after locate(). Pushes the kart back to the
   nearest wall line and returns the penetration depth (0 = nothing hit); the outward wall normal is left in k.wnx / k.wnz. */
export function resolveWalls(tr, k) {
  const dxm = k.x - tr.px[k.mi], dzm = k.z - tr.pz[k.mi];
  const dm = Math.hypot(dxm, dzm);
  let over = dm - tr.wallHalf;
  let ux = dxm / (dm || 1), uz = dzm / (dm || 1);
  if (tr.branch && k.bvalid) {
    const br = tr.branch;
    const dxb = k.x - br.px[k.bj], dzb = k.z - br.pz[k.bj];
    const db = Math.hypot(dxb, dzb);
    const overB = db - br.wall;
    if (overB <= 0) return 0;
    if (overB < over) { over = overB; ux = dxb / (db || 1); uz = dzb / (db || 1); }
  }
  if (over <= 0) return 0;
  k.x -= ux * over; k.z -= uz * over;
  k.wnx = ux; k.wnz = uz;
  return over;
}

// Ramp surface under the kart (null when not on a ramp). Returns { r, f } with f = 0..1 how far up the ramp the kart is.
export function rampAt(tr, k) {
  if (k.br) {
    for (const r of tr.branch.ramps) {
      const off = k.bj - r.j;
      if (off >= 0 && off <= r.len && Math.abs(k.lat - r.lat) <= r.w) return { r, f: off / r.len, ds: tr.branch.ds };
    }
    return null;
  }
  for (const r of tr.ramps) {
    const off = wrapIdx(k.idx - r.idx, tr.N);
    if (off >= 0 && off <= r.len && Math.abs(k.lat - r.lat) <= r.w) return { r, f: off / r.len, ds: tr.ds };
  }
  return null;
}
