# 7. Testing

Every part of the game is checked by a program, so a change that breaks something shows up at once. The tests were run again on 23 October 2026 for this guide, on Windows 11 with Node 24 and Google Chrome.

## The test programs and their results

| Program | Command | What it checks | Result |
|---|---|---|---|
| Track geometry | `node scripts/check-tracks.mjs` | the shape of all 12 tracks | all 12 pass |
| Save and rules | `node scripts/check-save.mjs` | saving, repair, rewards, missions, shop | 27 of 27 pass |
| AI races | `node scripts/check-sim.mjs` | a full race on every track | 12 of 12 tracks: all 4 karts finish |
| Gameplay | `node scripts/check-gameplay.mjs` | laps, driving, stats, shortcuts, speed | 31 of 31 pass |
| Browser | `node scripts/browser-test.mjs` | the real game in Chrome, PC and phone | 76 of 76 pass |
| Build | `npm run build` | the finished game | builds with no warnings |

The first four run in Node.js without a browser (`npm run check`, about 2 minutes). The browser test needs a fresh build and Chrome (about 10 minutes).

## What each program checks

**Track geometry** (`check-tracks.mjs`), for every track: the loop is closed and smooth; no part of the road comes closer than two road-widths to another part; corners are not tighter than the road allows; the start is straight; checkpoints are in order and none is on the shortcut; the shortcut is shorter than the road it skips and keeps clear of the rest; there are at least 2 boost pads and 1 ramp; every coin lies on a road; the tasks are set.

| Track | Lap (m) | Tightest corner (m) | Checkpoints | Pads | Ramps | Moving obstacles | Shortcut vs. road it skips (m) |
|---|---|---|---|---|---|---|---|
| Tropical Coast | 1 327 | 29 | 6 | 4 | 2 | 0 | 139 instead of 244 |
| Snow Peaks | 1 248 | 24 | 6 | 3 | 2 | 2 | 75 instead of 148 |
| Desert Ruins | 1 169 | 29 | 6 | 4 | 1 | 4 | 94 instead of 136 |
| Emerald Jungle | 1 560 | 21 | 6 | 3 | 2 | 3 | 179 instead of 328 |
| Coral Ocean | 1 222 | 16 | 5 | 2 | 2 | 3 | 238 instead of 376 |
| Autumn Forest | 1 662 | 33 | 6 | 3 | 2 | 3 | 143 instead of 256 |
| Lunar Circuit | 1 651 | 67 | 6 | 2 | 3 | 3 | 305 instead of 376 |
| Mushroom Grove | 1 636 | 36 | 6 | 3 | 2 | 2 | 139 instead of 280 |
| Thunder Island | 1 577 | 33 | 6 | 4 | 2 | 4 | 135 instead of 196 |
| Volcanic Core | 1 258 | 21 | 6 | 4 | 2 | 5 | 310 instead of 376 |
| Aurora Pass | 1 666 | 55 | 6 | 4 | 2 | 3 | 178 instead of 328 |
| Sky Castle | 1 390 | 27 | 6 | 4 | 3 | 4 | 103 instead of 184 |

**Save and rules** (`check-save.mjs`): garbage, broken and hostile saves (wrong types, negative or huge coins, unknown tracks and karts, too many stars, upgrade level 99) all become valid saves; broken text is kept aside; a blocked browser storage never crashes the game; stars are 1 / 2 / 3; finishing in last place still unlocks the next track; not finishing gives nothing; star and task coins are paid only once; best times only get better; missions cannot be claimed early or twice; purchases charge once, refuse when you are short of coins or already own the item, and stop at level 5; only owned items can be equipped; the real store writes to storage at once.

**AI races** (`check-sim.mjs`): on every track all four karts, driven by the AI, finish 3 laps with valid lap times and no karts lost off the track. Winning times are between about 90 and 140 seconds.

**Gameplay** (`check-gameplay.mjs`):

* A lap is **not** counted when a kart jumps to the end of the lap without the checkpoints.
* Checkpoints are reported in order; finishing positions are 1, 2, 3, 4 in order of time; the live order always matches progress.
* Ramps launch the kart and it lands; jumps on Lunar Circuit last longer (low gravity).
* The boost button only works with boost in the bar, empties it, and makes the kart faster.
* Drifting fills the bar and gives a mini-boost when released; boost pads are counted for the missions.
* Walls keep karts on the island; braking stops and then reverses; a stuck kart is put back, and so is one after R.
* Karts bump each other apart.
* **Better stats give faster laps** (speed, acceleration, handling and boost each tested).
* On **every one of the 12 tracks the shortcut is used, can be finished, and is faster** than the main road (3 to 18 seconds over 3 laps).
* One simulation step with 4 karts takes about 0.003 ms.

**Browser** (`browser-test.mjs`), in a real Chrome against the built game:

* Menus: every main button, 12 track cards with 11 locked at the start, a locked track cannot be started.
* Real key presses: gas, steering, drift and boost together, brake.
* Pause with Esc; the race clock stops; held keys are released; losing focus pauses; settings from the pause menu.
* A whole race to the end: coins are added and saved, the next track opens, the best time is stored; everything is still there after reloading the page; Continue Adventure picks the right track.
* Missions: CLAIM pays once, and stays claimed after a reload.
* Results and pause buttons: NEXT TRACK, REPLAY, MAP, Restart race, Quit to map, the logo back to the menu.
* Garage: buying a kart, an upgrade and a paint, equipping, all still there after a reload; **the bought upgrade really changes the kart's top speed in the race**.
* A broken save and a nonsense save do not crash the game; settings are saved.
* **All 12 tracks** are started, driven to the end by the autopilot and show results.
* No errors or warnings in the browser console.
* Phone emulation (844 × 390 and 390 × 844): touch buttons are big enough; three fingers at once (steer + drift + boost); the joystick is analog; brake beats auto-gas; letting go clears everything; losing focus while a button is held releases it; turning the phone resizes the game; no screen sticks out sideways in portrait.

## Difficulty

`bot-balance.mjs` races simulated players on every track. With the free Comet kart and no upgrades, a "good" player that uses the shortcut and boost wins tracks 1 to 3 every time, fights for places on tracks 4 to 8 and finishes last on 9 to 12. With Skyhawk and 2 upgrade levels it wins almost everywhere. So the later tracks are meant to need upgrades or a better kart.

> **Honest status:** These are simulated players, not people. Real players who drift well may find the game easier; new players may find it harder.

## Speed

`perf-report.mjs` drives every track at each quality level in a phone-sized window and reads what the graphics card has to draw.

| Quality | Most draw calls | Most triangles | Most JavaScript time per frame |
|---|---|---|---|
| Low | 110 | 77 000 | 0.28 ms |
| Medium | 106 | 103 000 | 0.18 ms |
| High | 106 | 120 000 | 0.25 ms |

Draw calls and triangles are the same on every device. The JavaScript time was measured on this PC. A phone is slower; even if it needed ten times longer, that would still be small next to the 16.7 ms a frame may take at 60 FPS.

> **Not tested yet:** The **frame rate** was not measured on any real device. The test Chrome draws without a graphics card (software drawing), so its FPS says nothing about a phone or a gaming PC. The game protects itself (shared colour-only material, instanced scenery, quality levels, automatic resolution drop below 48 FPS), but only a real phone can show how smooth it is.

## What has NOT been tested

| Not tested | Why it matters |
|---|---|
| A real phone or tablet | Touch was only emulated. Real fingers, frame rate, heat and battery are unknown. |
| Safari (iPhone, iPad, Mac), Firefox, Edge | Only Chrome was used. |
| Listening to the sound | All sounds play without errors, but nobody has judged how they sound. |
| A real gamepad | The code is there; no gamepad was connected. |
| Offline play | The service worker installs, but starting the game with no internet was not tried. |
| The game online | It was never uploaded to a host. |
| Real players | Difficulty was tuned with simulated players only. |

## How to run all the tests again

```bash
npm install
npm run check
npm run build
npm run test:browser
node scripts/perf-report.mjs
npm run balance
```
