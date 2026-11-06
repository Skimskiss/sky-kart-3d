# Architecture

```
index.html, vite.config.js, package.json
public/        icon, manifest, service worker, previews/<track>.jpg (track thumbnails made by a script)
src/
  main.jsx, App.jsx         screen switch (menu, map, garage, missions, settings, race, results)
  store.js                  Zustand store: screen state + the save; every change is written to localStorage at once
  Race.jsx                  React Three Fiber <Canvas>; runs the game loop inside useFrame
  Hud.jsx, Touch.jsx        DOM overlay (HUD, minimap, joystick and buttons)
  ui/                       Menu, MapScreen, Garage (+ GaragePreview), Missions, Results, SettingsScreen, Pause, Shell
  game/                     the game itself - no React inside
    trackBuild.js           curve -> evenly spaced road samples, shortcut road, checkpoints, locate(), walls, ramps
    tracks.js               the 12 track definitions (pure data)
    autoplace.js            finds good places for pads, ramps, zones, movers, coins and the shortcut on each road
    sim.js                  fixed 60 Hz race simulation (pure JS, runs in Node too)
    ai.js                   AI drivers
    karts.js                kart / paint / driver / wing catalogue, upgrades, stat maths, rivals
    setup.js                builds the racers of a race from the save
    progress.js             rules that change the save: rewards, stars, unlocking, missions, shop
    save.js                 save format, sanitising of invalid data, load / persist
    world3d.js, props.js    static 3D world: road, island, scenery (instanced), landmarks
    visuals.js              dynamic 3D scene: karts, coins, camera, particles, sky, weather
    kartModel.js, geo.js    kart model and geometry helpers
    audio.js, input.js, bus.js
scripts/                    checks, browser tests, preview maker, launcher
docs/                       these documents
```

## Main ideas

* **The simulation is separate from React and from three.js.** `sim.js` is plain JavaScript with a fixed time step of 1/60 s. `Race.jsx` calls `step()` as many times as needed each frame (a time accumulator), then draws with interpolation between the last two states. No per-frame data goes through React state. The HUD reads a few numbers from the simulation 10 times per second.
* **Tracks are data.** A track is a list of control points of a smooth closed curve plus a theme (colors, scenery) and a recipe. `trackBuild.js` turns it into 2 m samples. `autoplace.js` then looks at the curvature of the road: pads and ramps go on straights, the shortcut cuts across a real bend, zones and obstacles are spread over the lap. This is deterministic (seeded), so a track is always the same, and `scripts/check-tracks.mjs` checks every result.
* **Shortcut road:** a second road (Bezier curve) with its own walls and surface. Progress on it is mapped onto the main road's progress range, so lap counting and positions keep using one number.
* **Checkpoints and laps:** each kart has `nextCp`. A checkpoint is passed when the kart's progress index is just past it and it is the next one in order. The finish line only counts when all checkpoints are done. The ranking score is clamped by the next checkpoint, so nothing can be gained by skipping.
* **Ramps are real surfaces:** the kart's height follows the ramp, and leaving the top launches it with the ramp slope. Lunar Circuit uses lower gravity.
* **Vehicle stats** (1 to 10, plus upgrades) become `maxSpeed`, `accel`, `steerRate`, boost fill / power / pad time and weight in `karts.js`. The same function is used for the player and the rivals.
* **Rivals** get stronger track by track (`rivalStats`, `rivalDifficulty`), and rubber-banding keeps races close.
* **Performance:** all 3D is vertex-coloured Lambert geometry (no textures except two small canvases), scenery is instanced (one draw call per kind of prop), the island is one mesh, shadows only on medium / high quality, the render resolution is capped (1 / 1.5 / 2) and lowered automatically if the frame rate drops (adaptive resolution), and effects (particles, weather) scale with the quality setting.
* **Audio:** sounds and music are synthesised at runtime into WAV buffers and played with Howler (no audio files). Nothing starts before the first tap or key press.
* **Pausing:** the `paused` flag stops `step()`, silences the engine, pauses music; losing focus, hiding the tab or opening settings pauses and clears every held key and touch.
* **Saving:** `save.js` has `sanitize()` that accepts any value and returns a valid save. All rewards go through `progress.js`, which returns a new save; the store writes it to localStorage before the screen changes, so a reward cannot be paid twice (claims are flags in the save).
