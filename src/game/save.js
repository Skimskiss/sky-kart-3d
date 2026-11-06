// Save data: one JSON blob in localStorage. sanitize() accepts ANY value (corrupt, old, hand-edited) and returns a valid save.
import { KARTS, PAINTS, DRIVERS, WINGS, STAT_KEYS, MAX_UPGRADE } from './karts.js';
import { TRACK_LIST } from './tracks.js';

export const SAVE_KEY = 'skykart3d.save.v1';
export const defaultSettings = { quality: 'auto', master: 0.8, music: 0.6, sfx: 0.9, muted: false, autoGas: true, haptics: true, showFps: false, sensitivity: 1 };

export function defaultSave() {
  return {
    v: 1, coins: 0, unlocked: 1,
    tracks: {},
    claimed: {},
    totals: { coins: 0, driftSec: 0, pads: 0, wins: 0, races: 0, ramps: 0, shortcuts: 0, minis: 0, boostSec: 0, fastest: null },
    garage: { owned: ['comet'], kart: 'comet', paints: {}, ownedPaints: PAINTS.filter((p) => p.price === 0).map((p) => p.id), upgrades: {}, driver: 'ace', ownedDrivers: ['ace'], wing: 'classic', ownedWings: ['classic'] },
    settings: { ...defaultSettings },
  };
}

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const num = (v, d, lo = 0, hi = 1e9) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
const pickIds = (arr, valid, fallback) => {
  const out = Array.isArray(arr) ? [...new Set(arr.filter((x) => valid.includes(x)))] : [];
  for (const f of fallback) if (!out.includes(f)) out.push(f);
  return out;
};

export function sanitize(raw) {
  const d = defaultSave();
  if (!isObj(raw)) return d;
  const s = d;
  s.coins = Math.floor(num(raw.coins, 0));
  s.unlocked = Math.floor(num(raw.unlocked, 1, 1, TRACK_LIST.length));
  if (isObj(raw.tracks)) {
    for (const t of TRACK_LIST) {
      const r = raw.tracks[t.id];
      if (!isObj(r)) continue;
      s.tracks[t.id] = {
        stars: Math.floor(num(r.stars, 0, 0, 3)),
        best: typeof r.best === 'number' && r.best > 0 && Number.isFinite(r.best) ? r.best : null,
        bestLap: typeof r.bestLap === 'number' && r.bestLap > 0 && Number.isFinite(r.bestLap) ? r.bestLap : null,
        tasks: [0, 1, 2].map((i) => !!(Array.isArray(r.tasks) && r.tasks[i] === true)),
        finished: r.finished === true,
      };
    }
  }
  // a track can only be finished if it is unlocked: keep the unlock count consistent with finished tracks
  TRACK_LIST.forEach((t, i) => { if (s.tracks[t.id] && s.tracks[t.id].finished) s.unlocked = Math.max(s.unlocked, Math.min(TRACK_LIST.length, i + 2)); });
  if (isObj(raw.claimed)) for (const [k, v] of Object.entries(raw.claimed)) if (v === true && /^[a-z0-9_]{1,40}$/.test(k)) s.claimed[k] = true;
  if (isObj(raw.totals)) {
    for (const k of Object.keys(s.totals)) if (k !== 'fastest') s.totals[k] = num(raw.totals[k], 0);
    s.totals.fastest = typeof raw.totals.fastest === 'number' && raw.totals.fastest > 0 ? raw.totals.fastest : null;
  }
  if (isObj(raw.garage)) {
    const g = raw.garage, o = s.garage;
    o.owned = pickIds(g.owned, KARTS.map((k) => k.id), ['comet']);
    o.kart = o.owned.includes(g.kart) ? g.kart : 'comet';
    o.ownedPaints = pickIds(g.ownedPaints, PAINTS.map((p) => p.id), o.ownedPaints);
    o.ownedDrivers = pickIds(g.ownedDrivers, DRIVERS.map((p) => p.id), ['ace']);
    o.ownedWings = pickIds(g.ownedWings, WINGS.map((p) => p.id), ['classic']);
    o.driver = o.ownedDrivers.includes(g.driver) ? g.driver : 'ace';
    o.wing = o.ownedWings.includes(g.wing) ? g.wing : 'classic';
    if (isObj(g.paints)) for (const k of o.owned) if (o.ownedPaints.includes(g.paints[k])) o.paints[k] = g.paints[k];
    if (isObj(g.upgrades)) for (const k of o.owned) if (isObj(g.upgrades[k])) { o.upgrades[k] = {}; for (const st of STAT_KEYS) o.upgrades[k][st] = Math.floor(num(g.upgrades[k][st], 0, 0, MAX_UPGRADE)); }
  }
  if (isObj(raw.settings)) {
    const r = raw.settings, o = s.settings;
    if (['auto', 'low', 'medium', 'high'].includes(r.quality)) o.quality = r.quality;
    for (const k of ['master', 'music', 'sfx']) o[k] = num(r[k], o[k], 0, 1);
    o.sensitivity = num(r.sensitivity, 1, 0.5, 1.6);
    for (const k of ['muted', 'autoGas', 'haptics', 'showFps']) if (typeof r[k] === 'boolean') o[k] = r[k];
  }
  return s;
}

export function loadSave(storage = globalThis.localStorage) {
  try {
    const txt = storage.getItem(SAVE_KEY);
    if (!txt) return defaultSave();
    let raw;
    try { raw = JSON.parse(txt); } catch {
      try { storage.setItem(SAVE_KEY + '.bad', txt); } catch { /* ignore */ }
      return defaultSave();
    }
    return sanitize(raw);
  } catch { return defaultSave(); }
}

export function persist(save, storage = globalThis.localStorage) {
  try { storage.setItem(SAVE_KEY, JSON.stringify(save)); return true; } catch { return false; }
}
