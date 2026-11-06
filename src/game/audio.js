// Fully synthesised audio: all sounds are rendered to WAV buffers at runtime and played through Howler.
// Nothing is created until the first user gesture (browser autoplay rules), and music is generated per track on demand.
import { Howl, Howler } from 'howler';

const SR = 22050;
let ready = false;
let sfx = {};
let engine = null, driftLoop = null, music = null;
let vols = { master: 0.8, music: 0.6, sfx: 0.9, muted: false };

function wavUrl(samples) {
  const n = samples.length;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, SR, true); v.setUint32(28, SR * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i])) * 32767, true);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

const make = (sec, fn) => {
  const n = Math.floor(sec * SR), out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = fn(i / SR, i, n);
  return out;
};
const env = (t, a, d) => Math.min(1, t / a) * Math.exp(-t / d);
const tri = (p) => 2 * Math.abs(2 * (p - Math.floor(p + 0.5))) - 1;
const saw = (p) => 2 * (p - Math.floor(p + 0.5));
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

let noiseSeed = 1;
const noise = () => { noiseSeed = (noiseSeed * 16807) % 2147483647; return noiseSeed / 1073741823 - 1; };

function buildSfx() {
  const tone = (f, sec, kind = 'sin', vol = 0.5) => make(sec, (t) => {
    const p = f * t;
    const s = kind === 'sin' ? Math.sin(2 * Math.PI * p) : kind === 'tri' ? tri(p) : saw(p) * 0.6;
    return s * env(t, 0.005, sec * 0.45) * vol;
  });
  const arp = (notes, step, kind) => {
    const total = notes.length * step + 0.15;
    return make(total, (t) => {
      let s = 0;
      notes.forEach((n, i) => {
        const tt = t - i * step;
        if (tt > 0) s += Math.sin(2 * Math.PI * midi(n) * tt) * env(tt, 0.004, 0.09) * 0.35 + (kind ? tri(midi(n) * tt) * env(tt, 0.004, 0.07) * 0.2 : 0);
      });
      return s;
    });
  };
  return {
    beep: tone(440, 0.22, 'sin', 0.5),
    go: tone(880, 0.55, 'tri', 0.55),
    coin: arp([88, 95], 0.045, false),
    click: tone(660, 0.07, 'tri', 0.35),
    buy: arp([76, 83, 88, 95], 0.06, true),
    pickup: arp([76, 83, 88], 0.05, true),
    item: make(0.35, (t) => noise() * env(t, 0.01, 0.12) * 0.35 + Math.sin(2 * Math.PI * (300 + 900 * t) * t) * env(t, 0.01, 0.15) * 0.3),
    boost: make(0.7, (t) => saw((120 + 260 * t) * t) * env(t, 0.03, 0.4) * 0.35 + noise() * env(t, 0.02, 0.25) * 0.12),
    mini: arp([72, 79, 84, 91], 0.045, true),
    hit: make(0.6, (t) => noise() * env(t, 0.003, 0.18) * 0.55 + Math.sin(2 * Math.PI * (160 - 120 * t) * t) * env(t, 0.003, 0.25) * 0.5),
    bump: make(0.18, (t) => Math.sin(2 * Math.PI * (110 - 80 * t) * t) * env(t, 0.002, 0.07) * 0.6 + noise() * env(t, 0.001, 0.03) * 0.3),
    jump: make(0.4, (t) => Math.sin(2 * Math.PI * (200 + 500 * t) * t) * env(t, 0.01, 0.2) * 0.4),
    land: make(0.2, (t) => noise() * env(t, 0.002, 0.06) * 0.4 + Math.sin(2 * Math.PI * 70 * t) * env(t, 0.002, 0.1) * 0.5),
    pop: make(0.25, (t) => Math.sin(2 * Math.PI * (900 - 1500 * t) * t) * env(t, 0.002, 0.07) * 0.5),
    lap: arp([79, 83, 86], 0.07, false),
    finish: arp([72, 76, 79, 84, 79, 84, 88], 0.11, true),
  };
}

function buildEngine() {
  // 0.4 s at 110 Hz / 165 Hz = integer number of cycles, so the loop is seamless
  return make(0.4, (t) => {
    let s = 0;
    for (let k = 1; k <= 6; k++) s += Math.sin(2 * Math.PI * 110 * k * t) / (k * 1.1);
    s += Math.sin(2 * Math.PI * 165 * t) * 0.35;
    return s * 0.22;
  });
}

function buildDrift() {
  return make(0.5, () => noise() * 0.18);
}

const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], pent: [0, 2, 4, 7, 9], minorpent: [0, 3, 5, 7, 10] };

function buildMusic(m) {
  const scale = SCALES[m.scale] || SCALES.major;
  const eighth = 60 / m.bpm / 2;
  const steps = 32;
  const total = steps * eighth;
  let seed = m.seed * 9301 + 49297;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const deg = (d) => {
    const oct = Math.floor(d / scale.length);
    return m.root + scale[((d % scale.length) + scale.length) % scale.length] + oct * 12;
  };
  const prog = m.scale === 'major' || m.scale === 'pent' ? [0, 5, 3, 4] : [0, 5, 2, 6];
  const melody = [];
  for (let i = 0; i < steps; i++) melody.push(rnd() < 0.62 ? Math.floor(rnd() * scale.length) + scale.length : -1);
  const buf = new Float32Array(Math.floor(total * SR));
  const addNote = (start, dur, f, kind, vol) => {
    const i0 = Math.floor(start * SR), n = Math.floor(dur * SR);
    for (let i = 0; i < n && i0 + i < buf.length; i++) {
      const t = i / SR, p = f * t;
      const e = Math.min(1, t / 0.006) * Math.max(0, 1 - t / dur);
      buf[i0 + i] += (kind === 'saw' ? saw(p) * 0.5 : kind === 'tri' ? tri(p) : Math.sin(2 * Math.PI * p)) * e * vol;
    }
  };
  for (let s = 0; s < steps; s++) {
    const bar = Math.floor(s / 8);
    const root = deg(prog[bar] % scale.length);
    const t0 = s * eighth;
    if (s % 2 === 0) addNote(t0, eighth * 1.8, midi(root - 24), 'saw', 0.22);          // bass
    if (s % 8 === 0) { addNote(t0, eighth * 7.5, midi(root), 'tri', 0.1); addNote(t0, eighth * 7.5, midi(deg(prog[bar] + 2)), 'tri', 0.08); }
    if (melody[s] >= 0) addNote(t0, eighth * 0.9, midi(deg(melody[s] + prog[bar] % 2)), 'tri', 0.18); // lead
    if (s % 4 === 0) { // kick
      const i0 = Math.floor(t0 * SR);
      for (let i = 0; i < SR * 0.14 && i0 + i < buf.length; i++) {
        const t = i / SR;
        buf[i0 + i] += Math.sin(2 * Math.PI * (120 - 600 * t) * t) * Math.exp(-t / 0.05) * 0.5;
      }
    }
    if (s % 2 === 1) { // hat
      const i0 = Math.floor(t0 * SR);
      for (let i = 0; i < SR * 0.04 && i0 + i < buf.length; i++) buf[i0 + i] += noise() * Math.exp(-(i / SR) / 0.012) * 0.12;
    }
  }
  return buf;
}

const vol = (base, kind) => (vols.muted ? 0 : Math.min(1, base * vols.master * (kind === 'music' ? vols.music : vols.sfx)));

export function initAudio(settings) {
  if (ready) return;
  ready = true;
  vols = { ...vols, ...settings };
  const bank = buildSfx();
  for (const [k, samples] of Object.entries(bank)) sfx[k] = new Howl({ src: [wavUrl(samples)], format: ['wav'], volume: 1 });
  engine = new Howl({ src: [wavUrl(buildEngine())], format: ['wav'], loop: true, volume: 0 });
  driftLoop = new Howl({ src: [wavUrl(buildDrift())], format: ['wav'], loop: true, volume: 0 });
}

export function setAudioSettings(s) {
  vols = { ...vols, ...s };
  Howler.mute(!!vols.muted);
  if (music) music.volume(vol(0.55, 'music'));
}

export function play(name, scale = 1, rate = 1) {
  const s = sfx[name];
  if (!s || vols.muted) return;
  const id = s.play();
  s.volume(vol(0.8 * scale, 'sfx'), id);
  s.rate(rate, id);
}

let engineOn = false, driftOn = false, musicId = null, racePaused = false, menuOn = false;
const musicUrls = {}; // synthesising a loop takes a moment, so keep the result for retries

export function startRaceAudio(m) {
  if (!ready) return;
  stopMenuMusic();
  stopMusic();
  const key = `${m.root}-${m.scale}-${m.bpm}-${m.seed}`;
  if (!musicUrls[key]) musicUrls[key] = wavUrl(buildMusic(m));
  music = new Howl({ src: [musicUrls[key]], format: ['wav'], loop: true, volume: vol(0.55, 'music') });
  musicId = music.play();
  racePaused = false;
  engine.volume(0); engine.play(); engineOn = true;
  driftLoop.volume(0); driftLoop.play(); driftOn = true;
}

// Music for the menus (no engine sounds). Same synthesised loop as a track, with a fixed bright tune.
const MENU_MUSIC = { root: 64, scale: 'major', bpm: 118, seed: 7 };
export function startMenuMusic() {
  if (!ready || menuOn || engineOn) return;
  const key = 'menu';
  if (!musicUrls[key]) musicUrls[key] = wavUrl(buildMusic(MENU_MUSIC));
  stopMusic();
  music = new Howl({ src: [musicUrls[key]], format: ['wav'], loop: true, volume: vol(0.4, 'music') });
  musicId = music.play();
  menuOn = true;
}
export function stopMenuMusic() { if (menuOn) { stopMusic(); menuOn = false; } }

export function updateRaceAudio(speed01, drifting, boosting) {
  if (!ready || !engineOn || racePaused) return;
  // never let a bad number (e.g. NaN from a physics glitch) throw inside the render loop
  if (!Number.isFinite(speed01)) speed01 = 0;
  engine.rate(0.7 + speed01 * 1.6 + (boosting ? 0.25 : 0));
  engine.volume(vol(0.28, 'sfx'));
  driftLoop.volume(drifting ? vol(0.18, 'sfx') : 0);
}

// Silence the engine and pause the music while the pause menu is open.
export function setRacePaused(p) {
  if (!ready || p === racePaused || !engineOn) return;
  racePaused = p;
  if (p) {
    engine.volume(0); driftLoop.volume(0);
    if (music && musicId != null) music.pause(musicId);
  } else if (music && musicId != null) music.play(musicId); // resume the same instance (play() without an id would start a second one)
}

export function stopMusic() {
  if (music) { music.stop(); music.unload(); music = null; musicId = null; }
}

export function stopRaceAudio() {
  stopMusic();
  racePaused = false;
  if (engineOn) { engine.stop(); engineOn = false; }
  if (driftOn) { driftLoop.stop(); driftOn = false; }
}

export const audioReady = () => ready;
