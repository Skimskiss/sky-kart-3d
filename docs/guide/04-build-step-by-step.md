# 4. Building the game step by step

This chapter is the build plan: what to install, how to create the empty project and its folders, and the **order** in which to write the files. The order is the one used for this game, put in a clean sequence. Every phase ends with a check, so you always know the part you just wrote works before you build on it.

## What you need

| Tool | Why | Where |
|---|---|---|
| Node.js 22 or newer (24 was used) | runs Vite, npm and all the test scripts. The game itself only needs Node 18, but the scripts that drive Chrome use the WebSocket built into Node 22. | nodejs.org (LTS) |
| Google Chrome (or Edge) | to play, and for the browser tests, pictures and this PDF | google.com/chrome |
| A code editor | for example Visual Studio Code | code.visualstudio.com |
| Git for Windows (optional) | gives `pdftotext`, used for the page numbers of this PDF | git-scm.com |

## Creating the empty project

The quickest way to get exactly the same libraries as this game is to copy `package.json` into a new folder and run `npm install`. To start from nothing instead:

```bash
npm create vite@5 sky-kart-3d -- --template react
cd sky-kart-3d
npm install three@0.169 @react-three/fiber@8 zustand@4 howler@2
npm install -D qrcode-terminal
```

Then make the folders:

```bash
mkdir src/ui src/game scripts scripts/lib docs docs/guide public/previews
```

Delete the example files Vite made (`src/App.css`, `src/assets/`, the React logo) and replace `vite.config.js` with the one from chapter 2: `base: './'` and the three extra chunks.

## The build order at a glance

| Phase | You write | Done when |
|---|---|---|
| 0. Skeleton | `package.json`, `vite.config.js`, `index.html`, `src/main.jsx`, `src/App.jsx` | `npm run dev` shows a page |
| 1. Data | `game/tracks.js` (one track), `game/karts.js` | the files load in Node without errors |
| 2. Track builder | `game/trackBuild.js`, `scripts/check-tracks.mjs` | the check passes and the layout picture looks right |
| 3. Simulation | `game/sim.js`, `game/ai.js`, `game/setup.js`, `scripts/check-sim.mjs` | 4 AI karts finish 3 laps in Node |
| 4. 3D world | `game/geo.js`, `kartModel.js`, `props.js`, `biomes.js`, `world3d.js`, `visuals.js`, `bus.js`, `input.js`, `src/Race.jsx` | you can drive the track in the browser |
| 5. HUD and touch | `src/Hud.jsx`, `src/Touch.jsx`, `src/styles.css` | position, laps and touch buttons work |
| 6. Rules and save | `game/save.js`, `game/progress.js`, `src/store.js`, `scripts/check-save.mjs` | rewards, stars and unlocking pass their checks |
| 7. Screens | everything in `src/ui/`, then `App.jsx` again | you can go menu → map → race → results → garage |
| 8. Sound | `game/audio.js` | sounds and music play after the first tap |
| 9. All 12 tracks | `game/autoplace.js`, the other 11 tracks, `public/previews/` | all checks pass on 12 tracks |
| 10. Phone and offline | `public/sw.js`, `manifest.webmanifest`, `icon.svg`, `scripts/play.mjs`, `play now.cmd` | the game opens on a phone on the same Wi-Fi |
| 11. Tests, tuning, documents | `check-gameplay.mjs`, `browser-test.mjs`, `bot-balance.mjs`, `perf-report.mjs`, `docs/` | every test passes |

## Phase 0: the skeleton

* `index.html`: one `<div id="root">` and the script `src/main.jsx`. Add the phone viewport line now (`width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover`); it is easy to forget later.
* `src/main.jsx`: create the React root and render `<App />`.
* `src/App.jsx`: for now, just a title.

**Check:** `npm run dev`, open `http://localhost:5173`.

## Phase 1: the data

* `game/tracks.js`: start with **one** track: an id, a name, a road half-width (about 9.5 m) and 8 to 12 curve points that make a closed loop a few hundred metres across. Colours can wait.
* `game/karts.js`: the kart list with stats (1 to 10) and `simStats()`, which turns stats into top speed, acceleration and steering speed.

Writing data first means every later file has something real to read.

**Check:** `node -e "import('./src/game/tracks.js').then(m => console.log(m.TRACK_LIST.length))"` prints 1.

## Phase 2: the track builder

`game/trackBuild.js` turns the curve points into a smooth closed curve (a Catmull-Rom spline) and cuts it into **samples every 2 m**. For each sample keep the position, the forward direction, the sideways direction and how curved the road is there. Then add `locate()` (nearest sample and sideways distance for any point), checkpoints and walls.

`scripts/check-tracks.mjs` checks the result: the loop is closed, no part of the road comes too close to another part, corners are not tighter than the road is wide, and the start is straight. With `--layout` it also writes `scripts/out/layout.html`, a drawing of every track from above. Look at it: it is the fastest way to see a bad track.

**Check:** `node scripts/check-tracks.mjs --layout` passes.

## Phase 3: the simulation

`game/sim.js` is the heart of the game, so it comes before any graphics. Write it in this order, testing as you go:

1. `createWorld()` and a `step(world, input, 1/60)` that only drives forward and steers.
2. Speed limits, braking and reverse, walls that push the kart back, off-road slowdown.
3. Laps with **ordered checkpoints**, then positions.
4. `game/ai.js`: computer drivers that look ahead along the road, slow down for curves and keep their own lane.
5. Drifting (hold drift while steering; the longer you drift the bigger the mini-boost), the boost bar and the boost button, boost pads.
6. Ramps and jumps (height, gravity, landing), surfaces (sand, water, ice, dirt), swinging boulders, kart-to-kart bumps.
7. Stuck and wrong-way recovery, and the end of the race (results list).

`game/setup.js` builds the 4 racers; `scripts/check-sim.mjs` lets the AI drive every kart, the player's too, for 3 laps.

**Check:** `node scripts/check-sim.mjs` shows 4/4 karts finished, no respawns, sensible lap times.

> **Tip:** Keep `sim.js` free of three.js, React and `window`. Then a whole race runs in Node in a fraction of a second, and every rule can be tested without opening a browser.

## Phase 4: the 3D world

1. `game/geo.js`: helpers that make a box, cylinder, cone or sphere **with a colour**, and merge many of them into one shape. One shared material for everything keeps the game fast.
2. `game/kartModel.js`: the kart and driver from about 25 small shapes. Keep the wheels separate so they can spin.
3. `game/world3d.js`: the road as a ribbon along the samples, kerbs, walls, the start gate, then the floating island underneath.
4. `game/props.js` and `game/biomes.js`: scenery models. Place them with **instancing**: one draw call for all palm trees, however many there are.
5. `game/visuals.js`: the moving parts: karts (placed between the last two simulation steps), the chase camera, coins, sky, sun, clouds.
6. `game/input.js` and `game/bus.js`.
7. `src/Race.jsx`: a React Three Fiber `<Canvas>`; inside `useFrame()` read input, run `step()` as many times as needed, call `visuals.update()`.

**Check:** set `App.jsx` to show `<Race />` directly and drive a lap with the arrow keys.

## Phase 5: HUD and touch

* `src/Hud.jsx`: position, lap, timer, coins, a minimap drawn on a small canvas, the boost bar. Read the numbers with a timer 10 times a second, not from React state every frame.
* `src/Touch.jsx`: a joystick that gives analog steering and big buttons. Use pointer events and keep track of each finger, so steering, drift and boost work at the same time.
* `src/styles.css`: start with the HUD and the touch buttons; use `env(safe-area-inset-*)` so nothing hides behind a phone's notch.

**Check:** in Chrome's device toolbar (phone mode), the buttons react and do not cover the road too much.

## Phase 6: rules and saving

1. `game/save.js`: the default save and `sanitize()`. Write `sanitize()` so that it accepts **any** value; the tests will throw garbage at it.
2. `game/progress.js`: `applyRace()` (coins for the place, coins picked up, stars, unlocking the next track, track tasks), the missions and `claimMission()`, and the shop functions. Each one returns a new save.
3. `src/store.js`: the Zustand store with the screen, the save and pause; every action that changes the save writes it to `localStorage` straight away.
4. `scripts/check-save.mjs`.

**Check:** `node scripts/check-save.mjs`: stars, unlocking, no double reward, purchases and broken saves all pass.

## Phase 7: the screens

Write `ui/Shell.jsx` first (logo, coins, bottom bar), then `Menu`, `MapScreen`, `Results` (the core loop: pick a track, race, see the result), then `Garage` with `GaragePreview`, `Missions`, `Pause` with the settings panel, and `SettingsScreen`. Finally make `App.jsx` switch between them by `store.screen`, and load `Race.jsx` lazily so the menus appear quickly.

**Check:** play the whole loop: menu → map → race → results → next track; buy a kart in the garage; reload the page and see that everything is still there.

## Phase 8: sound

`game/audio.js` makes every sound in code: it writes short sound waves (sine, triangle, saw, noise) into WAV data and gives them to Howler. The engine sound changes pitch with speed. Each track gets a short seeded music loop. Browsers only allow sound after the first tap or key press, so `App.jsx` starts audio on the first `pointerdown` or `keydown`.

**Check:** sound starts after the first click; mute and the volume sliders work.

## Phase 9: twelve tracks

With one track working, add the other eleven. Writing pad, ramp and shortcut positions by hand for 12 tracks is slow and easy to get wrong, so `game/autoplace.js` finds them from the road's shape and a short recipe in each track's data. Make each track different: shape, colours, weather, scenery, landmark, surfaces, gravity (Lunar Circuit), music.

Then make the map pictures: `npm run build`, then `node scripts/make-previews.mjs`.

**Check:** `npm run check` passes on all 12 tracks, and every shortcut is faster than the main road.

## Phase 10: phone and offline

* `public/manifest.webmanifest` and `public/icon.svg` for "Add to home screen".
* `public/sw.js`: a service worker that keeps a copy of the game for offline play; register it in `main.jsx` for the built game only.
* `scripts/play.mjs` and `play now.cmd`: serve `dist/` to the local network and print the phone address.

**Check:** `play now.cmd`, then open the printed address on a phone on the same Wi-Fi.

## Phase 11: tests, tuning and documents

* `scripts/check-gameplay.mjs` for the driving rules, `scripts/browser-test.mjs` for the real game in Chrome.
* `scripts/bot-balance.mjs` to tune the rivals: early tracks should be easy to win, later ones should need upgrades.
* `scripts/perf-report.mjs` to keep draw calls and triangles low.
* The documents in `docs/`.

**Check:** `npm run check`, `npm run build`, `npm run test:browser` all pass.
