// Rules and save-data checks (no browser): invalid saves, stars, unlocking, rewards (no double rewards), missions, purchases, upgrades, equipment.
//   node scripts/check-save.mjs
import assert from 'node:assert/strict';

// a tiny fake localStorage so the real store can run in Node
const mem = new Map();
let broken = false;
globalThis.localStorage = {
  getItem: (k) => { if (broken) throw new Error('blocked'); return mem.has(k) ? mem.get(k) : null; },
  setItem: (k, v) => { if (broken) throw new Error('quota'); mem.set(k, String(v)); },
  removeItem: (k) => mem.delete(k),
};
const { defaultSave, sanitize, loadSave, persist, SAVE_KEY } = await import('../src/game/save.js');
const P = await import('../src/game/progress.js');
const { KARTS, PAINTS, MAX_UPGRADE, upgradeCost, effectiveStats, simStats, kartById } = await import('../src/game/karts.js');
const { TRACK_LIST } = await import('../src/game/tracks.js');

let n = 0;
const ok = (name, fn) => { try { fn(); n++; console.log('  ok  ' + name); } catch (e) { console.log('  FAIL ' + name + '\n       ' + e.message); process.exitCode = 1; } };
const stats0 = { coins: 0, driftSec: 0, boostPads: 0, ramps: 0, shortcuts: 0, miniTurbos: 0, boostSec: 0 };
const me = (pos, time = 120, bestLap = 38) => ({ pos, time, bestLap });
const valid = (s) => {
  assert.ok(Number.isInteger(s.coins) && s.coins >= 0);
  assert.ok(s.unlocked >= 1 && s.unlocked <= TRACK_LIST.length);
  assert.ok(s.garage.owned.includes('comet'));
  assert.ok(s.garage.owned.includes(s.garage.kart));
  for (const [id, t] of Object.entries(s.tracks)) { assert.ok(TRACK_LIST.some((x) => x.id === id)); assert.ok(t.stars >= 0 && t.stars <= 3); }
  for (const k of s.garage.owned) assert.ok(KARTS.some((x) => x.id === k));
  for (const lv of Object.values(s.garage.upgrades)) for (const v of Object.values(lv)) assert.ok(v >= 0 && v <= MAX_UPGRADE);
  assert.ok(s.settings.master >= 0 && s.settings.master <= 1);
};

console.log('Save data');
ok('default save is valid and sanitize() keeps it unchanged', () => { const d = defaultSave(); valid(d); assert.deepEqual(sanitize(JSON.parse(JSON.stringify(d))), d); });
ok('garbage values give a valid default save', () => {
  for (const bad of [null, undefined, 5, 'x', [], true, { coins: 'lots' }, { coins: -50 }, { coins: 1e300 }, { coins: NaN }, { unlocked: 99 }, { unlocked: -3 }, { tracks: 7 }, { tracks: { tropical: { stars: 9 } } }, { tracks: { nope: { stars: 1 } } }, { garage: { owned: ['ghostkart'], kart: 'ghostkart' } }, { garage: { owned: ['comet'], kart: 'skyhawk' } }, { garage: { upgrades: { comet: { spd: 99, acc: -4, hnd: 'x' } } } }, { settings: { master: 7, quality: 'ultra' } }, { claimed: { '../x': true, win1: 'yes' } }]) {
    const s = sanitize(bad); valid(s);
  }
});
ok('specific repairs', () => {
  assert.equal(sanitize({ coins: 12.9 }).coins, 12);
  assert.equal(sanitize({ garage: { owned: ['comet'], kart: 'skyhawk' } }).garage.kart, 'comet');
  assert.equal(sanitize({ garage: { owned: ['comet', 'bulldog'], upgrades: { bulldog: { spd: 99 } } } }).garage.upgrades.bulldog.spd, MAX_UPGRADE);
  assert.equal(sanitize({ tracks: { tropical: { stars: 9, finished: true } } }).tracks.tropical.stars, 3);
  assert.equal(sanitize({ settings: { quality: 'ultra' } }).settings.quality, 'auto');
  assert.equal(sanitize({ claimed: { win1: 'yes' } }).claimed.win1, undefined);
});
ok('finished track keeps the next one unlocked', () => { assert.equal(sanitize({ unlocked: 1, tracks: { tropical: { stars: 1, finished: true, tasks: [true, false, false] } } }).unlocked, 2); });
ok('corrupt JSON in storage: defaults are used and the bad text is kept aside', () => {
  mem.set(SAVE_KEY, '{not json'); const s = loadSave(); valid(s); assert.equal(s.coins, 0); assert.equal(mem.get(SAVE_KEY + '.bad'), '{not json');
});
ok('blocked storage never throws', () => { broken = true; valid(loadSave()); assert.equal(persist(defaultSave()), false); broken = false; });
ok('save -> load round trip', () => { const s = defaultSave(); s.coins = 777; s.garage.owned.push('sprout'); assert.ok(persist(s)); const l = loadSave(); assert.equal(l.coins, 777); assert.ok(l.garage.owned.includes('sprout')); });

console.log('Stars, unlocking, rewards');
ok('stars: finish = 1, top three = 2, win = 3', () => { assert.equal(P.starsFor(4, true), 1); assert.equal(P.starsFor(3, true), 2); assert.equal(P.starsFor(2, true), 2); assert.equal(P.starsFor(1, true), 3); assert.equal(P.starsFor(1, false), 0); });
ok('finishing unlocks the next track (even last place)', () => {
  const r = P.applyRace(defaultSave(), 0, me(4), stats0); assert.equal(r.save.unlocked, 2); assert.equal(r.summary.stars, 1); assert.ok(r.summary.unlockedNext);
});
ok('not finishing gives nothing and unlocks nothing', () => {
  const r = P.applyRace(defaultSave(), 0, { pos: 4, time: null, bestLap: null }, { ...stats0, coins: 5 }); assert.equal(r.save.unlocked, 1); assert.equal(r.summary.stars, 0); assert.equal(r.save.coins, 5);
});
ok('stars only go up and star coins are paid once per star', () => {
  let s = P.applyRace(defaultSave(), 0, me(1), stats0).save; const c1 = s.coins;
  assert.equal(s.tracks.tropical.stars, 3);
  const r2 = P.applyRace(s, 0, me(1), stats0); assert.equal(r2.summary.starCoins, 0); assert.equal(r2.summary.taskCoins, 0); assert.equal(r2.save.coins, c1 + P.PLACE_COINS[0]);
  const r3 = P.applyRace(r2.save, 0, me(4), stats0); assert.equal(r3.save.tracks.tropical.stars, 3);
});
ok('reward breakdown adds up', () => {
  const r = P.applyRace(defaultSave(), 0, me(2, 100), { ...stats0, coins: 30 }); const m = r.summary;
  assert.equal(m.total, m.placeCoins + m.pickupCoins + m.starCoins + m.taskCoins); assert.equal(r.save.coins, m.total);
  assert.deepEqual(m.tasks, [true, true, true]); assert.equal(m.taskCoins, 3 * P.TASK_COINS);
});
ok('best time and best lap only improve', () => {
  let s = P.applyRace(defaultSave(), 0, me(1, 100, 30), stats0).save; s = P.applyRace(s, 0, me(1, 120, 35), stats0).save;
  assert.equal(s.tracks.tropical.best, 100); assert.equal(s.tracks.tropical.bestLap, 30);
});
ok('the last track unlocks nothing further', () => { const s = defaultSave(); s.unlocked = 12; const r = P.applyRace(s, 11, me(1), stats0); assert.equal(r.save.unlocked, 12); });
ok('next-track pointer (Continue Adventure)', () => {
  let s = defaultSave(); assert.equal(P.nextTrackIndex(s), 0);
  s = P.applyRace(s, 0, me(3), stats0).save; assert.equal(P.nextTrackIndex(s), 1);
});

console.log('Missions');
ok('mission cannot be claimed early or twice', () => {
  const s = defaultSave(); assert.equal(P.claimMission(s, 'coins20').ok, false);
  let t = P.applyRace(s, 0, me(1), { ...stats0, coins: 25 }).save; const before = t.coins;
  const a = P.claimMission(t, 'coins20'); assert.ok(a.ok); assert.equal(a.save.coins, before + 100);
  const b = P.claimMission(a.save, 'coins20'); assert.equal(b.ok, false); assert.equal(b.save.coins, a.save.coins);
});
ok('race stats feed the missions (coins, drift, pads, wins, time)', () => {
  const s = P.applyRace(defaultSave(), 0, me(1, 125), { ...stats0, coins: 20, driftSec: 12, boostPads: 3 }).save;
  for (const id of ['coins20', 'drift10', 'pads3', 'win1', 'races1', 'time150']) assert.ok(P.missionDone(s, P.MISSIONS.find((m) => m.id === id)), id);
  assert.ok(!P.missionDone(s, P.MISSIONS.find((m) => m.id === 'time120')));
});
ok('unknown mission id is refused', () => assert.equal(P.claimMission(defaultSave(), 'zzz').ok, false));

console.log('Garage');
const rich = () => { const s = defaultSave(); s.coins = 100000; return s; };
ok('buying a kart costs coins once, equips it, and cannot be repeated', () => {
  const a = P.buyKart(rich(), 'sprout'); assert.ok(a.ok); assert.equal(a.save.coins, 100000 - kartById('sprout').price); assert.equal(a.save.garage.kart, 'sprout');
  assert.equal(P.buyKart(a.save, 'sprout').ok, false);
});
ok('not enough coins is refused and nothing changes', () => { const s = defaultSave(); s.coins = 10; const r = P.buyKart(s, 'skyhawk'); assert.equal(r.ok, false); assert.equal(r.save.coins, 10); assert.ok(!r.save.garage.owned.includes('skyhawk')); });
ok('four or more karts exist and each can be bought', () => { assert.ok(KARTS.length >= 4); let s = rich(); for (const k of KARTS.slice(1)) { const r = P.buyKart(s, k.id); assert.ok(r.ok, k.id); s = r.save; } valid(s); });
ok('equip only works for owned karts', () => { assert.equal(P.equipKart(defaultSave(), 'bulldog').ok, false); const s = P.buyKart(rich(), 'bulldog').save; assert.equal(P.equipKart(P.equipKart(s, 'comet').save, 'bulldog').save.garage.kart, 'bulldog'); });
ok('paints are per kart; free paints work; paid paints cost coins', () => {
  let s = rich(); s = P.buyKart(s, 'sprout').save; s = P.equipKart(s, 'comet').save;
  const free = PAINTS.find((p) => p.price === 0 && p.id !== 'crimson');
  s = P.equipPaint(s, free.id, 'comet').save; assert.equal(s.garage.paints.comet, free.id); assert.equal(s.garage.paints.sprout, undefined);
  const paid = PAINTS.find((p) => p.price > 0); const c = s.coins; const r = P.buyPaint(s, paid.id, 'sprout'); assert.ok(r.ok); assert.equal(r.save.coins, c - paid.price); assert.equal(r.save.garage.paints.sprout, paid.id);
  assert.equal(P.equipPaint(defaultSave(), paid.id).ok, false);
});
ok('upgrades: cost, level cap, and stats really change', () => {
  let s = rich(); const before = effectiveStats(kartById('comet'), P.upgradeLevels(s, 'comet'));
  for (let i = 0; i < MAX_UPGRADE; i++) { const cost = upgradeCost(P.upgradeLevels(s, 'comet').spd); const c = s.coins; const r = P.buyUpgrade(s, 'comet', 'spd'); assert.ok(r.ok); assert.equal(r.save.coins, c - cost); s = r.save; }
  assert.equal(P.buyUpgrade(s, 'comet', 'spd').ok, false);
  const after = effectiveStats(kartById('comet'), P.upgradeLevels(s, 'comet'));
  assert.ok(after.spd > before.spd); assert.ok(simStats(after).maxSpeed > simStats(before).maxSpeed);
  assert.equal(P.buyUpgrade(defaultSave(), 'sprout', 'spd').ok, false); // not owned
});
ok('cosmetics (driver, wings) can be bought and equipped', () => {
  let s = rich(); s = P.buyDriver(s, 'nova').save; assert.equal(s.garage.driver, 'nova'); s = P.buyWing(s, 'twin').save; assert.equal(s.garage.wing, 'twin');
  assert.equal(P.equipDriver(s, 'ace').save.garage.driver, 'ace'); assert.equal(P.equipDriver(s, 'jet').ok, false);
});

console.log('Store (real zustand store, fake storage)');
const { useStore } = await import('../src/store.js');
ok('a locked track cannot be started; an unlocked one can', () => {
  const st = useStore.getState(); st.startRace(5); assert.notEqual(useStore.getState().screen, 'race'); st.startRace(0); assert.equal(useStore.getState().screen, 'race'); assert.equal(useStore.getState().trackIndex, 0);
});
ok('claim and purchase through the store are saved immediately', () => {
  mem.clear(); useStore.setState({ save: { ...defaultSave(), coins: 5000 } });
  useStore.getState().buyKart('sprout'); const saved = JSON.parse(mem.get(SAVE_KEY)); assert.ok(saved.garage.owned.includes('sprout')); assert.equal(saved.coins, 5000 - kartById('sprout').price);
});
console.log(process.exitCode ? '\nSOME CHECKS FAILED' : `\nAll ${n} save / rules checks passed.`);
