// Game rules that change the save: race rewards, stars, unlocking, missions, shop. Pure functions (no DOM) so Node tests can check them.
// Every function returns a NEW save plus ok/reason; callers persist the result.
import { TRACK_LIST } from './tracks.js';
import { KARTS, PAINTS, DRIVERS, WINGS, upgradeCost, STAT_KEYS } from './karts.js';

export const PLACE_COINS = [150, 100, 60, 30];
export const STAR_COINS = 100;
export const TASK_COINS = 50;

export const clone = (s) => JSON.parse(JSON.stringify(s));
export const totalStars = (s) => Object.values(s.tracks).reduce((a, t) => a + (t.stars || 0), 0);
export const trackUnlocked = (s, i) => i < s.unlocked;
// first unlocked track that is not finished, else the last unlocked one
export const nextTrackIndex = (s) => {
  for (let i = 0; i < Math.min(s.unlocked, TRACK_LIST.length); i++) if (!(s.tracks[TRACK_LIST[i].id] || {}).finished) return i;
  return Math.min(s.unlocked, TRACK_LIST.length) - 1;
};

export function starsFor(pos, finished) { return !finished ? 0 : pos === 1 ? 3 : pos <= 3 ? 2 : 1; }

export const MISSIONS = [
  { id: 'coins20', text: 'Collect 20 coins', stat: 'coins', target: 20, reward: 100 },
  { id: 'coins150', text: 'Collect 150 coins', stat: 'coins', target: 150, reward: 250 },
  { id: 'coins600', text: 'Collect 600 coins', stat: 'coins', target: 600, reward: 600 },
  { id: 'drift10', text: 'Drift for 10 seconds', stat: 'driftSec', target: 10, reward: 100 },
  { id: 'drift60', text: 'Drift for 60 seconds', stat: 'driftSec', target: 60, reward: 250 },
  { id: 'drift300', text: 'Drift for 5 minutes', stat: 'driftSec', target: 300, reward: 600 },
  { id: 'pads3', text: 'Use 3 boost pads', stat: 'pads', target: 3, reward: 150 },
  { id: 'pads30', text: 'Use 30 boost pads', stat: 'pads', target: 30, reward: 350 },
  { id: 'boost20', text: 'Boost for 20 seconds', stat: 'boostSec', target: 20, reward: 200 },
  { id: 'ramps5', text: 'Jump off 5 ramps', stat: 'ramps', target: 5, reward: 150 },
  { id: 'short5', text: 'Take 5 shortcuts', stat: 'shortcuts', target: 5, reward: 250 },
  { id: 'races1', text: 'Finish a race', stat: 'races', target: 1, reward: 100 },
  { id: 'races10', text: 'Finish 10 races', stat: 'races', target: 10, reward: 400 },
  { id: 'win1', text: 'Win a race', stat: 'wins', target: 1, reward: 200 },
  { id: 'win5', text: 'Win 5 races', stat: 'wins', target: 5, reward: 500 },
  { id: 'win12', text: 'Win 12 races', stat: 'wins', target: 12, reward: 1200 },
  { id: 'time150', text: 'Finish a race in under 2:30', stat: 'fastest', target: 150, reward: 300 },
  { id: 'time120', text: 'Finish a race in under 2:00', stat: 'fastest', target: 120, reward: 600 },
  { id: 'stars12', text: 'Earn 12 stars', stat: 'stars', target: 12, reward: 400 },
  { id: 'stars30', text: 'Earn 30 stars', stat: 'stars', target: 30, reward: 1000 },
];

// current value and target of a mission (time missions show 0/1)
export function missionProgress(s, m) {
  if (m.stat === 'fastest') { const f = s.totals.fastest; return { value: f != null && f < m.target ? 1 : 0, target: 1 }; }
  const v = m.stat === 'stars' ? totalStars(s) : s.totals[m.stat] || 0;
  return { value: Math.min(m.target, Math.floor(v)), target: m.target };
}
export const missionDone = (s, m) => { const p = missionProgress(s, m); return p.value >= p.target; };
export const missionClaimed = (s, m) => s.claimed[m.id] === true;

export function claimMission(s, id) {
  const m = MISSIONS.find((x) => x.id === id);
  if (!m) return { save: s, ok: false, reason: 'unknown mission' };
  if (s.claimed[id]) return { save: s, ok: false, reason: 'already claimed' };
  if (!missionDone(s, m)) return { save: s, ok: false, reason: 'not complete' };
  const n = clone(s);
  n.claimed[id] = true; n.coins += m.reward;
  return { save: n, ok: true, reward: m.reward };
}

// `me` = the player's row of world.results, `stats` = world.stats. Returns { save, summary }.
export function applyRace(s, trackIndex, me, stats) {
  const def = TRACK_LIST[trackIndex];
  const n = clone(s);
  const rec = n.tracks[def.id] || (n.tracks[def.id] = { stars: 0, best: null, bestLap: null, tasks: [false, false, false], finished: false });
  const finished = me.time != null;
  const stars = starsFor(me.pos, finished);
  const sum = { finished, pos: me.pos, time: me.time, stars, newStars: 0, placeCoins: 0, pickupCoins: stats.coins, starCoins: 0, taskCoins: 0, total: 0, newBest: false, unlockedNext: false, tasks: [false, false, false], newTasks: [false, false, false] };
  n.totals.coins += stats.coins; n.totals.driftSec += stats.driftSec; n.totals.pads += stats.boostPads; n.totals.ramps += stats.ramps;
  n.totals.shortcuts += stats.shortcuts; n.totals.minis += stats.miniTurbos; n.totals.boostSec += stats.boostSec;
  if (finished) {
    sum.placeCoins = PLACE_COINS[me.pos - 1] || 0;
    n.totals.races++;
    if (me.pos === 1) n.totals.wins++;
    if (n.totals.fastest == null || me.time < n.totals.fastest) n.totals.fastest = me.time;
    if (rec.best == null || me.time < rec.best) { if (rec.best != null) sum.newBest = true; rec.best = me.time; }
    if (me.bestLap != null && (rec.bestLap == null || me.bestLap < rec.bestLap)) rec.bestLap = me.bestLap;
    if (stars > rec.stars) { sum.newStars = stars - rec.stars; sum.starCoins = sum.newStars * STAR_COINS; rec.stars = stars; }
    rec.finished = true;
    const done = [true, stats.coins >= def.tasks.coins, me.time <= def.tasks.time];
    done.forEach((d, i) => { sum.tasks[i] = d; if (d && !rec.tasks[i]) { rec.tasks[i] = true; sum.newTasks[i] = true; sum.taskCoins += TASK_COINS; } });
    if (trackIndex + 2 > n.unlocked && trackIndex + 1 < TRACK_LIST.length) { n.unlocked = trackIndex + 2; sum.unlockedNext = true; }
  }
  sum.total = sum.placeCoins + sum.pickupCoins + sum.starCoins + sum.taskCoins;
  n.coins += sum.total;
  return { save: n, summary: sum };
}

// ---- garage ----
const canPay = (s, price) => s.coins >= price;
function buyFrom(list, ownedKey, equip) {
  return (s, id) => {
    const item = list.find((x) => x.id === id);
    if (!item) return { save: s, ok: false, reason: 'unknown item' };
    if (s.garage[ownedKey].includes(id)) return { save: s, ok: false, reason: 'already owned' };
    if (!canPay(s, item.price)) return { save: s, ok: false, reason: 'not enough coins' };
    const n = clone(s); n.coins -= item.price; n.garage[ownedKey].push(id); equip(n, id);
    return { save: n, ok: true };
  };
}
export const buyKart = buyFrom(KARTS, 'owned', (n, id) => { n.garage.kart = id; });
export function buyPaint(s, id, kartId = s.garage.kart) {
  const item = PAINTS.find((x) => x.id === id);
  if (!item) return { save: s, ok: false, reason: 'unknown item' };
  if (!s.garage.owned.includes(kartId)) return { save: s, ok: false, reason: 'not owned' };
  if (s.garage.ownedPaints.includes(id)) return { save: s, ok: false, reason: 'already owned' };
  if (!canPay(s, item.price)) return { save: s, ok: false, reason: 'not enough coins' };
  const n = clone(s); n.coins -= item.price; n.garage.ownedPaints.push(id); n.garage.paints[kartId] = id;
  return { save: n, ok: true };
}
export const buyDriver = buyFrom(DRIVERS, 'ownedDrivers', (n, id) => { n.garage.driver = id; });
export const buyWing = buyFrom(WINGS, 'ownedWings', (n, id) => { n.garage.wing = id; });

function equipIn(ownedKey, apply) {
  return (s, id) => {
    if (!s.garage[ownedKey].includes(id)) return { save: s, ok: false, reason: 'not owned' };
    const n = clone(s); apply(n, id); return { save: n, ok: true };
  };
}
export const equipKart = equipIn('owned', (n, id) => { n.garage.kart = id; });
export function equipPaint(s, id, kartId = s.garage.kart) {
  if (!s.garage.ownedPaints.includes(id) || !s.garage.owned.includes(kartId)) return { save: s, ok: false, reason: 'not owned' };
  const n = clone(s); n.garage.paints[kartId] = id; return { save: n, ok: true };
}
export const equipDriver = equipIn('ownedDrivers', (n, id) => { n.garage.driver = id; });
export const equipWing = equipIn('ownedWings', (n, id) => { n.garage.wing = id; });

export const upgradeLevels = (s, kartId) => ({ spd: 0, acc: 0, hnd: 0, bst: 0, ...(s.garage.upgrades[kartId] || {}) });
export function buyUpgrade(s, kartId, stat) {
  if (!s.garage.owned.includes(kartId) || !STAT_KEYS.includes(stat)) return { save: s, ok: false, reason: 'invalid' };
  const lv = upgradeLevels(s, kartId)[stat];
  const cost = upgradeCost(lv);
  if (cost == null) return { save: s, ok: false, reason: 'max level' };
  if (!canPay(s, cost)) return { save: s, ok: false, reason: 'not enough coins' };
  const n = clone(s); n.coins -= cost;
  n.garage.upgrades[kartId] = { ...upgradeLevels(s, kartId), [stat]: lv + 1 };
  return { save: n, ok: true };
}
