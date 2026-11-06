// Imperative three.js scene for a race. React only mounts/unmounts it; every frame is driven from update().
import * as THREE from 'three';
import { angDiff } from './trackBuild.js';
import { buildTrackWorld } from './world3d.js';
import { buildKart } from './kartModel.js';
import { part, merge, Cyl, Cone, Sph, Dod, B, Tor, rng, hash, clamp, lerp } from './geo.js';

class Particles {
  constructor(max) {
    this.max = max; this.i = 0;
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max); this.alpha = new Float32Array(max);
    this.vel = new Float32Array(max * 3); this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    this.base = new Float32Array(max); this.grav = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.uniforms = { uPx: { value: 500 } };
    this.mesh = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false,
      vertexShader: 'attribute float size; attribute float alpha; varying vec3 vC; varying float vA; uniform float uPx; void main(){ vC=color; vA=alpha; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=size*uPx/max(0.1,-mv.z); gl_Position=projectionMatrix*mv; }',
      fragmentShader: 'varying vec3 vC; varying float vA; void main(){ float d=length(gl_PointCoord-0.5); if(d>0.5) discard; gl_FragColor=vec4(vC, vA*(1.0-d*1.6)); }',
      vertexColors: true,
    }));
    this.mesh.frustumCulled = false;
  }
  emit(x, y, z, vx, vy, vz, r, g, b, size, life, grav = 0) {
    const k = this.i; this.i = (this.i + 1) % this.max;
    this.pos[k * 3] = x; this.pos[k * 3 + 1] = y; this.pos[k * 3 + 2] = z;
    this.vel[k * 3] = vx; this.vel[k * 3 + 1] = vy; this.vel[k * 3 + 2] = vz;
    this.col[k * 3] = r; this.col[k * 3 + 1] = g; this.col[k * 3 + 2] = b;
    this.base[k] = size; this.size[k] = size; this.life[k] = life; this.maxLife[k] = life; this.alpha[k] = 1; this.grav[k] = grav;
  }
  update(dt) {
    for (let k = 0; k < this.max; k++) {
      if (this.life[k] <= 0) { this.alpha[k] = 0; continue; }
      this.life[k] -= dt;
      const f = Math.max(0, this.life[k] / this.maxLife[k]);
      this.pos[k * 3] += this.vel[k * 3] * dt; this.pos[k * 3 + 1] += this.vel[k * 3 + 1] * dt; this.pos[k * 3 + 2] += this.vel[k * 3 + 2] * dt;
      this.vel[k * 3 + 1] -= this.grav[k] * dt;
      this.alpha[k] = f; this.size[k] = this.base[k] * (0.6 + 0.8 * (1 - f));
    }
    const a = this.mesh.geometry.attributes;
    a.position.needsUpdate = a.color.needsUpdate = a.size.needsUpdate = a.alpha.needsUpdate = true;
  }
}

const SPARK = [[1, 0.9, 0.5], [0.35, 0.7, 1], [1, 0.6, 0.15], [0.8, 0.3, 1]];
const WEATHER = {
  snow: { c: '#ffffff', size: 0.4, v: [0.6, -4, 0.3] }, embers: { c: '#ff8a1f', size: 0.4, v: [0.5, 3, 0.2] },
  leaves: { c: '#f2792b', size: 0.5, v: [2.2, -2.2, 1.2] }, petals: { c: '#ffc2e0', size: 0.35, v: [2.2, -1.6, 1.2] },
  fireflies: { c: '#e8ff7a', size: 0.35, v: [0.3, 0.2, 0.3] }, dust: { c: '#e8cf9a', size: 0.35, v: [4, 0.1, 1.5] },
  rain: { c: '#bcd4ff', size: 0.22, v: [1.5, -30, 0.5] }, sparkle: { c: '#d9fbff', size: 0.35, v: [0.2, -0.6, 0.2] },
};

export function createVisuals(world, { quality, scene, onlyPreview = false }) {
  const tr = world.track, th = tr.def.theme;
  const root = new THREE.Group();
  const shadows = quality !== 'low';

  scene.background = new THREE.Color(th.skyBot);
  scene.fog = new THREE.Fog(th.fog, 60, th.fogFar * (quality === 'low' ? 0.85 : 1));

  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(th.skyTop) }, bot: { value: new THREE.Color(th.skyBot) } },
    vertexShader: 'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bot; varying vec3 vP; void main(){ float h = normalize(vP).y; float t = clamp(h * 1.6 + 0.12, 0.0, 1.0); gl_FragColor = vec4(mix(bot, top, pow(t, 0.7)), 1.0);\n#include <colorspace_fragment>\n}',
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1400, 16, 10), skyMat);
  sky.renderOrder = -10; sky.frustumCulled = false; root.add(sky);
  const sun = new THREE.Mesh(new THREE.CircleGeometry(th.stars ? 60 : 95, 24), new THREE.MeshBasicMaterial({ color: th.sun, fog: false, depthWrite: false }));
  sun.renderOrder = -9; root.add(sun);
  const sunDir = new THREE.Vector3(0.45, 0.4, -0.8).normalize();

  let stars = null;
  if (th.stars) {
    const n = 600, p = new Float32Array(n * 3), r = rng(5);
    for (let i = 0; i < n; i++) { const a = r() * 6.283, e = Math.acos(1 - r() * 0.95); p[i * 3] = Math.sin(e) * Math.cos(a) * 1300; p[i * 3 + 1] = Math.cos(e) * 1300; p[i * 3 + 2] = Math.sin(e) * Math.sin(a) * 1300; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    stars = new THREE.Points(g, new THREE.PointsMaterial({ color: '#ffffff', size: 3, sizeAttenuation: false, fog: false, depthWrite: false }));
    stars.frustumCulled = false; stars.renderOrder = -9; root.add(stars);
  }
  if (th.earth) { // big planet in the sky (lunar track)
    const e = new THREE.Mesh(new THREE.SphereGeometry(120, 20, 14), new THREE.MeshBasicMaterial({ color: '#3b82f6', fog: false }));
    e.position.set(-500, 380, -900); e.renderOrder = -9; root.add(e); e.userData.sky = true; root.userData.earth = e;
  }

  let clouds = null;
  if (th.clouds) {
    const r = rng(hash(tr.id) + 3);
    const geo = merge([part(Sph(24, 8, 6), '#ffffff', [0, 0, 0], [1.6, 0.55, 1]), part(Sph(18, 8, 6), '#ffffff', [28, -3, 4], [1.4, 0.5, 1]), part(Sph(16, 8, 6), '#f1f7ff', [-26, -4, -3], [1.4, 0.5, 1])]);
    const n = 26;
    clouds = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, transparent: true, opacity: 0.93 }), n);
    const d = new THREE.Object3D();
    for (let i = 0; i < n; i++) { const a = r() * 6.283, dist = 260 + r() * 700; d.position.set(Math.cos(a) * dist, (i < 12 ? -60 : 100) - (i < 12 ? r() * 30 : -r() * 90), Math.sin(a) * dist); d.rotation.y = r() * 6; d.scale.setScalar(0.8 + r() * 1.3); d.updateMatrix(); clouds.setMatrixAt(i, d.matrix); }
    clouds.frustumCulled = false; root.add(clouds);
  }

  const hemi = new THREE.HemisphereLight(new THREE.Color(th.skyTop).lerp(new THREE.Color('#ffffff'), 0.55), new THREE.Color(th.ground).lerp(new THREE.Color('#ffffff'), 0.2), th.stars ? 1.0 : 0.95);
  root.add(hemi);
  const sunLight = new THREE.DirectionalLight(th.stars ? '#c7d2fe' : '#fff6e0', th.stars ? 0.9 : 1.2);
  sunLight.position.set(60, 90, 40);
  if (shadows) {
    sunLight.castShadow = true;
    const ms = quality === 'high' ? 2048 : 1024;
    sunLight.shadow.mapSize.set(ms, ms);
    const c = sunLight.shadow.camera; c.left = c.bottom = -42; c.right = c.top = 42; c.near = 5; c.far = 260;
    sunLight.shadow.bias = -0.0008;
  }
  root.add(sunLight, sunLight.target);

  const built = buildTrackWorld(tr, quality);
  root.add(built.group);

  // aurora curtains
  let aurora = null;
  if (th.aurora) {
    const pos = [], cl = [];
    const bands = [[0, 0.25, 1], [1, 0.9, 0.5], [0.4, 0.5, 1]];
    for (let b = 0; b < 3; b++) {
      const R = 520 + b * 70, a0 = b * 2.1;
      for (let s = 0; s < 24; s++) {
        const aa = a0 + s * 0.09, ab = a0 + (s + 1) * 0.09;
        const y0 = 130 + Math.sin(s * 0.7 + b) * 20, y1 = y0 + 150;
        const P = (a, y) => [Math.cos(a) * R, y, Math.sin(a) * R];
        const c0 = bands[b], bot = [c0[0] * 0.2, c0[1], c0[2] * 0.6];
        for (const [p, c] of [[P(aa, y0), bot], [P(ab, y0), bot], [P(aa, y1), [0, 0, 0]], [P(ab, y0), bot], [P(ab, y1), [0, 0, 0]], [P(aa, y1), [0, 0, 0]]]) { pos.push(...p); cl.push(...c); }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
    aurora = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide }));
    aurora.frustumCulled = false; root.add(aurora);
  }
  // backdrop volcano glow / lightning flash plane
  let flash = 0, nextFlash = 3 + Math.random() * 4, bolt = null;
  if (th.lightning) {
    bolt = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 9 }, (_, i) => new THREE.Vector3((Math.random() - 0.5) * 30, 300 - i * 34, 0))), new THREE.LineBasicMaterial({ color: '#f4f8ff', fog: false }));
    bolt.visible = false; bolt.frustumCulled = false; root.add(bolt);
  }

  // coins: one instanced mesh, spun on the CPU
  const coinGeo = merge([part(Cyl(0.95, 0.95, 0.18, 14), '#f5b301', [0, 0, 0], [1, 1, 1], [Math.PI / 2, 0, 0]), part(Cyl(0.7, 0.7, 0.22, 12), '#ffd84a', [0, 0, 0], [1, 1, 1], [Math.PI / 2, 0, 0]), part(Oct0(), '#fff2a6', [0, 0, 0.12], [0.38, 0.38, 0.1])]);
  const nCoin = world.coins.length;
  const coinMesh = new THREE.InstancedMesh(coinGeo, new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#6b4a00' }), Math.max(1, nCoin));
  coinMesh.frustumCulled = false; root.add(coinMesh);

  // movers
  const moverMeshes = world.movers.map((m) => {
    const kind = m.kind || 'rock';
    const geo = kind === 'barrel' ? merge([part(Cyl(1.0, 1.0, 1.9, 10), '#f97316', [0, 0.95, 0]), part(Cyl(1.04, 1.04, 0.3, 10), '#ffffff', [0, 0.95, 0]), part(Cyl(1.04, 1.04, 0.2, 10), '#7c2d12', [0, 1.7, 0])])
      : kind === 'cone' ? merge([part(Cone(0.9, 2.2, 8), '#ff6a00', [0, 1.1, 0]), part(B(2, 0.2, 2), '#222', [0, 0.1, 0]), part(Cyl(0.55, 0.65, 0.3, 8), '#ffffff', [0, 0.9, 0])])
      : kind === 'snowball' ? merge([part(Sph(1.5, 10, 8), '#f4faff', [0, 1.5, 0]), part(Sph(0.5, 6, 5), '#cfe6f5', [0.9, 2.2, 0.4])])
      : kind === 'log' ? merge([part(Cyl(0.9, 0.9, 3.6, 9), '#8a5a2b', [0, 0.9, 0], [1, 1, 1], [0, 0, 1.57]), part(Cyl(0.75, 0.75, 0.2, 9), '#c99a62', [1.8, 0.9, 0], [1, 1, 1], [0, 0, 1.57])])
      : kind === 'crystal' ? merge([part(new THREE.OctahedronGeometry(1.4, 0), '#7fd0f5', [0, 1.6, 0], [0.9, 1.4, 0.9]), part(new THREE.OctahedronGeometry(0.8, 0), '#d4f6ff', [0.9, 0.9, 0.3])])
      : merge([part(Dod(1.5), '#8a8a96', [0, 1.3, 0]), part(Dod(0.8), '#a9a9b5', [0.9, 2.0, 0.3])]);
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })); mesh.castShadow = shadows; root.add(mesh); return mesh;
  });

  // karts
  const kartViews = world.karts.map((k) => { const v = buildKart(k.look); v.blob.visible = !shadows; root.add(v.root); return v; });
  const particles = new Particles(quality === 'low' ? 160 : quality === 'medium' ? 320 : 520);
  root.add(particles.mesh);

  // weather around the camera
  const wdef = WEATHER[th.weather];
  const WN = quality === 'low' ? 90 : 220;
  const wPos = new Float32Array(WN * 3), wr = rng(77);
  for (let i = 0; i < WN; i++) { wPos[i * 3] = (wr() - 0.5) * 120; wPos[i * 3 + 1] = wr() * 40; wPos[i * 3 + 2] = (wr() - 0.5) * 120; }
  const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.BufferAttribute(wPos, 3));
  const weather = wdef ? new THREE.Points(wg, new THREE.PointsMaterial({ color: wdef.c, size: wdef.size, transparent: true, opacity: 0.85, depthWrite: false })) : null;
  if (weather) { weather.frustumCulled = false; root.add(weather); }

  const cam = { h: world.karts[0].h, x: 0, y: 3, z: 0, fov: 62, init: false, placed: false };
  const Cc = new THREE.Color();
  const dum = new THREE.Object3D();

  function emitFx(k) {
    const f = Math.sin(k.h), g2 = Math.cos(k.h), rx = -g2, rz = f;
    if (k.driftDir !== 0 && k.y < 0.3) {
      const c = SPARK[k.driftLevel], side = -k.driftDir;
      for (let n = 0; n < 2; n++) particles.emit(k.x - f * 1.4 + rx * side * 1.0, 0.25, k.z - g2 * 1.4 + rz * side * 1.0, rx * side * (2 + Math.random() * 3) + (Math.random() - 0.5) * 2, 2 + Math.random() * 3, rz * side * (2 + Math.random() * 3) + (Math.random() - 0.5) * 2, c[0], c[1], c[2], 0.55, 0.35 + Math.random() * 0.2, 14);
    }
    if (k.boosting || k.boostT > 0) for (let n = 0; n < 2; n++) particles.emit(k.x - f * 2.4 + (Math.random() - 0.5) * 0.8, 0.7 + Math.random() * 0.2, k.z - g2 * 2.4 + (Math.random() - 0.5) * 0.8, -f * 6 + (Math.random() - 0.5), 0.5, -g2 * 6 + (Math.random() - 0.5), 0.3, 0.75 + Math.random() * 0.2, 1, 0.9, 0.3);
    const sp = Math.hypot(k.vx, k.vz);
    const off = !k.onRoad || tr.zone[k.idx] === 1;
    if (k.y < 0.2 && sp > 7 && (off || k.driftDir !== 0 || Math.random() < 0.06)) {
      Cc.set(tr.zone[k.idx] === 1 ? '#e8c97a' : off ? th.ground : '#d8d8e8');
      particles.emit(k.x - f * 1.6 + (Math.random() - 0.5) * 1.6, 0.3, k.z - g2 * 1.6 + (Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 2, 0.8 + Math.random(), (Math.random() - 0.5) * 2, Cc.r, Cc.g, Cc.b, off ? 0.6 : 0.5, 0.45, 0);
    }
  }

  let t = 0;
  function update(alpha, dt, state) {
    t += dt;
    const { camera, gl } = state;
    const w = world, pk = w.player || w.karts[0];

    for (let i = 0; i < w.karts.length; i++) {
      const k = w.karts[i], v = kartViews[i];
      const x = lerp(k.px, k.x, alpha), z = lerp(k.pz, k.z, alpha), y = lerp(k.py, k.y, alpha);
      const h = k.ph + angDiff(k.h, k.ph) * alpha;
      v.root.position.set(x, y, z);
      v.root.rotation.y = h;
      v.body.rotation.y = k.spinAngle;
      const lean = -k.steerVis * 0.1 - (k.driftDir ? k.driftDir * 0.16 : 0);
      v.body.rotation.z += (lean - v.body.rotation.z) * Math.min(1, 10 * dt);
      v.body.rotation.x = k.onRamp ? -0.2 : k.vy > 1 ? -0.12 : k.vy < -2 ? 0.1 : 0;
      const sp = Math.hypot(k.vx, k.vz);
      for (const wh of v.wheels) wh.rotation.x += sp * dt / 0.5;
      for (const p of v.pivots) p.rotation.y = -k.steerVis * 0.5;
      for (const f of v.flames) { f.visible = k.boosting || k.boostT > 0; f.scale.setScalar(0.8 + Math.random() * 0.5); }
      v.root.visible = !(k.invT > 0 && Math.floor(t * 12) % 2 === 0);
      v.blob.scale.setScalar(clamp(1 - (y - k.gh) * 0.12, 0.4, 1));
      v.blob.position.y = k.gh + 0.06 - y;
      const near = k === pk || ((k.x - pk.x) ** 2 + (k.z - pk.z) ** 2 < 4900);
      if (near && dt > 0) emitFx(k);
    }

    // coins
    for (let i = 0; i < nCoin; i++) {
      const c = w.coins[i];
      if (c.takenLap === (pk.crossed) && pk.crossed >= 0 && c.takenLap !== -1) dum.scale.setScalar(0.0001);
      else dum.scale.setScalar(1);
      dum.position.set(c.x, c.y + 1.4 + Math.sin(t * 3 + i) * 0.12, c.z);
      dum.rotation.set(0, t * 3 + i * 0.5, 0); dum.updateMatrix();
      coinMesh.setMatrixAt(i, dum.matrix);
    }
    coinMesh.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < w.movers.length; i++) { const m = w.movers[i]; moverMeshes[i].position.set(m.x, 0, m.z); moverMeshes[i].rotation.y = t * 1.5; }

    // camera
    const k = pk;
    const ix = lerp(k.px, k.x, alpha), iz = lerp(k.pz, k.z, alpha), iy = lerp(k.py, k.y, alpha);
    const ih = k.ph + angDiff(k.h, k.ph) * alpha;
    const spd = Math.hypot(k.vx, k.vz), sf = clamp(spd / 40, 0, 1.2), rear = state.rear;
    let th2 = ih;
    if (spd > 6) th2 = ih + angDiff(Math.atan2(k.vx, k.vz), ih) * 0.4;
    if (rear) th2 += Math.PI;
    if (!cam.init) { cam.h = th2; cam.init = true; }
    cam.h += angDiff(th2, cam.h) * (1 - Math.exp(-(rear ? 14 : 5.5) * Math.max(dt, 0.0001)));
    const asp = camera.aspect || 1.5, tall = asp < 1 ? 1 - asp : 0;
    const dist = ((rear ? 6.4 : 8.0) + sf * 1.6) * (1 + tall * 0.6), height = (3.6 + sf * 0.5) * (1 + tall * 0.4) + iy * 0.6;
    const tx = ix - Math.sin(cam.h) * dist, tz = iz - Math.cos(cam.h) * dist;
    const kf = 1 - Math.exp(-14 * Math.max(dt, 0.0001));
    if (!cam.placed) { cam.x = tx; cam.y = height; cam.z = tz; cam.placed = true; }
    cam.x += (tx - cam.x) * kf; cam.y += (height - cam.y) * (1 - Math.exp(-8 * Math.max(dt, 0.0001))); cam.z += (tz - cam.z) * kf;
    const sh = w.shake * 0.5;
    camera.position.set(cam.x + (Math.random() - 0.5) * sh, cam.y + (Math.random() - 0.5) * sh, cam.z + (Math.random() - 0.5) * sh);
    camera.lookAt(ix + Math.sin(cam.h) * 5, iy + 1.5, iz + Math.cos(cam.h) * 5);
    const wantFov = 62 + tall * 22 + sf * 14 + (k.boosting || k.boostT > 0 ? 9 : 0);
    cam.fov += (wantFov - cam.fov) * (1 - Math.exp(-5 * Math.max(dt, 0.0001)));
    if (Math.abs(camera.fov - cam.fov) > 0.05) { camera.fov = cam.fov; camera.updateProjectionMatrix(); }
    const dc = state.debugCam;
    if (scene.fog) scene.fog.far = dc ? 1e5 : th.fogFar * (quality === 'low' ? 0.85 : 1);
    if (dc) { camera.position.set(dc.x, dc.y, dc.z); camera.lookAt(dc.lx, dc.ly, dc.lz); if (dc.fov && Math.abs(camera.fov - dc.fov) > 0.01) { camera.fov = dc.fov; camera.updateProjectionMatrix(); } }

    sky.position.copy(camera.position);
    sun.position.copy(camera.position).addScaledVector(sunDir, 1000); sun.lookAt(camera.position);
    if (stars) stars.position.copy(camera.position);
    if (clouds) clouds.position.set(camera.position.x, 0, camera.position.z);
    if (aurora) { aurora.position.set(camera.position.x, 0, camera.position.z); aurora.rotation.y = t * 0.02; aurora.scale.y = 1 + Math.sin(t * 0.5) * 0.12; }
    if (root.userData.earth) root.userData.earth.position.set(camera.position.x - 500, 380, camera.position.z - 900);
    sunLight.position.set(ix + 55, 85, iz + 35); sunLight.target.position.set(ix, 0, iz);
    if (bolt && dt > 0) {
      nextFlash -= dt;
      if (nextFlash <= 0) { flash = 0.35; nextFlash = 4 + Math.random() * 6; bolt.position.set(camera.position.x + (Math.random() - 0.5) * 500, 0, camera.position.z - 450 + (Math.random() - 0.5) * 200); bolt.visible = true; }
      if (flash > 0) { flash -= dt; hemi.intensity = 0.95 + Math.max(0, flash) * 3; if (flash <= 0) { bolt.visible = false; hemi.intensity = 0.95; } }
    }
    if (weather && dt > 0) {
      const wv = wdef.v;
      for (let i = 0; i < WN; i++) {
        let px = wPos[i * 3] + wv[0] * dt, py = wPos[i * 3 + 1] + wv[1] * dt, pz = wPos[i * 3 + 2] + wv[2] * dt;
        if (th.weather === 'fireflies') { px += Math.sin(t * 1.5 + i) * 0.04; pz += Math.cos(t * 1.2 + i * 2) * 0.04; }
        wPos[i * 3] = px; wPos[i * 3 + 1] = py; wPos[i * 3 + 2] = pz;
        if (py < -2) wPos[i * 3 + 1] = 40; else if (py > 42) wPos[i * 3 + 1] = -1;
        if (px > 60) wPos[i * 3] -= 120; else if (px < -60) wPos[i * 3] += 120;
        if (pz > 60) wPos[i * 3 + 2] -= 120; else if (pz < -60) wPos[i * 3 + 2] += 120;
      }
      wg.attributes.position.needsUpdate = true;
    }
    if (weather) weather.position.set(camera.position.x, 0, camera.position.z);

    particles.uniforms.uPx.value = (gl.domElement.height * 0.5) / Math.tan((camera.fov * Math.PI) / 360);
    particles.update(dt);
  }

  function dispose() {
    root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
    });
  }
  void onlyPreview; void Tor;
  return { root, update, dispose, particles, camState: cam };
}
function Oct0() { return new THREE.OctahedronGeometry(1, 0); }
