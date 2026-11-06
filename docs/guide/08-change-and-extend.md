# 8. Changing and extending the game

Most changes touch only one or two files. This chapter says which ones, and which check to run afterwards.

## Where to change what

| I want to change... | File | Then run |
|---|---|---|
| A track's shape, colours, weather, scenery, music, tasks | `src/game/tracks.js` | `node scripts/check-tracks.mjs --layout`, `npm run check` |
| How many pads, ramps, hazards a track gets | the `auto` recipe of that track in `tracks.js` | `node scripts/check-tracks.mjs` |
| Kart prices, stats, weights; paints, drivers, wings | `src/game/karts.js` | `node scripts/check-save.mjs` |
| How stats turn into speed, acceleration, steering, boost | `simStats()` in `src/game/karts.js` | `node scripts/check-gameplay.mjs` |
| Upgrade prices or the number of levels | `UPGRADE_COST`, `MAX_UPGRADE` in `karts.js` | `node scripts/check-save.mjs` |
| How strong the rivals are on each track | `rivalStats()`, `rivalDifficulty()` in `karts.js` | `npm run balance` |
| Coins for each place, stars, task coins | `PLACE_COINS`, `STAR_COINS`, `TASK_COINS` in `src/game/progress.js` | `node scripts/check-save.mjs` |
| Missions | `MISSIONS` in `progress.js` | `node scripts/check-save.mjs` |
| Drift, boost, gravity, pad strength | constants at the top of `src/game/sim.js` | `node scripts/check-gameplay.mjs` |
| How the AI drives | `src/game/ai.js` | `npm run check`, `npm run balance` |
| Keys and gamepad buttons | `src/game/input.js` | try it in the browser |
| Touch button sizes and places | `src/styles.css` (`.tbtn`, `.btns`, `.joy`) | `node scripts/screens.mjs` at phone sizes |
| Colours and look of the menus | `src/styles.css` | `node scripts/screens.mjs` |
| Sounds and music | `src/game/audio.js` | listen in the browser |
| What a quality level does | `src/game/visuals.js`, `src/game/world3d.js`, `src/store.js` (`detectTier`) | `node scripts/perf-report.mjs` |

After any change: `npm run check`, `npm run build`, and if a screen changed, `npm run test:browser`.

## How to add a new track

1. Copy one track block in `src/game/tracks.js` and give it a new `id` and `name`.
2. Change `pts`, the curve points (in metres, going around the loop). The start line is at the first point, and the road must be straight from about 60 m before it to 50 m after it (the check tells you if it is not). Use `scale` to make the whole track bigger or smaller.
3. Set the `theme` (colours and `weather`), `props` (scenery models from `props.js`), `landmarks`, `music` and `tasks`.
4. Set the recipe in `auto`: number of boost pads and ramps, zones (sand 1, water / mud 2, ice 3), moving obstacles, and `scT`, roughly where on the lap (0 to 1) the shortcut should be. Give the shortcut a `name`, `note` and `surface`.
5. Run `node scripts/check-tracks.mjs --layout` and open `scripts/out/layout.html`. Fix any reported problem (usually: points too close together, or a corner too tight).
6. Run `npm run check`: the new track must also pass the AI race and the shortcut test.
7. `npm run build`, then `npm run previews` and `npm run build` again for its map picture.

The map, the save, the stars and the missions pick up the new track by themselves. The number of tracks is `TRACK_LIST.length` everywhere.

## How to add a new kart

1. Add an entry to `KARTS` in `src/game/karts.js`: `id`, `name`, `price`, `weight` (1 to 5), `base` stats (1 to 10), a default `paint` and a short `blurb`.
2. Run `node scripts/check-save.mjs`: the "every kart can be bought" check covers it.

The garage shows it, the save accepts it and the race uses its stats with no other change.

## How to add a new mission

Add an entry to `MISSIONS` in `src/game/progress.js`: an `id`, the `text`, the `stat` it counts (`coins`, `driftSec`, `pads`, `boostSec`, `ramps`, `shortcuts`, `races`, `wins`, `fastest` or `stars`), a `target` and a `reward`. To count something new, add it to `totals` in `save.js` and fill it in `applyRace()`.

## How to add a new screen

1. Make `src/ui/MyScreen.jsx` using `Shell` for the frame.
2. In `src/App.jsx`, show it when `screen === 'myscreen'`.
3. Open it from a button with `useStore.getState().go('myscreen')`, or add it to the bottom bar in `Shell.jsx`.

## Known limits

* The ground is flat; only ramps have height. Islands, waterfalls and clouds are scenery.
* Walls are solid and gentle: you cannot fall off an island.
* Paint, drivers and wings only change the look.
* Missions count totals over all races; they do not reset daily.
* The AI cannot drift, does not collect coins, and does not aim for ramps.
* There are no items (shells, shields), no time trial, no multiplayer.
* In a private window or with storage blocked, the game works but progress is lost when the page closes (a warning is shown).

## Ideas for later

* Time trial with a ghost kart; more racers; split screen on one PC.
* Items on the road (shells, shields, bananas).
* Medals per track and online leaderboards (would need a server).
* Hand-made 3D models and textures instead of code-made ones.
* Testing on real phones (first priority), then tuning the touch buttons and the difficulty with real players.
