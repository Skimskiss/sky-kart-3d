// Static 3D world of a track: road, walls, pads, ramps, checkpoints, the floating island, scenery and decoration.
// Built once per race from the track data. Everything is vertex-coloured Lambert geometry or instanced meshes.
import * as THREE from 'three';
import { part, merge, bufferFrom, B, Cyl, Cone, Sph, Dome, Dod, rng, hash, clamp, lerp } from './geo.js';
import { PROPS, LANDMARKS } from './props.js';
import { biomeProps } from './biomes.js';

const lam = (extra = {}) => new THREE.MeshLambertMaterial({ vertexColors: true, ...extra });
const decal = (extra = {}) => lam({ polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, ...extra });
const col = new THREE.Color();
const rgb = (hex) => { col.set(hex); return [col.r, col.g, col.b]; };

/* ---------- ribbons along the road ---------- */
// `tr` is the main track (a closed loop) or an open path { N, px, pz, nx, nz, closed: false } such as the shortcut road.
function ribbon(tr, latA, latB, y, colorAt, opts = {}) {
  const { height = 0, filter } = opts;
  const pos = [], cl = [];
  const closed = tr.closed !== false;
  const segs = closed ? tr.N : tr.N - 1;
  const cache = new Map();
  for (let i = 0; i < segs; i++) {
    if (filter && !filter(i)) continue;
    const c0 = colorAt(i);
    if (!c0) continue;
    if (!cache.has(c0)) cache.set(c0, rgb(c0));
    const c = cache.get(c0);
    const j = closed ? (i + 1) % tr.N : i + 1;
    const ax = tr.px[i] + tr.nx[i] * latA, az = tr.pz[i] + tr.nz[i] * latA;
    const bx = tr.px[i] + tr.nx[i] * latB, bz = tr.pz[i] + tr.nz[i] * latB;
    const ax2 = tr.px[j] + tr.nx[j] * latA, az2 = tr.pz[j] + tr.nz[j] * latA;
    const bx2 = tr.px[j] + tr.nx[j] * latB, bz2 = tr.pz[j] + tr.nz[j] * latB;
    const y1 = y + height;
    const A = [ax, y, az], Bv = height ? [ax, y1, az] : [bx, y, bz], A2 = [ax2, y, az2], B2 = height ? [ax2, y1, az2] : [bx2, y, bz2];
    for (const p of [A, Bv, A2, Bv, B2, A2]) { pos.push(p[0], p[1], p[2]); cl.push(c[0], c[1], c[2]); }
  }
  const g = bufferFrom(pos, cl);
  // flat strips face up, wall strips face outwards: make sure flat ones really point +y
  if (!height) { const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0); }
  return g;
}

function chevronGeo() {
  const s = new THREE.Shape();
  s.moveTo(-2.3, 0); s.lineTo(0, 2.0); s.lineTo(2.3, 0); s.lineTo(2.3, -0.9); s.lineTo(0, 1.1); s.lineTo(-2.3, -0.9); s.closePath();
  const g = new THREE.ShapeGeometry(s);
  g.rotateX(Math.PI / 2);
  return g;
}

function bannerTexture(text, bg, fg) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#111'; g.fillRect(0, 0, 512, 128);
  g.fillStyle = bg; g.fillRect(8, 8, 496, 112);
  g.fillStyle = fg; g.font = '900 72px "Arial Black", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

const SURFACE_LOOK = {
  dirt: { road: ['#b28a57', '#a67f4d'], border: ['#6b4423', '#8a5a2b'] },
  sand: { road: ['#f1d896', '#e8cc86'], border: ['#c9a65a', '#d9b96b'] },
  water: { road: ['#53b4ee', '#62c0f5'], border: ['#ffffff', '#bfe3ff'] },
  ice: { road: ['#d2f1ff', '#c1e9fb'], border: ['#ffffff', '#9fd8f5'] },
};

function mainDist(tr, x, z) {
  let b = 1e18;
  for (let i = 0; i < tr.N; i++) { const dx = x - tr.px[i], dz = z - tr.pz[i]; const d = dx * dx + dz * dz; if (d < b) b = d; }
  return Math.sqrt(b);
}
function branchDist(br, x, z) {
  let b = 1e18, bj = 0;
  for (let j = 0; j < br.M; j++) { const dx = x - br.px[j], dz = z - br.pz[j]; const d = dx * dx + dz * dz; if (d < b) { b = d; bj = j; } }
  const lon = (x - br.px[bj]) * br.tx[bj] + (z - br.pz[bj]) * br.tz[bj];
  const valid = (bj > 0 && bj < br.M - 1) || (bj === 0 && lon >= -1) || (bj === br.M - 1 && lon <= 1);
  return valid ? Math.sqrt(b) : Infinity;
}
const NECK = 7.6;

function neckGeometry(tr, br, color) {
  const pos = [], cl = [];
  const c = rgb(color);
  const nearestMain = (x, z) => {
    let b = 1e18, bi = 0;
    for (let i = 0; i < tr.N; i++) { const dx = x - tr.px[i], dz = z - tr.pz[i]; const d = dx * dx + dz * dz; if (d < b) { b = d; bi = i; } }
    return { i: bi, d: b };
  };
  for (const [j0, dir] of [[0, 1], [br.M - 1, -1]]) {
    let prev = null;
    for (let s = 0; s < 24; s++) {
      const j = j0 + dir * s;
      if (j < 0 || j >= br.M) break;
      const e1 = [br.px[j] + br.nx[j] * br.half, br.pz[j] + br.nz[j] * br.half];
      const e2 = [br.px[j] - br.nx[j] * br.half, br.pz[j] - br.nz[j] * br.half];
      const m1 = nearestMain(e1[0], e1[1]), m2 = nearestMain(e2[0], e2[1]);
      const [E, m] = m1.d <= m2.d ? [e1, m1] : [e2, m2];
      const F = [tr.px[m.i] + tr.nx[m.i] * br.side * tr.halfRoad, tr.pz[m.i] + tr.nz[m.i] * br.side * tr.halfRoad];
      const gap = Math.hypot(E[0] - F[0], E[1] - F[1]);
      if (gap > NECK) break;
      if (prev && Math.abs(m.i - prev.i) <= 8) {
        for (const p of [prev.E, prev.F, E, prev.F, F, E]) { pos.push(p[0], 0.012, p[1]); cl.push(c[0], c[1], c[2]); }
      }
      prev = { E, F, i: m.i };
    }
  }
  const g = bufferFrom(pos, cl);
  const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  return g;
}

/* ---------- ramps ---------- */
function rampGeometry(L, w, h, c1, c2) {
  const parts = [];
  // top surface in alternating slices
  const S = 6;
  for (let s = 0; s < S; s++) {
    const z0 = (s / S) * L, z1 = ((s + 1) / S) * L, y0 = (h * s) / S, y1 = (h * (s + 1)) / S;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-w, y0, z0, w, y0, z0, -w, y1, z1, w, y0, z0, w, y1, z1, -w, y1, z1], 3));
    const c = rgb(s % 2 ? c1 : c2);
    g.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: 6 }, () => c).flat(), 3));
    g.computeVertexNormals();
    parts.push(g);
  }
  // back wall and sides
  const mk = (pts, c) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); const cc = rgb(c); g.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: pts.length / 3 }, () => cc).flat(), 3)); g.computeVertexNormals(); return g; };
  parts.push(mk([-w, 0, L, -w, h, L, w, h, L, -w, 0, L, w, h, L, w, 0, L], '#2a2f4a'));
  parts.push(mk([-w, 0, 0, -w, h, L, -w, 0, L, w, 0, 0, w, 0, L, w, h, L], '#d8dcff'));
  parts.push(mk([-w, 0, 0, -w - 0.01, 0, L, -w - 0.01, h, L], '#d8dcff'));
  return mergeSimple(parts);
}
function mergeSimple(list) {
  const out = merge(list);
  return out;
}

/* ---------- island ---------- */
function islandHull(tr, margin) {
  let cx = 0, cz = 0;
  for (let i = 0; i < tr.N; i++) { cx += tr.px[i]; cz += tr.pz[i]; }
  cx /= tr.N; cz /= tr.N;
  const K = 120, R = new Float32Array(K);
  const ph1 = (hash(tr.id) % 100) / 16, ph2 = (hash(tr.id + 'x') % 100) / 16;
  for (let k = 0; k < K; k++) {
    const a = (k / K) * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
    const m = margin + 9 * Math.sin(3 * a + ph1) + 5 * Math.sin(7 * a + ph2);
    let best = m;
    for (let i = 0; i < tr.N; i += 2) {
      const rx = tr.px[i] - cx, rz = tr.pz[i] - cz;
      const proj = rx * dx + rz * dz, perp2 = rx * rx + rz * rz - proj * proj;
      if (perp2 < m * m) best = Math.max(best, proj + Math.sqrt(m * m - perp2));
    }
    R[k] = best;
  }
  for (let pass = 0; pass < 3; pass++) { const c = R.slice(); for (let k = 0; k < K; k++) R[k] = (c[(k + K - 1) % K] + c[k] * 2 + c[(k + 1) % K]) / 4; }
  return { cx, cz, K, R, at: (a) => { const f = (((a / (Math.PI * 2)) % 1) + 1) % 1 * K, k = Math.floor(f), t = f - k; return lerp(R[k % K], R[(k + 1) % K], t); } };
}

function buildIsland(tr, th, r) {
  const hull = islandHull(tr, tr.wallHalf + 36);
  const { cx, cz, K, R } = hull;
  const pos = [], cl = [];
  const g1 = rgb(th.ground), g2 = rgb(th.ground2 || th.ground), cliffC = new THREE.Color(th.cliff || '#a3794f');
  const ptsAt = (k, s) => { const a = (k / K) * Math.PI * 2; return [cx + Math.cos(a) * R[k % K] * s, cz + Math.sin(a) * R[k % K] * s]; };
  const noise = (x, z) => 0.5 + 0.25 * Math.sin(x * 0.045 + 1.3) * Math.sin(z * 0.05) + 0.25 * Math.sin(x * 0.11 + z * 0.09);
  const tmp = new THREE.Color();
  const groundCol = (x, z, edge) => {
    const n = noise(x, z);
    const m = clamp((n - 0.5) * 2.2 + edge * 1.4, 0, 1);
    tmp.setRGB(lerp(g1[0], g2[0], m), lerp(g1[1], g2[1], m), lerp(g1[2], g2[2], m));
    const sh = 0.96 + 0.08 * noise(z * 1.7, x * 1.3);
    return [tmp.r * sh, tmp.g * sh, tmp.b * sh];
  };
  const tri = (a, b, c, ca, cb, cc2) => { for (const [p, q] of [[a, ca], [b, cb], [c, cc2]]) { pos.push(p[0], p[1], p[2]); cl.push(q[0], q[1], q[2]); } };
  // top: polar rings
  const rings = [0, 0.08, 0.16, 0.25, 0.34, 0.43, 0.52, 0.61, 0.7, 0.78, 0.85, 0.91, 0.96, 1];
  const y0 = -0.1;
  for (let ri = 0; ri < rings.length - 1; ri++) {
    for (let k = 0; k < K; k++) {
      const s0 = rings[ri], s1 = rings[ri + 1];
      const a = [cx + (ptsAt(k, s0)[0] - cx), 0], A = ptsAt(k, s0), Bp = ptsAt(k + 1, s0), C = ptsAt(k, s1), D = ptsAt(k + 1, s1);
      void a;
      const e0 = s0 > 0.9 ? 1 : 0, e1 = s1 > 0.9 ? 1 : 0;
      const cA = groundCol(A[0], A[1], e0), cB = groundCol(Bp[0], Bp[1], e0), cC = groundCol(C[0], C[1], e1), cD = groundCol(D[0], D[1], e1);
      if (ri === 0) tri([cx, y0, cz], [C[0], y0, C[1]], [D[0], y0, D[1]], cA, cC, cD);
      else { tri([A[0], y0, A[1]], [C[0], y0, C[1]], [Bp[0], y0, Bp[1]], cA, cC, cB); tri([Bp[0], y0, Bp[1]], [C[0], y0, C[1]], [D[0], y0, D[1]], cB, cC, cD); }
    }
  }
  // cliff + underside: rings of (scale, y)
  const prof = [[1, y0], [0.985, -5], [0.9, -11], [0.78, -20], [0.58, -33], [0.34, -48], [0, -66]];
  const cliffAt = (k, i) => { const j = Math.sin(k * 12.9898 + i * 78.233) * 43758.5453; const f = j - Math.floor(j); const s = prof[i][0] * (1 + (f - 0.5) * (i > 0 && i < prof.length - 1 ? 0.12 : 0)); const p = ptsAt(k, s); return [p[0], prof[i][1], p[1]]; };
  const cliffCol = (i, k) => { const t = i / (prof.length - 1); const v = 0.88 + 0.2 * Math.sin(k * 3.7 + i * 5.1); const base = new THREE.Color().copy(cliffC).multiplyScalar(lerp(1.0, 0.5, t) * v); if (i === 0) base.lerp(new THREE.Color(th.ground), 0.55); return [base.r, base.g, base.b]; };
  for (let i = 0; i < prof.length - 1; i++) {
    for (let k = 0; k < K; k++) {
      const A = cliffAt(k, i), Bp = cliffAt(k + 1, i), C = cliffAt(k, i + 1), D = cliffAt(k + 1, i + 1);
      const cA = cliffCol(i, k), cB = cliffCol(i, k + 1), cC = cliffCol(i + 1, k), cD = cliffCol(i + 1, k + 1);
      if (i === prof.length - 2) tri(A, C, Bp, cA, cC, cB);
      else { tri(A, C, Bp, cA, cC, cB); tri(Bp, C, D, cB, cC, cD); }
    }
  }
  const geo = bufferFrom(pos, cl);
  const mesh = new THREE.Mesh(geo, lam({ flatShading: true, side: THREE.DoubleSide }));
  mesh.receiveShadow = true;
  void r;
  return { mesh, hull };
}

/* ---------- placement ---------- */
function trackGrid(tr) {
  const cell = 24, map = new Map();
  const add = (x, z) => { const key = Math.floor(x / cell) + ',' + Math.floor(z / cell); (map.get(key) || map.set(key, []).get(key)).push([x, z]); };
  for (let i = 0; i < tr.N; i++) add(tr.px[i], tr.pz[i]);
  if (tr.branch) for (let j = 0; j < tr.branch.M; j++) add(tr.branch.px[j], tr.branch.pz[j]);
  return (x, z) => {
    let b = 1e9;
    const cx = Math.floor(x / cell), cz = Math.floor(z / cell);
    for (let a = -1; a <= 1; a++) for (let c = -1; c <= 1; c++) {
      const l = map.get((cx + a) + ',' + (cz + c));
      if (l) for (const [px, pz] of l) { const d = Math.hypot(x - px, z - pz); if (d < b) b = d; }
    }
    return b;
  };
}

export function buildTrackWorld(tr, quality) {
  const th = tr.def.theme;
  const br = tr.branch;
  const group = new THREE.Group();
  const r = rng(hash(tr.id));
  const half = tr.halfRoad, wallHalf = tr.wallHalf;

  const at = (i, lat) => [tr.px[i] + tr.nx[i] * lat, tr.pz[i] + tr.nz[i] * lat];
  const mainClear = (lat, reach) => (i) => { if (!br) return true; const [x, z] = at(i, lat); return branchDist(br, x, z) > reach; };

  // ----- road -----
  const road = new THREE.Mesh(ribbon(tr, -half, half, 0.0, (i) => (Math.floor(i / 6) % 2 ? th.roadAlt : th.road)), lam());
  road.receiveShadow = true; group.add(road);
  const curbReach = br ? br.half + NECK + 1 : 0;
  group.add(new THREE.Mesh(ribbon(tr, -half - 1.4, -half, 0.03, (i) => th.curb[Math.floor(i / 3) % 2], { filter: mainClear(-half - 0.7, curbReach) }), decal()));
  group.add(new THREE.Mesh(ribbon(tr, half, half + 1.4, 0.03, (i) => th.curb[Math.floor(i / 3) % 2], { filter: mainClear(half + 0.7, curbReach) }), decal()));
  group.add(new THREE.Mesh(ribbon(tr, -0.22, 0.22, 0.04, () => '#ffffff', { filter: (i) => i % 4 < 2 }), decal()));
  group.add(new THREE.Mesh(ribbon(tr, -half + 0.7, -half + 1.15, 0.04, () => '#ffffff', { filter: mainClear(-half + 0.9, br ? br.half + 2 : 0) }), decal()));
  group.add(new THREE.Mesh(ribbon(tr, half - 1.15, half - 0.7, 0.04, () => '#ffffff', { filter: mainClear(half - 0.9, br ? br.half + 2 : 0) }), decal()));

  const zoneCol = { 1: '#f0d68a', 2: th.mud || '#5fb7ee', 3: '#cdeeff' };
  if (tr.zone.some((z) => z)) group.add(new THREE.Mesh(ribbon(tr, -half, half, 0.05, (i) => zoneCol[tr.zone[i]], { filter: (i) => tr.zone[i] !== 0 }), decal({ polygonOffsetFactor: -3, polygonOffsetUnits: -3 })));

  // walls: low striped barriers
  const wallMat = lam({ side: THREE.DoubleSide });
  const wall = (side) => new THREE.Mesh(ribbon(tr, side * wallHalf, side * wallHalf, 0, (i) => th.wall[Math.floor(i / 4) % 2], { height: 1.4, filter: mainClear(side * wallHalf, br ? br.wall : 0) }), wallMat);
  group.add(wall(-1), wall(1));

  // start / finish line + arch
  const cp = [], cc = [];
  for (let c = 0; c < 14; c++) for (let rr = 0; rr < 2; rr++) {
    const lat0 = -half + c * ((2 * half) / 14);
    const lat1 = lat0 + (2 * half) / 14;
    const P = (idx, lat) => [tr.px[idx] + tr.nx[idx] * lat, 0.05, tr.pz[idx] + tr.nz[idx] * lat];
    const a = P(rr, lat0), b = P(rr, lat1), a2 = P(rr + 1, lat0), b2 = P(rr + 1, lat1);
    const cl = rgb((c + rr) % 2 ? '#ffffff' : '#111111');
    for (const p of [a, b, a2, b, b2, a2]) { cp.push(...p); cc.push(...cl); }
  }
  const cg = bufferFrom(cp, cc);
  { const n = cg.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0); }
  group.add(new THREE.Mesh(cg, decal({ polygonOffsetFactor: -4, polygonOffsetUnits: -4 })));

  const archParts = [part(B(1.0, 9, 1.0), '#e63946', [-half - 2.4, 4.5, 0]), part(B(1.0, 9, 1.0), '#1d4ed8', [half + 2.4, 4.5, 0]), part(B(2 * half + 5.8, 0.7, 0.8), '#1f2937', [0, 9.1, 0])];
  for (let c = 0; c < 20; c++) for (let rr = 0; rr < 2; rr++) archParts.push(part(B(1.3, 1.3, 0.35), (c + rr) % 2 ? '#ffffff' : '#111111', [-half - 1.9 + c * ((2 * half + 3.8) / 20) + 0.65, 7.4 + rr * 1.3, 0]));
  const arch = new THREE.Mesh(merge(archParts), lam());
  arch.position.set(tr.px[0], 0, tr.pz[0]); arch.rotation.y = tr.th[0];
  group.add(arch);

  // checkpoint gates (thin flag posts, so players can see where the lap is validated)
  const cpGeo = merge([part(Cyl(0.12, 0.12, 5, 5), '#e8f1ff', [-half - 1.8, 2.5, 0]), part(Cyl(0.12, 0.12, 5, 5), '#e8f1ff', [half + 1.8, 2.5, 0]), part(B(1.5, 0.9, 0.06), '#38bdf8', [-half - 2.55, 4.4, 0]), part(B(1.5, 0.9, 0.06), '#38bdf8', [half + 2.55, 4.4, 0])]);
  for (const c of tr.cps) { const m = new THREE.Mesh(cpGeo, lam()); m.position.set(tr.px[c.idx], 0, tr.pz[c.idx]); m.rotation.y = tr.th[c.idx]; group.add(m); }

  // boost pads (glowing chevrons) and ramps
  const chev = chevronGeo();
  const padA = new THREE.MeshBasicMaterial({ color: '#52e1ff', side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
  const padB = new THREE.MeshBasicMaterial({ color: '#b8f3ff', side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
  const baseMat = new THREE.MeshBasicMaterial({ color: '#12305a', polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 });
  const addBoost = (x, z, ang, w) => {
    const bw = Math.min(w, 5.2) * 2;
    const baseGeo = new THREE.PlaneGeometry(bw, 8.4); baseGeo.rotateX(-Math.PI / 2);
    const g = new THREE.Group();
    const base = new THREE.Mesh(baseGeo, baseMat); base.position.y = 0.06; g.add(base);
    [-2.6, 0, 2.6].forEach((zz, i) => { const m = new THREE.Mesh(chev, i % 2 ? padB : padA); m.scale.set(bw / 9, 1, 1); m.position.set(0, 0.08, zz - 0.5); g.add(m); });
    g.position.set(x, 0, z); g.rotation.y = ang;
    group.add(g);
  };
  for (const p of tr.boosts) addBoost(tr.px[p.idx] + tr.nx[p.idx] * p.lat, tr.pz[p.idx] + tr.nz[p.idx] * p.lat, tr.th[p.idx], p.w);
  const rampC = th.ramp || ['#ffb703', '#ff7b00'];
  const addRamp = (x, z, ang, rd, ds) => {
    const L = rd.len * ds;
    const m = new THREE.Mesh(rampGeometry(L, rd.w, rd.h, rampC[0], rampC[1]), lam({ side: THREE.DoubleSide }));
    m.position.set(x, 0, z); m.rotation.y = ang; m.castShadow = quality !== 'low';
    group.add(m);
  };
  for (const p of tr.ramps) addRamp(tr.px[p.idx] + tr.nx[p.idx] * p.lat, tr.pz[p.idx] + tr.nz[p.idx] * p.lat, tr.th[p.idx], p, tr.ds);

  // ----- the shortcut road -----
  if (br) {
    const path = { N: br.M, px: br.px, pz: br.pz, nx: br.nx, nz: br.nz, closed: false };
    const look = SURFACE_LOOK[br.surface];
    const roadCols = look ? look.road : [th.road, th.roadAlt];
    const borderCols = look ? look.border : th.curb;
    const bp = (j, lat) => [br.px[j] + br.nx[j] * lat, br.pz[j] + br.nz[j] * lat];
    const dec = (n) => decal({ polygonOffsetFactor: -n, polygonOffsetUnits: -n });
    const bRoad = new THREE.Mesh(ribbon(path, -br.half, br.half, 0.015, (j) => roadCols[Math.floor(j / 5) % 2]), dec(3));
    bRoad.receiveShadow = true; group.add(bRoad);
    if (br.surface === 'road') group.add(new THREE.Mesh(ribbon(path, -0.18, 0.18, 0.03, () => '#ffd23f', { filter: (j) => j % 4 < 2 }), dec(4)));
    const outMain = (lat, reach) => (j) => { const [x, z] = bp(j, lat); return mainDist(tr, x, z) > reach; };
    const borderReach = half + NECK + 1.5;
    group.add(new THREE.Mesh(ribbon(path, -br.half - 0.9, -br.half, 0.03, (j) => borderCols[Math.floor(j / 3) % 2], { filter: outMain(-br.half - 0.45, borderReach) }), dec(4)));
    group.add(new THREE.Mesh(ribbon(path, br.half, br.half + 0.9, 0.03, (j) => borderCols[Math.floor(j / 3) % 2], { filter: outMain(br.half + 0.45, borderReach) }), dec(4)));
    const bWallMat = lam({ side: THREE.DoubleSide });
    const bWall = (side) => new THREE.Mesh(ribbon(path, side * br.wall, side * br.wall, 0, (j) => (Math.floor(j / 3) % 2 ? '#facc15' : '#1f2937'), { height: 1.3, filter: outMain(side * br.wall, wallHalf) }), bWallMat);
    group.add(bWall(-1), bWall(1));
    group.add(new THREE.Mesh(neckGeometry(tr, br, th.roadAlt), decal({ side: THREE.DoubleSide, polygonOffsetFactor: -1, polygonOffsetUnits: -1 })));

    const j0 = Math.min(br.M - 2, 7), w2 = br.half + 1.4;
    const archPosts = merge([part(B(0.8, 7.4, 0.8), '#facc15', [-w2, 3.7, 0]), part(B(0.8, 7.4, 0.8), '#facc15', [w2, 3.7, 0]), part(B(2 * w2 + 0.8, 0.5, 0.6), '#1f2937', [0, 7.6, 0])]);
    const arch2 = new THREE.Group();
    arch2.add(new THREE.Mesh(archPosts, lam()));
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2 * w2, (2 * w2) / 4), new THREE.MeshBasicMaterial({ map: bannerTexture('SHORTCUT »', '#facc15', '#111'), side: THREE.DoubleSide }));
    sign.position.set(0, 7.6 + w2 / 4 + 0.3, 0); sign.rotation.y = Math.PI;
    arch2.add(sign);
    arch2.position.set(br.px[j0], 0, br.pz[j0]); arch2.rotation.y = br.th[j0];
    group.add(arch2);

    for (const p of br.boosts) addBoost(br.px[p.j], br.pz[p.j], br.th[p.j], p.w);
    for (const p of br.ramps) addRamp(br.px[p.j], br.pz[p.j], br.th[p.j], p, br.ds);
  }

  // ----- island, sea, far islands -----
  const { mesh: island, hull } = buildIsland(tr, th, r);
  group.add(island);
  const grid = trackGrid(tr);

  // waterfalls hanging off the rim
  const wfPos = [], wfCol = [];
  const nWf = 4 + (hash(tr.id) % 3);
  for (let n = 0; n < nWf; n++) {
    const a = ((n + 0.3 + r() * 0.4) / nWf) * Math.PI * 2, rad = hull.at(a) * 1.0 + 0.3;
    const x = hull.cx + Math.cos(a) * rad, z = hull.cz + Math.sin(a) * rad;
    const tx = -Math.sin(a), tz = Math.cos(a), w = 3.4 + r() * 3.4, drop = 70 + r() * 20;
    const segs = 7;
    for (let s = 0; s < segs; s++) {
      const y0 = -0.4 - (s / segs) * drop, y1 = -0.4 - ((s + 1) / segs) * drop;
      const c = rgb(s % 2 ? '#ffffff' : '#bfe9ff');
      const out0 = 0.2 + (s / segs) * 3.5, out1 = 0.2 + ((s + 1) / segs) * 3.5, ox = Math.cos(a), oz = Math.sin(a);
      const P = (sgn, y, o) => [x + tx * w * sgn + ox * o, y, z + tz * w * sgn + oz * o];
      for (const p of [P(-1, y0, out0), P(1, y0, out0), P(-1, y1, out1), P(1, y0, out0), P(1, y1, out1), P(-1, y1, out1)]) { wfPos.push(...p); wfCol.push(...c); }
    }
  }
  const wfGeo = bufferFrom(wfPos, wfCol);
  group.add(new THREE.Mesh(wfGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.78, side: THREE.DoubleSide, depthWrite: false })));

  // the sea / cloud floor far below
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: th.water || th.skyBot, fog: true }));
  sea.position.set(hull.cx, -92, hull.cz); group.add(sea);

  // far floating islands (one shared geometry, instanced)
  const farGeo = merge([part(Cyl(1, 1, 0.5, 14), th.ground, [0, 0, 0]), part(Cone(1, 1, 14), th.cliff || '#a3794f', [0, -0.8, 0], [1, 1.8, 1], [Math.PI, 0, 0])]);
  const nFar = quality === 'low' ? 7 : 12;
  const far = new THREE.InstancedMesh(farGeo, lam({ flatShading: true }), nFar);
  const dum = new THREE.Object3D();
  const maxR = Math.max(...hull.R);
  const farSpots = [];
  for (let i = 0; i < nFar; i++) {
    const a = (i / nFar) * Math.PI * 2 + r() * 0.4, d = maxR + 90 + r() * 330, s = 22 + r() * 46;
    const y = -30 + r() * 80;
    dum.position.set(hull.cx + Math.cos(a) * d, y, hull.cz + Math.sin(a) * d);
    dum.rotation.set(0, r() * 6, 0); dum.scale.set(s, s * 0.55, s); dum.updateMatrix();
    far.setMatrixAt(i, dum.matrix);
    far.setColorAt(i, new THREE.Color().setHSL(0, 0, 0.9 + r() * 0.1));
    farSpots.push({ x: dum.position.x, y: y + 0.4, z: dum.position.z, s });
  }
  group.add(far);

  // ----- scenery -----
  const density = quality === 'low' ? 0.45 : quality === 'medium' ? 0.75 : 1;
  const mat = lam({ flatShading: true });
  const inHull = (x, z, m = 8) => { const a = Math.atan2(z - hull.cz, x - hull.cx); return Math.hypot(x - hull.cx, z - hull.cz) < hull.at(a) - m; };
  const minTrack = wallHalf + 2.6;
  const placeOnIsland = (n, test) => {
    const out = [];
    let tries = 0;
    while (out.length < n && tries < n * 40) {
      tries++;
      let x, z;
      if (r() < 0.65) {
        const i = Math.floor(r() * tr.N), side = r() < 0.5 ? -1 : 1, off = wallHalf + 2 + Math.pow(r(), 1.5) * 70;
        x = tr.px[i] + tr.nx[i] * side * off; z = tr.pz[i] + tr.nz[i] * side * off;
      } else {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * hull.at(a);
        x = hull.cx + Math.cos(a) * d; z = hull.cz + Math.sin(a) * d;
      }
      if (!inHull(x, z)) continue;
      if (grid(x, z) < minTrack) continue;
      if (test && !test(x, z)) continue;
      out.push([x, z]);
    }
    return out;
  };
  for (const pdef of biomeProps(tr.def)) {
    const build = PROPS[pdef.kind];
    if (!build) continue;
    const n = Math.round(pdef.count * density);
    const spots = placeOnIsland(n);
    const geo = build();
    const inst = new THREE.InstancedMesh(geo, mat, spots.length);
    spots.forEach(([x, z], i) => {
      const s = (pdef.scale || 1) * (0.75 + r() * 0.8);
      dum.position.set(x, -0.05, z); dum.rotation.set(0, r() * 6.28, 0); dum.scale.set(s, s * (0.9 + r() * 0.3), s); dum.updateMatrix();
      inst.setMatrixAt(i, dum.matrix);
      const t = pdef.tint ?? 0.16;
      inst.setColorAt(i, new THREE.Color().setHSL(r(), 0, 1 - r() * t));
    });
    inst.instanceMatrix.needsUpdate = true; if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.computeBoundingSphere();
    group.add(inst);
  }
  // props on the far islands
  const farKinds = biomeProps(tr.def).slice(0, 2);
  for (const pdef of farKinds) {
    const build = PROPS[pdef.kind];
    if (!build) continue;
    const items = [];
    for (const f of farSpots) for (let k = 0; k < 2; k++) { const a = r() * 6.28, d = r() * f.s * 0.6; items.push([f.x + Math.cos(a) * d, f.y + 0.2, f.z + Math.sin(a) * d]); }
    const inst = new THREE.InstancedMesh(build(), mat, items.length);
    items.forEach(([x, y, z], i) => { const s = 0.8 + r() * 0.6; dum.position.set(x, y, z); dum.rotation.set(0, r() * 6.28, 0); dum.scale.setScalar(s); dum.updateMatrix(); inst.setMatrixAt(i, dum.matrix); });
    inst.instanceMatrix.needsUpdate = true; inst.frustumCulled = false;
    group.add(inst);
  }

  // pennant poles along the walls
  const flagGeo = PROPS.banner();
  const flagN = Math.floor(tr.N / 30);
  const flags = new THREE.InstancedMesh(flagGeo, mat, flagN);
  for (let n = 0; n < flagN; n++) {
    const i = (n * 30 + 5) % tr.N, side = n % 2 ? 1 : -1, off = wallHalf + 1.6;
    const x = tr.px[i] + tr.nx[i] * side * off, z = tr.pz[i] + tr.nz[i] * side * off;
    if (br && (branchDist(br, x, z) < br.wall + 2)) { dum.position.set(0, -100, 0); } else dum.position.set(x, 0, z);
    dum.rotation.set(0, Math.atan2(tr.nx[i] * -side, tr.nz[i] * -side) + Math.PI / 2, 0); dum.scale.setScalar(0.85); dum.updateMatrix();
    flags.setMatrixAt(n, dum.matrix);
    flags.setColorAt(n, new THREE.Color(th.curb[0]).lerp(new THREE.Color('#ffffff'), 0.1));
  }
  flags.instanceMatrix.needsUpdate = true;
  group.add(flags);

  // landmarks
  const lm = tr.def.landmarks || [];
  const order = Array.from({ length: hull.K }, (_, k) => k).sort((a, b) => hull.R[b] - hull.R[a]);
  const used = [];
  for (const kind of lm) {
    const build = LANDMARKS[kind];
    if (!build) continue;
    for (const k of order) {
      const a = (k / hull.K) * Math.PI * 2;
      if (used.some((u) => Math.abs(Math.atan2(Math.sin(a - u), Math.cos(a - u))) < 0.9)) continue;
      const d = hull.R[k] * 0.74, x = hull.cx + Math.cos(a) * d, z = hull.cz + Math.sin(a) * d;
      if (grid(x, z) < wallHalf + 26) continue;
      used.push(a);
      const m = new THREE.Mesh(build(), mat);
      m.position.set(x, -0.05, z); m.rotation.y = Math.atan2(hull.cx - x, hull.cz - z);
      group.add(m);
      break;
    }
  }
  return { group, hull, farSpots };
}
void Sph; void Dome; void Dod;
