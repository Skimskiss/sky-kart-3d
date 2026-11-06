# Testing report

Tested on Windows 11, Node 24, Chrome (headless, software WebGL). Production build in `dist/` (1.6 MB, JS gzip about 300 KB in 7 chunks; the 3D chunks load only when needed).

## Summary

| Suite | Command | Result |
|---|---|---|
| Track geometry (12 tracks) | `node scripts/check-tracks.mjs` | all pass |
| Save data and rules | `node scripts/check-save.mjs` | 27 / 27 pass |
| AI races on all 12 tracks | `node scripts/check-sim.mjs` | 12 / 12 tracks: all 4 karts finish 3 laps, no respawns, no NaN |
| Gameplay rules | `node scripts/check-gameplay.mjs` | 31 / 31 pass |
| Browser end-to-end | `node scripts/browser-test.mjs` | 76 / 76 pass (headless Chrome, desktop + emulated phone) |
| Production build | `npm run build` | OK, no warnings |

## What the automatic checks cover

**Track geometry:** closed loops, lap 1170 to 1660 m, no road part closer than 2 x wall width to another, tight corners not tighter than the road allows, straight start, ordered checkpoints (none inside the shortcut), shortcut saves distance and keeps clear of the main road, at least 2 boost pads and 1 ramp per track, all coins lie on a road, tasks defined.

**Save and rules:** garbage / corrupt / hostile saves become valid saves; corrupt text is kept under `.bad`; blocked storage never throws; stars (1 / 2 / 3), unlocking of the next track (even for last place), no unlock or stars for not finishing, star and task coins paid once, best times only improve; missions cannot be claimed early or twice; purchases (karts, paints, drivers, wings, upgrades) charge once, refuse when poor or already owned, cap at level 5, equip only owned items; the real store writes to storage immediately.

**AI races:** on every track four karts finish three laps with valid lap lists; winner times 89 to 134 s.

**Gameplay:** a lap is not credited without all checkpoints (teleport test); checkpoint events come in order; positions are unique and agree with progress every frame; ramps launch and land; Lunar Circuit jumps are longer (lower gravity); the boost button needs boost in the bar, drains it and speeds the kart up; drifting fills the bar and gives mini-boosts; boost pads count; walls keep karts on the island; braking and reverse; stuck recovery and the R key; kart-to-kart bumps; **vehicle stats change lap times** (speed, acceleration, handling, boost); on **all 12 tracks the shortcut is used, finishable and faster than the main road** (saves 3 to 18 s over 3 laps); one simulation step costs about 0.003 ms.

**Browser (Chrome):** menu buttons, map with 12 cards (11 locked at first), locked track cannot start, real keyboard events drive the kart (gas, steer, drift + boost together, brake), Esc pause (simulation time frozen), focus loss pauses and clears held keys, race finish gives coins and saves them, next track unlocked, reload keeps progress, Continue Adventure, mission claim once and after reload, Next / Replay / Map / Restart / Quit buttons, garage purchase / upgrade / paint / equip and after reload, the equipped kart's upgraded stats are used in the race, corrupt and nonsense saves, settings saved, **all 12 tracks started and finished by autopilot**, no console errors or warnings in the whole run. Phone emulation (touch): 3 simultaneous touches (analog steer + drift + boost), brake overrides auto-gas, releasing clears everything, focus loss clears a held button, landscape 844x390 and portrait 390x844 (canvas resizes, controls on screen), no screen sticks out sideways in portrait.

## Difficulty (simulated players, `npm run balance`)

With the free kart, a "good" bot that uses the shortcut and boost wins tracks 1 to 3 every time, fights for places on 4 to 8, and finishes last on 9 to 12. With Skyhawk + 2 upgrade levels it wins almost everywhere; with Bulldog + 1 level results are mixed. So later tracks are meant to need upgrades or a better kart. This is a **bot estimate, not a human test**.

## Performance (honest)

Measured with `node scripts/perf-report.mjs` (phone-sized window, all 12 tracks, 3 quality levels):

| Quality | Max draw calls | Max triangles | Max JS time per frame (simulation + scene update) |
|---|---|---|---|
| low | 110 | 77 000 | 0.28 ms |
| medium | 106 | 103 000 | 0.18 ms |
| high | 106 | 120 000 | 0.25 ms |

* These numbers come from the real CPU of the PC, so on a phone the JS time may be 3 to 6 times larger (still small). Draw calls and triangle counts do not depend on the device.
* **Frame rate was NOT measured on any real device.** Headless Chrome draws in software (about 17 fps), which says nothing about a phone or a PC with a graphics card. **Physical-device testing has not been done.**
* Built-in protections: instanced scenery and coins, merged meshes, vertex colours (no textures), shadows only on medium / high, particles and weather scale with quality, device pixel ratio capped (1 / 1.5 / 2) and lowered automatically (down to 0.55) when the measured frame rate stays under 48 fps, the simulation is separate from React, the HUD updates 10 times per second.
* Quality "auto" picks low for phones with 4 or fewer cores or 3 GB or less memory, medium for other phones and PCs with fewer than 8 cores, high otherwise.

## Not tested / limits

See [06-known-issues.md](06-known-issues.md): real phones, Safari / Firefox, sound by ear, gamepad, offline mode, and real-player difficulty are all untested.

## How to repeat

```bash
npm install
npm run check
npm run build
npm run test:browser          # needs Chrome (set CHROME_PATH if it is not in the default folder), takes about 10 minutes
node scripts/perf-report.mjs
node scripts/screens.mjs scripts/out/screens 390 844 mobile    # screenshots of every screen
```
