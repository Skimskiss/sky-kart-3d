// Small helpers for building low-poly geometry with vertex colours (no textures, so everything shares one cheap material).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();

// Transform + colour a primitive and return a non-indexed, uv-less copy ready for merging.
export function part(geo, color, pos = [0, 0, 0], scale = [1, 1, 1], rot = [0, 0, 0]) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.deleteAttribute('uv');
  _q.setFromEuler(_e.set(rot[0], rot[1], rot[2]));
  _m.compose(_v.set(pos[0], pos[1], pos[2]), _q, _s.set(scale[0], scale[1], scale[2]));
  g.applyMatrix4(_m);
  const c = new THREE.Color(color), n = g.attributes.position.count, arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}
export const merge = (list) => { const g = mergeGeometries(list); list.forEach((x) => x.dispose()); return g; };

export const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
export const Cyl = (rt, rb, h, s = 8) => new THREE.CylinderGeometry(rt, rb, h, s);
export const Cone = (r, h, s = 7) => new THREE.ConeGeometry(r, h, s);
export const Ico = (r, d = 0) => new THREE.IcosahedronGeometry(r, d);
export const Sph = (r, a = 10, b = 8) => new THREE.SphereGeometry(r, a, b);
export const Dome = (r, a = 10, b = 6) => new THREE.SphereGeometry(r, a, b, 0, Math.PI * 2, 0, Math.PI / 2);
export const Oct = (r = 1) => new THREE.OctahedronGeometry(r, 0);
export const Dod = (r = 1) => new THREE.DodecahedronGeometry(r, 0);
export const Tor = (r, t, a = 5, b = 12, arc = Math.PI * 2) => new THREE.TorusGeometry(r, t, a, b, arc);

export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;

// Geometry from a flat list of coloured triangles / quads (used for ribbons and ground).
export function bufferFrom(pos, col) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}
