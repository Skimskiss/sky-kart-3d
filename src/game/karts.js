// Kart catalogue, paints, cosmetics, upgrades and rival drivers. Pure data + small helpers (also used by the Node tests).
// Stats are on a 1..10 scale; upgrades add to them, and simStats() turns them into the numbers the simulation uses.
export const MAX_UPGRADE = 5;
export const UPGRADE_STEP = 0.6; // stat points per upgrade level (5 levels = +3)
export const UPGRADE_COST = [150, 250, 400, 600, 900]; // cost of level 1..5

export const STAT_KEYS = ['spd', 'acc', 'hnd', 'bst'];
export const STAT_NAMES = { spd: 'Speed', acc: 'Accel', hnd: 'Handling', bst: 'Boost' };
export const UPGRADES = [
  { id: 'spd', name: 'Engine', note: 'Higher top speed' },
  { id: 'acc', name: 'Gearbox', note: 'Faster acceleration' },
  { id: 'hnd', name: 'Tyres', note: 'Sharper steering' },
  { id: 'bst', name: 'Boost tank', note: 'Boost fills faster and hits harder' },
];

export const KARTS = [
  { id: 'comet', name: 'Comet', price: 0, weight: 3, base: { spd: 5, acc: 5, hnd: 5, bst: 5 }, paint: 'crimson', blurb: 'Balanced all-rounder. A great first kart.' },
  { id: 'sprout', name: 'Sprout', price: 700, weight: 2, base: { spd: 4, acc: 7, hnd: 8, bst: 5 }, paint: 'lime', blurb: 'Light and grippy. Loves tight corners.' },
  { id: 'bulldog', name: 'Bulldog', price: 1400, weight: 5, base: { spd: 8, acc: 4, hnd: 4, bst: 5 }, paint: 'solar', blurb: 'Heavy with a huge top speed. Pushes rivals around.' },
  { id: 'stardust', name: 'Stardust', price: 2400, weight: 3, base: { spd: 6, acc: 6, hnd: 6, bst: 9 }, paint: 'violet', blurb: 'Boost specialist. Fills the boost bar very fast.' },
  { id: 'skyhawk', name: 'Skyhawk', price: 4200, weight: 3, base: { spd: 8, acc: 7, hnd: 7, bst: 7 }, paint: 'gold', blurb: 'The champion kart. Strong at everything.' },
];

// body colour + trim colour pairs
export const PAINTS = [
  { id: 'crimson', name: 'Crimson', body: '#e63946', trim: '#1d4ed8', price: 0 },
  { id: 'solar', name: 'Solar', body: '#facc15', trim: '#111827', price: 0 },
  { id: 'lime', name: 'Lime', body: '#22c55e', trim: '#064e3b', price: 0 },
  { id: 'ocean', name: 'Ocean', body: '#0ea5e9', trim: '#f8fafc', price: 150 },
  { id: 'violet', name: 'Violet', body: '#8b5cf6', trim: '#fde047', price: 150 },
  { id: 'sunset', name: 'Sunset', body: '#fb923c', trim: '#be185d', price: 250 },
  { id: 'gold', name: 'Gold', body: '#f5b301', trim: '#7c2d12', price: 400 },
  { id: 'midnight', name: 'Midnight', body: '#1e293b', trim: '#22d3ee', price: 400 },
];

export const DRIVERS = [
  { id: 'ace', name: 'Ace', helmet: '#e63946', stripe: '#1d4ed8', price: 0 },
  { id: 'nova', name: 'Nova', helmet: '#8b5cf6', stripe: '#f0abfc', price: 120 },
  { id: 'kai', name: 'Kai', helmet: '#0ea5e9', stripe: '#fde047', price: 120 },
  { id: 'rio', name: 'Rio', helmet: '#22c55e', stripe: '#f8fafc', price: 200 },
  { id: 'jet', name: 'Jet', helmet: '#111827', stripe: '#f97316', price: 300 },
];

export const WINGS = [
  { id: 'classic', name: 'Classic', price: 0, note: 'Wide single wing' },
  { id: 'twin', name: 'Twin', price: 180, note: 'Two stacked wings' },
  { id: 'fin', name: 'Fin', price: 250, note: 'A tall centre fin' },
  { id: 'none', name: 'Sleek', price: 100, note: 'No wing, clean lines' },
];

export const kartById = (id) => KARTS.find((k) => k.id === id) || KARTS[0];
export const paintById = (id) => PAINTS.find((p) => p.id === id) || PAINTS[0];
export const driverById = (id) => DRIVERS.find((d) => d.id === id) || DRIVERS[0];
export const wingById = (id) => WINGS.find((w) => w.id === id) || WINGS[0];

// stats shown in the garage: base + upgrades, capped at 10
export function effectiveStats(kart, upg = {}) {
  const out = {};
  for (const s of STAT_KEYS) out[s] = Math.min(10, kart.base[s] + (Math.min(MAX_UPGRADE, upg[s] | 0) * UPGRADE_STEP));
  return out;
}

// numbers used by the simulation
export function simStats(stats, weight = 3) {
  return {
    maxSpeed: 30 + stats.spd * 1.0,           // 35 .. 40
    accel: 0.85 + stats.acc * 0.13,           // 1.5 .. 2.2
    steerRate: 1.45 + stats.hnd * 0.085,      // 1.9 .. 2.3
    boostFill: 0.6 + stats.bst * 0.14,        // how quickly drifting / coins fill the boost bar
    boostPower: 1.26 + stats.bst * 0.016,     // top-speed multiplier while boosting
    padTime: 1.0 + stats.bst * 0.07,          // seconds of boost from a pad
    weight,
  };
}

export function upgradeCost(level) { return level >= MAX_UPGRADE ? null : UPGRADE_COST[level]; }

// AI rivals. Their stats rise with the track number so the campaign gets harder.
export const RIVALS = [
  { id: 'rusty', name: 'Rusty', body: '#f97316', trim: '#7c2d12', driver: '#f97316', wing: 'classic', weight: 4 },
  { id: 'mochi', name: 'Mochi', body: '#ec4899', trim: '#fdf2f8', driver: '#ec4899', wing: 'twin', weight: 2 },
  { id: 'gus', name: 'Gus', body: '#22c55e', trim: '#facc15', driver: '#16a34a', wing: 'classic', weight: 3 },
  { id: 'vex', name: 'Vex', body: '#7c3aed', trim: '#22d3ee', driver: '#6d28d9', wing: 'fin', weight: 3 },
  { id: 'piper', name: 'Piper', body: '#06b6d4', trim: '#fef08a', driver: '#0891b2', wing: 'twin', weight: 2 },
  { id: 'brick', name: 'Brick', body: '#b91c1c', trim: '#fde68a', driver: '#7f1d1d', wing: 'classic', weight: 5 },
];

// Three different rivals for each track (deterministic, so a track always has the same opponents).
export function rivalsFor(trackIndex) {
  const out = [];
  for (let i = 0; i < 3; i++) out.push(RIVALS[(trackIndex * 2 + i * 2 + i) % RIVALS.length]);
  return [...new Set(out)].length === 3 ? out : [RIVALS[0], RIVALS[2], RIVALS[4]];
}

// Rival strength by track number (0..11): both a stat level and the driving-skill factor used by the AI.
export function rivalStats(trackIndex, which) {
  const lvl = 3.4 + trackIndex * 0.46 + which * 0.2;
  return { spd: lvl, acc: lvl, hnd: lvl, bst: lvl };
}
export const rivalDifficulty = (trackIndex) => 0.8 + trackIndex * 0.014; // AI target-speed factor
