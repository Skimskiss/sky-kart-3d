// Geometry checks for every track: closed smooth loop, no overlaps, sane corners, valid shortcut / pads / ramps / coins / checkpoints.
//   node scripts/check-tracks.mjs [--layout]    (--layout also writes scripts/out/layout.html for a visual check)
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TRACK_LIST } from '../src/game/tracks.js';
import { buildTrack, wrapIdx } from '../src/game/trackBuild.js';

let bad = 0;
const fail = (id, msg) => { bad++; console.log(`  FAIL ${id}: ${msg}`); };
const rows = [];
const layouts = [];

for (const def of TRACK_LIST) {
  const tr = buildTrack(def);
  const { N, ds, px, pz, halfRoad, wallHalf, branch: br } = tr;
  const id = def.id;
  const lap = N * ds;
  let maxCurv = 0;
  for (let i = 0; i < N; i++) maxCurv = Math.max(maxCurv, tr.curv[i]);
  const minRadius = 1 / maxCurv;

  // 1. clearance between parts of the road that are far apart along the lap
  let minClear = 1e9, at = [0, 0];
  for (let i = 0; i < N; i += 2) {
    for (let j = i + 1; j < N; j += 2) {
      const arc = Math.min(j - i, N - (j - i)) * ds;
      if (arc < 90) continue;
      const d = Math.hypot(px[i] - px[j], pz[i] - pz[j]);
      if (d < minClear) { minClear = d; at = [i, j]; }
    }
  }
  const needClear = 2 * wallHalf + 4;
  if (minClear < needClear) fail(id, `road parts only ${minClear.toFixed(1)} m apart at samples ${at} (need ${needClear.toFixed(1)})`);
  if (lap < 800 || lap > 1700) fail(id, `lap length ${lap.toFixed(0)} m outside 800-1700`);
  if (minRadius < halfRoad * 1.6) fail(id, `tightest corner radius ${minRadius.toFixed(1)} m is too tight for a ${2 * halfRoad} m road`);

  // 2. start straight
  let startCurv = 0;
  for (let o = -30; o <= 25; o++) startCurv = Math.max(startCurv, tr.curv[(o + N) % N]);
  if (startCurv > 0.03) fail(id, `start area not straight enough (curvature ${startCurv.toFixed(4)})`);

  // 3. checkpoints
  const cps = tr.cps.map((c) => c.idx);
  for (let i = 1; i < cps.length; i++) if (cps[i] <= cps[i - 1]) fail(id, 'checkpoints not strictly increasing');
  if (cps.length < 4) fail(id, 'fewer than 4 checkpoints');
  if (cps.some((c) => c < 15 || c > N - 15)) fail(id, 'checkpoint too close to the finish line');

  // 4. shortcut
  let scInfo = '-';
  if (br) {
    const a = br.a, b = br.b;
    if (!(a < b)) fail(id, 'shortcut a >= b');
    const mainLen = (b - a) * ds, brLen = br.len;
    const saving = 1 - brLen / mainLen;
    if (saving < 0.08) fail(id, `shortcut saves only ${(saving * 100).toFixed(0)}% distance`);
    let minSep = 1e9;
    for (let j = 18; j < br.M - 18; j++) {
      for (let i = 0; i < N; i++) {
        const d = Math.hypot(br.px[j] - px[i], br.pz[j] - pz[i]);
        if (d < minSep) minSep = d;
      }
    }
    // the shortcut must keep its distance from the main road across the middle (otherwise the roads merge)
    if (minSep < br.half + tr.halfRoad + 2) fail(id, `shortcut comes within ${minSep.toFixed(1)} m of the main road in its middle part`);
    if (cps.some((c) => c > a + 1 && c < b - 1)) fail(id, 'a checkpoint lies inside the shortcut range');
    for (const r of tr.ramps) if (r.idx + r.len > a - 3 && r.idx < b + 3) fail(id, 'a main-road ramp overlaps the shortcut range');
    for (const p of tr.boosts) if (p.idx > a - 3 && p.idx < b + 3) fail(id, 'a main-road boost pad lies inside the shortcut range');
    scInfo = `${br.name} saves ${(saving * 100).toFixed(0)}% (${brLen.toFixed(0)} vs ${mainLen.toFixed(0)} m), ${br.surface}`;
  } else fail(id, 'no shortcut');

  // 5. pads / ramps / coins
  for (const r of tr.ramps) if (r.len * ds > 24) fail(id, 'ramp longer than 24 m');
  for (const c of tr.coins) {
    // each coin must be on the road it belongs to
    if (!c.branch) {
      let d = 1e9;
      for (let o = -4; o <= 4; o++) { const i = (c.idx + o + N) % N; d = Math.min(d, Math.hypot(c.x - px[i], c.z - pz[i])); }
      if (d > halfRoad) { fail(id, `coin ${c.id} is ${d.toFixed(1)} m from the road centre`); break; }
    }
  }
  if (tr.boosts.length < 2) fail(id, 'fewer than 2 boost pads');
  if (tr.ramps.length < 1) fail(id, 'no ramp');
  if (!def.tasks || !(def.tasks.coins > 0 && def.tasks.time > 0)) fail(id, 'tasks missing');
  if (tr.coins.length < 30) fail(id, `only ${tr.coins.length} coins`);
  const lapCoins = tr.coins.filter((c) => !c.branch).length;

  rows.push({ id, lap: Math.round(lap), minR: Math.round(minRadius), clear: Math.round(minClear), coins: `${lapCoins}+${tr.coins.length - lapCoins}`, cps: cps.length, pads: tr.boosts.length, ramps: tr.ramps.length, movers: tr.movers.length, shortcut: scInfo });
  layouts.push({ def, tr });
}
console.table(rows);

if (process.argv.includes('--layout')) {
  const dir = fileURLToPath(new URL('./out/', import.meta.url));
  mkdirSync(dir, { recursive: true });
  const cards = layouts.map(({ def, tr }, n) => {
    let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
    for (let i = 0; i < tr.N; i++) { minX = Math.min(minX, tr.px[i]); maxX = Math.max(maxX, tr.px[i]); minZ = Math.min(minZ, tr.pz[i]); maxZ = Math.max(maxZ, tr.pz[i]); }
    const pad = 40, w = maxX - minX + pad * 2, h = maxZ - minZ + pad * 2;
    const P = (x, z) => `${(x - minX + pad).toFixed(1)},${(maxZ - z + pad).toFixed(1)}`;
    let d = '';
    for (let i = 0; i < tr.N; i++) d += (i ? 'L' : 'M') + P(tr.px[i], tr.pz[i]);
    d += 'Z';
    let bd = '';
    if (tr.branch) for (let j = 0; j < tr.branch.M; j++) bd += (j ? 'L' : 'M') + P(tr.branch.px[j], tr.branch.pz[j]);
    const cps = tr.cps.map((c) => `<circle cx="${P(tr.px[c.idx], tr.pz[c.idx]).split(',')[0]}" cy="${P(tr.px[c.idx], tr.pz[c.idx]).split(',')[1]}" r="9" fill="#38bdf8"/>`).join('');
    const rp = tr.ramps.map((r) => `<circle cx="${P(tr.px[r.idx], tr.pz[r.idx]).split(',')[0]}" cy="${P(tr.px[r.idx], tr.pz[r.idx]).split(',')[1]}" r="8" fill="#a855f7"/>`).join('');
    const bp = tr.boosts.map((r) => `<circle cx="${P(tr.px[r.idx], tr.pz[r.idx]).split(',')[0]}" cy="${P(tr.px[r.idx], tr.pz[r.idx]).split(',')[1]}" r="6" fill="#facc15"/>`).join('');
    const co = tr.coins.map((c) => `<circle cx="${P(c.x, c.z).split(',')[0]}" cy="${P(c.x, c.z).split(',')[1]}" r="2.5" fill="${c.y ? '#ea580c' : '#f59e0b'}"/>`).join('');
    const mv = tr.movers.map((m) => { const q = m.j !== undefined ? [tr.branch.px[m.j], tr.branch.pz[m.j]] : [tr.px[m.idx], tr.pz[m.idx]]; return `<rect x="${P(q[0], q[1]).split(',')[0] - 7}" y="${P(q[0], q[1]).split(',')[1] - 7}" width="14" height="14" fill="#ef4444"/>`; }).join('');
    return `<div class="c"><b>${n + 1}. ${def.name}</b> (${Math.round(tr.N * tr.ds)} m)<svg viewBox="0 0 ${w} ${h}" width="420" style="background:#1e293b"><path d="${d}" fill="none" stroke="#cbd5e1" stroke-width="${tr.halfRoad * 2}" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#475569" stroke-width="${tr.halfRoad * 2 - 4}"/>${bd ? `<path d="${bd}" fill="none" stroke="#fb923c" stroke-width="${tr.branch.half * 2}"/>` : ''}${co}${cps}${rp}${bp}${mv}<circle cx="${P(tr.px[0], tr.pz[0]).split(',')[0]}" cy="${P(tr.px[0], tr.pz[0]).split(',')[1]}" r="11" fill="#22c55e"/></svg></div>`;
  }).join('');
  writeFileSync(`${dir}layout.html`, `<html><body style="margin:0;background:#0f172a;color:#fff;font:14px sans-serif"><div style="display:flex;flex-wrap:wrap;gap:10px;padding:10px">${cards}</div></body></html>`);
  console.log('layout written to scripts/out/layout.html');
}
console.log(bad ? `\n${bad} problem(s)` : '\nAll track geometry checks passed.');
process.exit(bad ? 1 : 0);
