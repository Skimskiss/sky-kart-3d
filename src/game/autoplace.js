// Automatic, deterministic placement of the gameplay objects of a track (shortcut, pads, ramps, zones, movers, coins).
// A track definition only says WHAT it wants (counts, kinds, a hint where the shortcut should be); this module finds WHERE,
// using the curvature of the road: pads and ramps go on straights, the shortcut cuts across a real bend, and so on.
// The result is plain data in the same format a hand-written definition uses. scripts/check-tracks.mjs validates it.
import { makeBranch, angDiff, wrapIdx } from './trackBuild.js';

function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// `tr` is a partly built track: { N, ds, px, pz, tx, tz, nx, nz, th, curv, halfRoad, wallHalf }
export function resolveAuto(def, tr) {
  const A = def.auto || {};
  const rnd = mulberry((A.seed || 1) * 7919 + 13);
  const { N, ds, px, pz, curv } = tr;
  const out = { hazards: { boost: [], ramps: [], zones: [], movers: [] }, coins: [], shortcut: def.shortcut ? { ...def.shortcut } : null };

  // ----- shortcut: a bend to cut across -----
  let scA = -1, scB = -1;
  if (out.shortcut && out.shortcut.from === undefined) {
    const sc = out.shortcut, hint = A.scT ?? 0.5;
    const minSave = sc.minSave ?? 0.12;
    let best = null;
    for (let a = 14; a < N - 14; a += 4) {
      for (let span = 50; span <= 190; span += 6) {
        const b = a + span;
        if (b > N - 14) break;
        const turn = angDiff(tr.th[b % N], tr.th[a]);
        if (Math.abs(turn) < (sc.minTurn ?? 1.7)) continue; // radians
        if (curv[a] > 0.013 || curv[b % N] > 0.013) continue;
        let tot = 0; for (let i = a; i < b; i += 3) tot += Math.abs(angDiff(tr.th[(i + 3) % N], tr.th[i]));
        if (tot > Math.abs(turn) * 1.3 + 0.3) continue; // roughly one-directional bend
        const cand = makeBranch(tr, { ...sc, from: a / N, to: b / N });
        const saving = 1 - cand.len / ((b - a) * ds);
        if (saving < minSave) continue;
        // keep away from every other part of the road
        let sep = 1e9;
        for (let j = 16; j < cand.M - 16; j += 2) for (let i = 0; i < N; i += 2) { const d = Math.hypot(cand.px[j] - px[i], cand.pz[j] - pz[i]); if (d < sep) sep = d; }
        if (sep < cand.half + tr.halfRoad + 3.5) continue;
        const score = -Math.abs(((a + b) / 2) / N - hint) * 3 + Math.min(saving, 0.45);
        if (!best || score > best.score) best = { a, b, score, saving };
      }
    }
    if (best) { sc.from = best.a / N; sc.to = best.b / N; scA = best.a; scB = best.b; }
    else out.shortcut = null;
  } else if (out.shortcut) { scA = Math.round(out.shortcut.from * N); scB = Math.round(out.shortcut.to * N); }
  const inSc = (i, m = 6) => scA >= 0 && i > scA - m && i < scB + m;

  // ----- straights ----- (if a track has few straight pieces the curvature limit is relaxed step by step)
  let runs = [], usable = [];
  const isStraight = new Uint8Array(N);
  const wantObjs = (A.ramps ?? 0) + Math.ceil((A.boosts ?? 3) / 2);
  for (const mult of [1, 1.4, 1.9, 2.6]) {
    for (let i = 0; i < N; i++) isStraight[i] = curv[i] < (A.straightCurv ?? 0.0065) * mult ? 1 : 0;
    runs = [];
    let i0 = 0;
    while (i0 < N && isStraight[i0]) i0++; // start at a non-straight sample so runs do not wrap
    if (i0 === N) i0 = 0;
    for (let k = 0; k < N;) {
      const i = (i0 + k) % N;
      if (!isStraight[i]) { k++; continue; }
      let len = 0;
      while (k + len < N && isStraight[(i0 + k + len) % N]) len++;
      // long runs are cut into pieces so pads / ramps can be spread over them (and avoid the shortcut)
      for (let o = 0; o < len; o += 60) runs.push({ start: (i + o) % N, len: Math.min(60, len - o) });
      k += len;
    }
    usable = runs.filter((r) => { const mid = (r.start + r.len / 2) % N; return r.len >= (mult > 1 ? 18 : 24) && !inSc(Math.round(mid), 30) && mid > 18 && mid < N - 18; }).sort((x, y) => y.len - x.len);
    if (usable.length >= wantObjs && usable.reduce((s, r) => s + r.len, 0) >= wantObjs * 30) break;
  }

  const taken = []; // [startIdx, endIdx] blocks used by pads / ramps
  const free = (a, b) => !taken.some(([s, e]) => a < e + 8 && b > s - 8);
  const at = (i) => ((i % N) + N) % N / N;

  // ramps on the longest straights
  const nR = A.ramps ?? 0;
  for (const r of usable) {
    if (out.hazards.ramps.length >= nR) break;
    const len = A.rampLen ?? 7;
    if (r.len < len + 34) continue;
    const idx = (r.start + 14) % N;
    if (!free(idx, idx + len + 18) || inSc(idx, 4) || inSc(idx + len + 20, 4) || inSc(idx + 8, 4)) continue;
    taken.push([idx, idx + len + 18]);
    out.hazards.ramps.push({ t: at(idx), len, h: A.rampH ?? 2.4, power: A.rampPower ?? 0, glide: !!A.glide });
    const ia = idx + len + 3;
    out.coins.push({ t0: at(ia), t1: at(ia + 9), lat: 0, y: A.rampH ? 2.4 + (A.rampH - 2) : 2.6, step: 7 });
  }
  // boost pads: middle of the straights, shared out evenly
  const nB = A.boosts ?? 3;
  let guard = 0;
  const byPos = [...usable].sort((x, y) => x.start - y.start);
  while (out.hazards.boost.length < nB && guard++ < 40) {
    const r = byPos[(guard - 1) % byPos.length];
    if (!r) break;
    const off = 0.3 + 0.4 * ((Math.floor((guard - 1) / byPos.length) % 2) ? 0.7 : 0.35);
    const idx = Math.round(r.start + r.len * off) % N;
    if (!free(idx - 3, idx + 3) || inSc(idx, 8)) continue;
    taken.push([idx - 3, idx + 3]);
    out.hazards.boost.push(at(idx));
  }
  // zones (sand, mud, ice): gentle stretches spread over the lap, away from pads / ramps / the shortcut
  for (const z of A.zones || []) {
    for (let n = 0; n < (z.count ?? 1); n++) {
      const len = Math.round(((z.lenT ?? 0.035) * N));
      for (let tries = 0; tries < 60; tries++) {
        const a = Math.floor((((n + 0.2 + rnd() * 0.6) / (z.count ?? 1)) * (z.span ?? 1) + (z.from ?? 0)) * N) % N;
        if (a < 24 || a + len > N - 24 || inSc(a, 8) || inSc(a + len, 8) || !free(a, a + len)) continue;
        taken.push([a, a + len]);
        out.hazards.zones.push({ t0: at(a), t1: at(a + len), type: z.type });
        break;
      }
    }
  }
  // movers: on straights (not on pads / ramps)
  for (const m of A.movers || []) {
    for (let n = 0; n < (m.count ?? 1); n++) {
      for (let tries = 0; tries < 60; tries++) {
        const a = Math.floor(rnd() * N);
        if (a < 40 || a > N - 40 || inSc(a, 10) || !free(a - 6, a + 6)) continue;
        if (!isStraight[a] && !m.anywhere) continue;
        taken.push([a - 6, a + 6]);
        out.hazards.movers.push({ t: at(a), amp: m.amp ?? 5.5, speed: m.speed ?? 1.8, phase: rnd() * 6, kind: m.kind || 'rock' });
        break;
      }
    }
  }
  // coin lines: spread over the whole lap
  const lines = A.coinLines ?? 8;
  for (let n = 0; n < lines; n++) {
    for (let tries = 0; tries < 40; tries++) {
      const a = Math.floor(((n + 0.1 + rnd() * 0.5) / lines) * N);
      const cnt = 8 + Math.floor(rnd() * 5);
      const b = a + Math.round((cnt * 7) / ds);
      if (a < 14 || b > N - 14 || inSc(a, 4) || inSc(b, 4)) continue;
      if (taken.some(([s, e]) => a < e && b > s && !(out.hazards.zones.some((z) => at(a) >= z.t0 && at(a) <= z.t1)))) { if (taken.some(([s, e]) => a < e && b > s)) continue; }
      out.coins.push({ t0: at(a), t1: at(b), lat: [-3.5, 0, 3.5][n % 3], wave: n % 2 ? 3 : 0, step: 7 });
      break;
    }
  }
  // shortcut extras: coin trail, optional pad, movers
  if (out.shortcut) {
    const sc = out.shortcut;
    sc.coins = sc.coins || [{ u0: 0.18, u1: 0.82, lat: 0, step: 7 }];
    sc.pads = sc.pads || (sc.pad ? [{ u: 0.5, type: sc.pad === 'ramp' ? 'ramp' : 'boost' }] : []);
    sc.movers = (sc.moverKinds || []).map((m, i, arr) => ({ u: (i + 1) / (arr.length + 1), amp: 0.8, speed: 1.9 + i * 0.2, phase: i * 2, kind: m }));
  }
  return out;
}
