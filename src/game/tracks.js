// Track definitions are pure data. `pts` are control points of a smooth closed curve (metres, x / z); `scale` stretches them.
// Zone types: 1 sand (slow), 2 water / mud (slow), 3 ice (slippery).
//
// A definition either lists its hazards by hand (hazards / coins / shortcut with from+to lap fractions, see Tropical Coast),
// or gives an `auto` recipe: how many pads, ramps, zones and movers it wants, and the shortcut's style. autoplace.js then
// finds suitable places on the road (straights for pads and ramps, a real bend for the shortcut). Same data format either way.

// Smooth closed curve from a polar function r(a) = R * (1 + sum A cos(k a + ph)), stretched by sx / sz. The start line is put at
// the straightest stretch automatically. Returns control points for the spline.
function polar({ R, sx = 1, sz = 1, h = [], n = 44 }) {
  const M = 720, dense = [];
  for (let k = 0; k < M; k++) {
    const a = (k / M) * Math.PI * 2;
    let rr = 1;
    for (const [kk, A, ph] of h) rr += A * Math.cos(kk * a + ph);
    dense.push([R * rr * Math.cos(a) * sx, R * rr * Math.sin(a) * sz]);
  }
  return finish(dense, n);
}

// A loop around an open "spine" curve: out along one side, round the tip, back along the other side, round the start.
// Gives long S-bends, hairpins and banana shapes. d = half the distance between the two sides.
function snake({ spine, d, n = 56 }) {
  const P = spine, steps = 40, sp = [];
  const at = (i) => P[Math.max(0, Math.min(P.length - 1, i))];
  const ext = (a, b) => [2 * a[0] - b[0], 2 * a[1] - b[1]];
  const Q = [ext(P[0], P[1]), ...P, ext(P[P.length - 1], P[P.length - 2])];
  void at;
  for (let i = 1; i < Q.length - 2; i++) {
    for (let s = 0; s < steps; s++) {
      const t = s / steps, t2 = t * t, t3 = t2 * t, [p0, p1, p2, p3] = [Q[i - 1], Q[i], Q[i + 1], Q[i + 2]];
      sp.push([0, 1].map((k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
    }
  }
  sp.push(P[P.length - 1]);
  const M = sp.length, nrm = sp.map((p, i) => { const a = sp[Math.max(0, i - 1)], b = sp[Math.min(M - 1, i + 1)]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [-(b[1] - a[1]) / l, (b[0] - a[0]) / l]; });
  const loop = [];
  for (let i = 0; i < M; i++) loop.push([sp[i][0] + nrm[i][0] * d, sp[i][1] + nrm[i][1] * d]);
  const end = sp[M - 1], en = nrm[M - 1], capSteps = 18;
  for (let c = 1; c < capSteps; c++) { const a = (c / capSteps) * Math.PI; const tx = en[1], tz = -en[0]; loop.push([end[0] + en[0] * d * Math.cos(a) + tx * d * Math.sin(a), end[1] + en[1] * d * Math.cos(a) + tz * d * Math.sin(a)]); }
  for (let i = M - 1; i >= 0; i--) loop.push([sp[i][0] - nrm[i][0] * d, sp[i][1] - nrm[i][1] * d]);
  const st = sp[0], sn = nrm[0];
  for (let c = 1; c < capSteps; c++) { const a = (c / capSteps) * Math.PI; const tx = -sn[1], tz = sn[0]; loop.push([st[0] - sn[0] * d * Math.cos(a) + tx * d * Math.sin(a), st[1] - sn[1] * d * Math.cos(a) + tz * d * Math.sin(a)]); }
  // resample to even spacing so the start-line search below is fair
  const L = loop.length, cum = [0];
  for (let i = 1; i <= L; i++) cum.push(cum[i - 1] + Math.hypot(loop[i % L][0] - loop[i - 1][0], loop[i % L][1] - loop[i - 1][1]));
  const total = cum[L], dense = [], DM = 720;
  let j = 0;
  for (let k = 0; k < DM; k++) {
    const s = (k / DM) * total;
    while (cum[j + 1] < s) j++;
    const f = (s - cum[j]) / (cum[j + 1] - cum[j] || 1), a = loop[j], b = loop[(j + 1) % L];
    dense.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
  }
  return finish(dense, n);
}

// Puts the start line at the straightest stretch and thins the dense outline down to n control points.
function finish(dense, n) {
  const M = dense.length;
  const turn = dense.map((p, i) => {
    const a = dense[(i + M - 1) % M], b = dense[(i + 1) % M], c = dense[(i + 2) % M];
    const t1 = Math.atan2(b[0] - a[0], b[1] - a[1]), t2 = Math.atan2(c[0] - p[0], c[1] - p[1]);
    let d = t2 - t1;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return Math.abs(d);
  });
  let bi = 0, bv = 1e9;
  for (let i = 0; i < M; i++) {
    let m = 0;
    for (let o = -26; o <= 20; o++) m = Math.max(m, turn[(i + o + M) % M]);
    if (m < bv) { bv = m; bi = i; }
  }
  const pts = [];
  for (let j = 0; j < n; j++) pts.push(dense[(bi + Math.round((j * M) / n)) % M]);
  return pts;
}

// Replaces every sharp corner of a polygon by two points on its edges, so the spline turns it into a smooth fillet.
function chamfer(poly, k = 0.3) {
  const out = [], n = poly.length;
  for (let i = 0; i < n; i++) {
    const p = poly[i], a = poly[(i + n - 1) % n], b = poly[(i + 1) % n];
    out.push([p[0] + (a[0] - p[0]) * k, p[1] + (a[1] - p[1]) * k], [p[0] + (b[0] - p[0]) * k, p[1] + (b[1] - p[1]) * k]);
  }
  return out;
}

export const TRACK_LIST = [];
const add = (def) => { TRACK_LIST.push(def); return def; };

add({
  id: 'tropical', name: 'Tropical Coast', blurb: 'Sunny beaches, palm trees and a sandy shortcut across the bay.',
  diff: 1, tasks: { coins: 25, time: 110 },
  half: 9.5, scale: 0.62,
  pts: [[0, -250], [150, -235], [270, -170], [325, -60], [290, 55], [205, 100], [135, 65], [115, -25], [55, -85], [-30, -100], [-95, -55], [-110, 35], [-85, 125], [-150, 205], [-260, 180], [-320, 60], [-310, -90], [-250, -190], [-150, -230]],
  theme: { skyTop: '#2f8ff0', skyBot: '#bfe8ff', fog: '#cfeeff', fogFar: 650, ground: '#6fd05a', ground2: '#f1dc9a', road: '#6f7788', roadAlt: '#788095', curb: ['#e63946', '#ffffff'], wall: ['#2563eb', '#ffffff'], cliff: '#b88a5a', sun: '#fff3b0', weather: 'none', clouds: true, water: '#2ec4e8', mud: '#5fb7ee', ramp: ['#ffb703', '#ff7b00'] },
  props: [{ kind: 'palm', count: 170 }, { kind: 'bush', count: 90 }, { kind: 'flower', count: 120 }, { kind: 'rock', count: 40 }],
  landmarks: ['lighthouse'],
  music: { root: 62, scale: 'major', bpm: 132, seed: 11 },
  auto: { seed: 1, boosts: 4, ramps: 2, rampH: 2.4, glide: false, zones: [{ type: 1, count: 1, lenT: 0.035 }], movers: [], scT: 0.45 },
  shortcut: { name: 'Sand Spit', note: 'A sandy path across the beach.', surface: 'dirt', half: 6, angle: 24, speed: 0.95, pad: 'boost' },
});

add({
  id: 'snow', name: 'Snow Peaks', blurb: 'A zig-zag mountain road with two hairpins and slippery ice.',
  diff: 2, tasks: { coins: 28, time: 105 }, half: 9.5, scale: 0.46,
  pts: [[0, -230], [120, -230], [200, -230], [242, -212], [260, -170], [242, -128], [200, -110], [0, -110], [-200, -110], [-242, -92], [-260, -50], [-242, -8], [-200, 10], [0, 10], [200, 10], [242, 28], [260, 70], [242, 112], [200, 130], [0, 130], [-190, 130], [-290, 100], [-340, 30], [-345, -100], [-320, -200], [-250, -245], [-130, -240]],
  theme: { skyTop: '#3f8fe8', skyBot: '#e6f4ff', fog: '#e3f1fb', fogFar: 700, ground: '#f4f9ff', ground2: '#cfe6f7', road: '#59647c', roadAlt: '#626e88', curb: ['#38bdf8', '#ffffff'], wall: ['#bae6fd', '#ffffff'], cliff: '#9bb8d4', sun: '#ffffff', weather: 'snow', clouds: true, water: '#dcecf8', mud: '#bfe3f5', ramp: ['#7dd3fc', '#38bdf8'] },
  props: [{ kind: 'snowpine', count: 190 }, { kind: 'icecrystal', count: 55 }, { kind: 'rock', count: 40 }, { kind: 'pine', count: 60 }],
  landmarks: ['icespire'],
  music: { root: 65, scale: 'pent', bpm: 128, seed: 41 },
  auto: { seed: 2, boosts: 4, ramps: 2, zones: [{ type: 3, count: 3, lenT: 0.045 }], movers: [{ kind: 'snowball', count: 3, amp: 5.5 }], scT: 0.3 },
  shortcut: { name: 'Ice Slide', note: 'Fast but very slippery - steer gently.', surface: 'ice', half: 6, angle: 20, pad: 'boost' },
});

add({
  id: 'desert', name: 'Desert Ruins', blurb: 'Long sandy straights, ancient pillars and rolling boulders.',
  diff: 3, tasks: { coins: 30, time: 105 }, half: 9.5, scale: 0.6,
  pts: [[0, -230], [140, -232], [240, -215], [300, -160], [315, -90], [290, -30], [215, 5], [140, 40], [105, 110], [125, 190], [90, 255], [10, 285], [-80, 262], [-125, 200], [-112, 120], [-150, 45], [-240, 15], [-315, -35], [-325, -120], [-290, -190], [-200, -228], [-100, -232]],
  theme: { skyTop: '#4aa4f0', skyBot: '#ffe6b0', fog: '#ffe9c0', fogFar: 650, ground: '#f0c978', ground2: '#e0b060', road: '#7d6e63', roadAlt: '#887868', curb: ['#dc2626', '#fff3d6'], wall: ['#c2410c', '#fde68a'], cliff: '#c9885a', sun: '#fffbe6', weather: 'dust', clouds: true, water: '#e8c88a', mud: '#d9b070', ramp: ['#f5b301', '#c2410c'] },
  props: [{ kind: 'cactus', count: 120 }, { kind: 'sandrock', count: 70 }, { kind: 'pillar', count: 30 }, { kind: 'brokenpillar', count: 35 }, { kind: 'obelisk', count: 14 }, { kind: 'ruinarch', count: 8 }],
  landmarks: ['pyramid', 'pyramid'],
  music: { root: 62, scale: 'minorpent', bpm: 124, seed: 31 },
  auto: { seed: 3, boosts: 4, ramps: 2, glide: true, rampH: 2.6, zones: [{ type: 1, count: 3, lenT: 0.04 }], movers: [{ kind: 'rock', count: 3, amp: 5.5, speed: 1.6 }], scT: 0.55 },
  shortcut: { name: 'Temple Cut', note: 'Through the old temple: narrow, with a swinging boulder.', surface: 'dirt', half: 5.2, angle: 24, moverKinds: ['rock'] },
});

add({
  id: 'jungle', name: 'Emerald Jungle', blurb: 'Twisting vines, muddy bends and a wooden bridge shortcut.',
  diff: 4, tasks: { coins: 30, time: 130 }, half: 9, scale: 1,
  pts: polar({ R: 195, sx: 1.25, sz: 0.95, h: [[3, 0.2, 0.5], [5, 0.1, 1.2], [2, 0.1, 2]] }),
  theme: { skyTop: '#27a45f', skyBot: '#dcf7b4', fog: '#bfe8a0', fogFar: 520, ground: '#2f9e48', ground2: '#1f7a3a', road: '#7a6650', roadAlt: '#85705a', curb: ['#facc15', '#7c2d12'], wall: ['#7c4a21', '#b97b34'], cliff: '#7a5a3a', sun: '#fef9c3', weather: 'fireflies', clouds: false, water: '#2f8f6a', mud: '#7a5a2a', ramp: ['#c98a3c', '#7c4a21'] },
  props: [{ kind: 'jungletree', count: 190 }, { kind: 'fern', count: 130 }, { kind: 'vinerock', count: 40 }, { kind: 'bush', count: 60 }, { kind: 'flower', count: 40 }],
  landmarks: ['temple'],
  music: { root: 57, scale: 'minorpent', bpm: 132, seed: 5 },
  auto: { seed: 4, boosts: 3, ramps: 2, zones: [{ type: 2, count: 3, lenT: 0.04 }], movers: [{ kind: 'log', count: 3, amp: 5, speed: 1.4 }], scT: 0.5, straightCurv: 0.009 },
  shortcut: { name: 'Vine Bridge', note: 'A wooden bridge with a ramp in the middle.', surface: 'dirt', half: 5.2, angle: 26, pad: 'ramp' },
});

add({
  id: 'coral', name: 'Coral Ocean', blurb: 'Shallow lagoons, giant shells and a splashy underwater tunnel.',
  diff: 5, tasks: { coins: 32, time: 110 }, half: 9.5, scale: 1,
  pts: polar({ R: 150, sx: 1.05, sz: 0.95, h: [[2, 0.55, 0], [3, 0.06, 1]] }),
  theme: { skyTop: '#19b0e8', skyBot: '#c8f7ff', fog: '#bdf1fb', fogFar: 650, ground: '#f3e2a9', ground2: '#5ee0d0', road: '#5d7390', roadAlt: '#667d9c', curb: ['#ff7aa8', '#ffffff'], wall: ['#06b6d4', '#ffffff'], cliff: '#f0a58a', sun: '#fffbd0', weather: 'sparkle', clouds: true, water: '#1ea8d8', mud: '#5ec8e8', ramp: ['#ff9a62', '#ff6b9a'] },
  props: [{ kind: 'coral', count: 160 }, { kind: 'brain', count: 40 }, { kind: 'kelp', count: 90 }, { kind: 'shell', count: 40 }, { kind: 'palm', count: 50 }],
  landmarks: ['shellarch'],
  music: { root: 59, scale: 'major', bpm: 140, seed: 57 },
  auto: { seed: 5, boosts: 4, ramps: 2, zones: [{ type: 2, count: 3, lenT: 0.045 }], movers: [{ kind: 'crystal', count: 2, amp: 5.5 }, { kind: 'barrel', count: 1, amp: 5 }], scT: 0.3 },
  shortcut: { name: 'Reef Tunnel', note: 'A shallow-water shortcut. The entry pad keeps your speed up.', surface: 'water', half: 5.6, angle: 24, speed: 0.86, pad: 'boost' },
});

add({
  id: 'autumn', name: 'Autumn Forest', blurb: 'Golden leaves, haystacks and fast flowing S-bends.',
  diff: 6, tasks: { coins: 32, time: 145 }, half: 9.5, scale: 0.84,
  pts: snake({ spine: [[-330, -90], [-200, -150], [-50, -90], [60, 30], [200, 90], [340, 40]], d: 68 }),
  theme: { skyTop: '#4a9ee8', skyBot: '#ffe2b8', fog: '#ffe0b8', fogFar: 600, ground: '#c98a3c', ground2: '#8fb04a', road: '#6e6a74', roadAlt: '#77737f', curb: ['#e4572e', '#fff3d6'], wall: ['#8a5a2b', '#e9c46a'], cliff: '#8a5a3a', sun: '#fff0b0', weather: 'leaves', clouds: true, water: '#d9a860', mud: '#8a6030', ramp: ['#f2792b', '#8a5a2b'] },
  props: [{ kind: 'maple', count: 220 }, { kind: 'pumpkin', count: 50 }, { kind: 'haystack', count: 30 }, { kind: 'log', count: 25 }, { kind: 'bush', count: 40 }],
  landmarks: ['windmill', 'cabin'],
  music: { root: 60, scale: 'minorpent', bpm: 118, seed: 63 },
  auto: { seed: 6, boosts: 4, ramps: 2, zones: [{ type: 2, count: 2, lenT: 0.04 }], movers: [{ kind: 'log', count: 3, amp: 5.5 }], scT: 0.65 },
  shortcut: { name: 'Deer Trail', note: 'A leafy dirt trail through the trees.', surface: 'dirt', half: 6, angle: 26, speed: 0.95, pad: 'boost' },
});

add({
  id: 'lunar', name: 'Lunar Circuit', blurb: 'Low gravity! Long jumps over craters under a huge blue planet.',
  diff: 7, tasks: { coins: 34, time: 150 }, half: 10, scale: 0.97, grav: 0.55,
  pts: polar({ R: 215, sx: 1.25, sz: 1, h: [[3, 0.22, 0], [2, 0.09, 1], [5, 0.04, 2]] }),
  theme: { skyTop: '#02030a', skyBot: '#1b2342', fog: '#12163a', fogFar: 720, ground: '#9a9db0', ground2: '#6d7086', road: '#3b4056', roadAlt: '#444a62', curb: ['#fde047', '#ffffff'], wall: ['#6366f1', '#e0e7ff'], cliff: '#5a5d70', sun: '#ffffff', weather: 'none', clouds: false, stars: true, earth: true, water: '#05060f', mud: '#6d7086', ramp: ['#7dd3fc', '#6366f1'] },
  props: [{ kind: 'moonrock', count: 180 }, { kind: 'antenna', count: 12 }, { kind: 'rock', count: 40 }],
  landmarks: ['moonbase'],
  music: { root: 62, scale: 'minor', bpm: 120, seed: 71 },
  auto: { seed: 7, boosts: 4, ramps: 3, rampH: 2.8, glide: true, zones: [{ type: 1, count: 2, lenT: 0.04 }], movers: [{ kind: 'rock', count: 3, amp: 5.5, speed: 1.6 }], scT: 0.4 },
  shortcut: { name: 'Crater Cut', note: 'Straight across the crater, with a big jump.', surface: 'road', half: 5.4, angle: 24, pad: 'ramp' },
});

add({
  id: 'mushroom', name: 'Mushroom Grove', blurb: 'Giant mushrooms, glowing spores and a long hairpin loop.',
  diff: 8, tasks: { coins: 34, time: 135 }, half: 9, scale: 0.88,
  pts: snake({ spine: [[-340, 30], [-120, -70], [100, 70], [340, -30]], d: 50 }),
  theme: { skyTop: '#7a4ad8', skyBot: '#f4ceff', fog: '#e9c4ff', fogFar: 560, ground: '#7fd36a', ground2: '#4ea85a', road: '#6b5a8a', roadAlt: '#756396', curb: ['#ff4d8d', '#ffffff'], wall: ['#a855f7', '#fdf4ff'], cliff: '#8a5aa0', sun: '#fff0ff', weather: 'fireflies', clouds: true, water: '#b48ae8', mud: '#7a4aa0', ramp: ['#f0abfc', '#a855f7'] },
  props: [{ kind: 'mushroom', count: 80, scale: 1.3 }, { kind: 'mushroom2', count: 90, scale: 1.2 }, { kind: 'glowshroom', count: 150 }, { kind: 'fern', count: 60 }, { kind: 'flower', count: 70 }],
  landmarks: ['mushroomhouse'],
  music: { root: 64, scale: 'pent', bpm: 146, seed: 83 },
  auto: { seed: 8, boosts: 3, ramps: 2, rampH: 2.4, zones: [{ type: 2, count: 3, lenT: 0.04 }], movers: [{ kind: 'barrel', count: 3, amp: 5 }], scT: 0.45, straightCurv: 0.008 },
  shortcut: { name: 'Spore Path', note: 'A narrow path under a giant cap, with a bounce ramp.', surface: 'dirt', half: 5, angle: 26, pad: 'ramp' },
});

add({
  id: 'thunder', name: 'Thunder Island', blurb: 'A stormy five-corner circuit with lightning and rain.',
  diff: 9, tasks: { coins: 34, time: 145 }, half: 9, scale: 1,
  pts: polar({ R: 210, sx: 1.05, sz: 1, h: [[5, 0.17, 0.3], [2, 0.07, 0]] }),
  theme: { skyTop: '#161536', skyBot: '#5f5890', fog: '#4f4878', fogFar: 520, ground: '#51604f', ground2: '#3b463c', road: '#3d3f55', roadAlt: '#464862', curb: ['#facc15', '#1f2937'], wall: ['#6366f1', '#c7d2fe'], cliff: '#4a4660', sun: '#8a85c0', weather: 'rain', clouds: true, lightning: true, water: '#2a2850', mud: '#4a5a6a', ramp: ['#9fd8ff', '#6366f1'] },
  props: [{ kind: 'deadtree', count: 150 }, { kind: 'spire', count: 40 }, { kind: 'rock', count: 80 }, { kind: 'bush', count: 30 }],
  landmarks: ['stormtower'],
  music: { root: 57, scale: 'minor', bpm: 148, seed: 97 },
  auto: { seed: 9, boosts: 4, ramps: 2, zones: [{ type: 2, count: 2, lenT: 0.04 }], movers: [{ kind: 'rock', count: 4, amp: 5.5, speed: 2.0 }], scT: 0.5, straightCurv: 0.008 },
  shortcut: { name: 'Bolt Bridge', note: 'A narrow bridge between the storm clouds.', surface: 'road', half: 5, angle: 24, pad: 'boost' },
});

add({
  id: 'volcano', name: 'Volcanic Core', blurb: 'Hot rock, lava glow and falling embers around a volcano.',
  diff: 10, tasks: { coins: 36, time: 115 }, half: 9, scale: 1,
  pts: polar({ R: 175, sx: 1.1, sz: 0.95, h: [[1, 0.5, 0], [2, 0.22, 2.2], [3, 0.05, 1]] }),
  theme: { skyTop: '#3b0d0d', skyBot: '#f97316', fog: '#b4421a', fogFar: 520, ground: '#2b2224', ground2: '#ff6a1a', road: '#4a4850', roadAlt: '#54525c', curb: ['#fb923c', '#fde047'], wall: ['#431407', '#c2410c'], cliff: '#2a1d1d', sun: '#ffd27a', weather: 'embers', clouds: false, water: '#ff5a14', mud: '#5a3a2a', ramp: ['#ff6a1a', '#fde047'] },
  props: [{ kind: 'obsidian', count: 90 }, { kind: 'lavarock', count: 120 }, { kind: 'rock', count: 30 }],
  landmarks: ['volcano'],
  music: { root: 55, scale: 'minorpent', bpm: 142, seed: 103 },
  auto: { seed: 10, boosts: 4, ramps: 2, zones: [{ type: 1, count: 2, lenT: 0.04 }], movers: [{ kind: 'rock', count: 4, amp: 5.5, speed: 2.1 }], scT: 0.55, straightCurv: 0.009 },
  shortcut: { name: 'Ash Bridge', note: 'Short and steep. Watch the boulder!', surface: 'dirt', half: 5, angle: 24, moverKinds: ['rock'] },
});

add({
  id: 'aurora', name: 'Aurora Pass', blurb: 'Icy night roads under dancing northern lights.',
  diff: 11, tasks: { coins: 36, time: 140 }, half: 10, scale: 0.85,
  pts: snake({ spine: [[-330, 70], [-160, -30], [0, -75], [160, -30], [330, 70]], d: 80 }),
  theme: { skyTop: '#050b2e', skyBot: '#3a2a7a', fog: '#241a5a', fogFar: 650, ground: '#eaf6ff', ground2: '#a8d8f5', road: '#4a5778', roadAlt: '#546384', curb: ['#38d0ff', '#ffffff'], wall: ['#a5f3fc', '#ffffff'], cliff: '#7fa6c8', sun: '#e0f2ff', weather: 'sparkle', clouds: false, stars: true, aurora: true, water: '#16225a', mud: '#9fc8e8', ramp: ['#a5f3fc', '#38d0ff'] },
  props: [{ kind: 'icetree', count: 150 }, { kind: 'icecrystal', count: 80 }, { kind: 'aurorarock', count: 50 }, { kind: 'snowpine', count: 70 }],
  landmarks: ['icespire', 'icespire'],
  music: { root: 62, scale: 'major', bpm: 112, seed: 109 },
  auto: { seed: 11, boosts: 4, ramps: 2, zones: [{ type: 3, count: 4, lenT: 0.045 }], movers: [{ kind: 'crystal', count: 3, amp: 5.5 }], scT: 0.35 },
  shortcut: { name: 'Glacier Run', note: 'A sheet of ice across the glacier. Very fast and very slippery.', surface: 'ice', half: 6, angle: 22, pad: 'boost' },
});

add({
  id: 'castle', name: 'Sky Castle', blurb: 'The grand finale: jumps, boulders and a castle in the clouds.',
  diff: 12, tasks: { coins: 40, time: 120 }, half: 9.5, scale: 0.84,
  pts: polar({ R: 215, sx: 1, sz: 1, h: [[5, 0.2, 0.3], [10, 0.03, 0]], n: 60 }),
  theme: { skyTop: '#3777d6', skyBot: '#ffd9a8', fog: '#ffe2bd', fogFar: 720, ground: '#9be37a', ground2: '#e9e0ff', road: '#6e7092', roadAlt: '#777a9c', curb: ['#ffd23f', '#ffffff'], wall: ['#7c3aed', '#ffffff'], cliff: '#c8b6e8', sun: '#fff0c0', weather: 'petals', clouds: true, water: '#ffeccc', mud: '#b9a0e8', ramp: ['#ffd23f', '#7c3aed'] },
  props: [{ kind: 'cloudtree', count: 120 }, { kind: 'tower', count: 22 }, { kind: 'crystalgold', count: 40 }, { kind: 'bush', count: 60 }, { kind: 'flower', count: 80 }, { kind: 'banner', count: 30 }],
  landmarks: ['castle', 'arch'],
  music: { root: 65, scale: 'major', bpm: 150, seed: 127 },
  auto: { seed: 12, boosts: 5, ramps: 3, rampH: 2.6, glide: true, zones: [{ type: 2, count: 2, lenT: 0.04 }, { type: 3, count: 1, lenT: 0.04 }], movers: [{ kind: 'crystal', count: 2, amp: 5.5, speed: 2 }, { kind: 'rock', count: 3, amp: 5.5, speed: 2.2 }], scT: 0.5 },
  shortcut: { name: 'Royal Bridge', note: 'A jump and two swinging boulders on the king\'s bridge.', surface: 'road', half: 5, angle: 24, pad: 'ramp', moverKinds: ['rock', 'rock'] },
});

export const TRACKS = Object.fromEntries(TRACK_LIST.map((t) => [t.id, t]));
export const trackIndex = (id) => TRACK_LIST.findIndex((t) => t.id === id);
