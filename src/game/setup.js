// Builds the racers of a race (the player from the save's garage, three rivals from the track number). Shared by the game and the Node tests.
import { kartById, paintById, driverById, wingById, effectiveStats, simStats, rivalsFor, rivalStats, rivalDifficulty } from './karts.js';
import { buildTrack } from './trackBuild.js';
import { createWorld } from './sim.js';
import { TRACK_LIST } from './tracks.js';

export function playerRacer(save, slot = 3) {
  const g = save.garage, kart = kartById(g.kart);
  const paint = paintById(g.paints[kart.id] || kart.paint), driver = driverById(g.driver), wing = wingById(g.wing);
  const stats = effectiveStats(kart, g.upgrades[kart.id] || {});
  return { id: 'player', name: 'You', isPlayer: true, slot, stats: simStats(stats, kart.weight), shown: stats, look: { body: paint.body, trim: paint.trim, helmet: driver.helmet, stripe: driver.stripe, wing: wing.id, kartId: kart.id } };
}

export function rivalRacers(trackIndex) {
  const slots = [0, 1, 2];
  return rivalsFor(trackIndex).map((r, i) => ({
    id: r.id, name: r.name, isPlayer: false, slot: slots[i],
    stats: simStats(rivalStats(trackIndex, i), r.weight),
    skill: 0.96 + ((i * 7 + trackIndex * 3) % 5) * 0.012,
    look: { body: r.body, trim: r.trim, helmet: r.driver, stripe: r.trim, wing: r.wing },
  }));
}

export function makeRaceWorld(save, trackIndex, laps = 3) {
  const def = TRACK_LIST[trackIndex];
  const track = buildTrack(def);
  const racers = [...rivalRacers(trackIndex), playerRacer(save)];
  return createWorld({ track, racers, laps, difficulty: rivalDifficulty(trackIndex) });
}
