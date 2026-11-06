// The kart + driver model, shared by the race scene and the garage preview.
// look = { body, trim, helmet, stripe, wing }. Everything is flat-shaded vertex-coloured geometry; wheels are separate so they can spin.
import * as THREE from 'three';
import { part, merge, B, Cyl, Cone, Sph, Dome, Tor } from './geo.js';

const wheelGeo = Cyl(1, 1, 1, 14).rotateZ(Math.PI / 2);
const flameGeo = Cone(0.26, 1.5, 6).rotateX(-Math.PI / 2);
const skin = '#ffcf9f';
const dark = '#1f2430';
const gold = '#f5b301';

function wingParts(kind, body, trim) {
  const post = (x, y = 1.45) => part(B(0.1, 0.8, 0.12), dark, [x, y, -1.4]);
  switch (kind) {
    case 'twin':
      return [post(-0.65), post(0.65), part(B(2.2, 0.09, 0.6), body, [0, 1.85, -1.5]), part(B(2.0, 0.09, 0.5), trim, [0, 1.55, -1.42]), part(B(0.09, 0.55, 0.7), trim, [-1.1, 1.7, -1.48]), part(B(0.09, 0.55, 0.7), trim, [1.1, 1.7, -1.48])];
    case 'fin':
      return [part(B(0.12, 1.2, 1.2), body, [0, 1.65, -1.35], [1, 1, 1], [0.25, 0, 0]), part(B(1.5, 0.08, 0.5), trim, [0, 1.15, -1.55])];
    case 'none':
      return [part(B(1.6, 0.12, 0.45), body, [0, 1.15, -1.55], [1, 1, 1], [0.15, 0, 0])];
    default: // classic
      return [post(-0.7), post(0.7), part(B(2.3, 0.1, 0.7), body, [0, 1.9, -1.5]), part(B(0.1, 0.5, 0.8), trim, [-1.15, 1.75, -1.5]), part(B(0.1, 0.5, 0.8), trim, [1.15, 1.75, -1.5]), part(B(0.8, 0.06, 0.3), '#ffffff', [0, 1.96, -1.5])];
  }
}

export function buildKart(look, { ghost = false } = {}) {
  const { body = '#e63946', trim = '#1d4ed8', helmet = '#e63946', stripe = '#1d4ed8', wing = 'classic' } = look;
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);
  const matOpts = ghost ? { transparent: true, opacity: 0.4 } : {};
  const mk = (color) => new THREE.MeshLambertMaterial({ color, flatShading: true, ...matOpts });

  const chassis = merge([
    part(B(1.55, 0.42, 2.5), body, [0, 0.62, -0.1]),                       // main tub
    part(B(1.0, 0.34, 1.0), body, [0, 0.55, 1.45], [1, 1, 1], [0.12, 0, 0]),   // nose
    part(B(0.5, 0.3, 0.7), trim, [0, 0.52, 2.0]),                          // nose tip
    part(B(2.1, 0.09, 0.55), trim, [0, 0.3, 2.15]),                        // front wing
    part(B(0.1, 0.22, 0.5), body, [-1.05, 0.38, 2.15]), part(B(0.1, 0.22, 0.5), body, [1.05, 0.38, 2.15]),
    part(B(0.55, 0.5, 1.5), trim, [-0.95, 0.7, -0.2]), part(B(0.55, 0.5, 1.5), trim, [0.95, 0.7, -0.2]), // side pods
    part(B(0.2, 0.06, 1.1), '#ffffff', [0, 0.85, 0.35]),                    // stripe on the hood
    part(B(1.1, 0.75, 0.55), dark, [0, 1.05, -1.0]),                        // engine block
    part(B(0.8, 0.5, 0.45), trim, [0, 0.95, -0.5]),                         // seat back
    part(Cyl(0.16, 0.2, 0.55, 8), gold, [-0.42, 0.78, -1.62], [1, 1, 1], [Math.PI / 2, 0, 0]), part(Cyl(0.16, 0.2, 0.55, 8), gold, [0.42, 0.78, -1.62], [1, 1, 1], [Math.PI / 2, 0, 0]),
    part(Cyl(0.07, 0.07, 0.5, 6), dark, [0, 1.15, 0.45], [1, 1, 1], [0.5, 0, 0]), part(Tor(0.24, 0.05, 5, 10), dark, [0, 1.38, 0.28], [1, 1, 1], [0.5, 0, 0]),
    ...wingParts(wing, body, trim),
  ]);
  const chassisMesh = new THREE.Mesh(chassis, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, ...matOpts }));
  chassisMesh.castShadow = !ghost;
  bodyGroup.add(chassisMesh);

  // driver
  const driver = merge([
    part(B(0.62, 0.62, 0.45), stripe, [0, 1.3, -0.25]),                    // torso
    part(B(0.66, 0.1, 0.47), '#ffffff', [0, 1.34, -0.25]),
    part(B(0.16, 0.5, 0.2), stripe, [-0.42, 1.2, 0.05], [1, 1, 1], [0.9, 0, 0]), part(B(0.16, 0.5, 0.2), stripe, [0.42, 1.2, 0.05], [1, 1, 1], [0.9, 0, 0]),
    part(Sph(0.3, 10, 8), skin, [0, 1.95, -0.2]),                          // head
    part(Sph(0.5, 12, 9), helmet, [0, 2.02, -0.22], [1, 0.95, 1.02]),      // helmet
    part(B(0.2, 0.06, 1.0), stripe, [0, 2.2, -0.22], [1, 1, 1], [0, 0, 0]),
    part(B(0.62, 0.2, 0.2), '#101827', [0, 2.0, 0.22]),                    // visor
    part(B(0.5, 0.05, 0.12), '#7dd3fc', [0, 2.06, 0.31]),
    part(Cone(0.1, 0.18, 4), gold, [0, 2.6, -0.22]), part(Cone(0.08, 0.14, 4), gold, [-0.14, 2.57, -0.22]), part(Cone(0.08, 0.14, 4), gold, [0.14, 2.57, -0.22]), // little crown
  ]);
  const driverMesh = new THREE.Mesh(driver, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, ...matOpts }));
  driverMesh.castShadow = !ghost;
  bodyGroup.add(driverMesh);

  const wheels = [], pivots = [];
  const tire = mk('#1b1d24'), hub = mk(gold);
  [[-1, 1.35, 0.5], [1, 1.35, 0.5], [-1, -1.15, 0.6], [1, -1.15, 0.6]].forEach(([sx, z, r], i) => {
    const pivot = new THREE.Group(); pivot.position.set(sx * 1.0, r, z);
    const w = new THREE.Mesh(wheelGeo, tire); w.scale.set(i < 2 ? 0.4 : 0.52, r, r); w.castShadow = !ghost;
    const h = new THREE.Mesh(wheelGeo, hub); h.scale.set(1.08, 0.5, 0.5);
    w.add(h);
    pivot.add(w); bodyGroup.add(pivot); wheels.push(w);
    if (i < 2) pivots.push(pivot);
  });

  const flames = [];
  if (!ghost) {
    [-0.42, 0.42].forEach((x) => {
      const f = new THREE.Mesh(flameGeo, new THREE.MeshBasicMaterial({ color: '#4cc9ff' }));
      f.position.set(x, 0.78, -2.35); f.visible = false; bodyGroup.add(f); flames.push(f);
    });
  }
  const blob = new THREE.Mesh(new THREE.CircleGeometry(1.7, 14).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.28, depthWrite: false }));
  blob.position.y = 0.06; root.add(blob);
  return { root, body: bodyGroup, wheels, pivots, flames, blob };
}

export const lookFromSave = (kart, paint, driver, wing) => ({ body: paint.body, trim: paint.trim, helmet: driver.helmet, stripe: driver.stripe, wing: wing.id, kartId: kart.id });
void Dome;
