# Known issues, limits and ideas

## Not tested (please be aware)

* **No physical device was used for this game.** Phone behaviour was tested only with Chrome's touch emulation in a headless browser (sizes 844x390 and 390x844, simultaneous touches, rotation). Real-finger comfort, real frame rate, heat and battery are **unknown**. (The earlier game, Turbo Kart Rush 3D, ran acceptably on the owner's phone, and this game uses the same approach, but this one has bigger scenes.)
* **Frame rate was never measured on real hardware.** The headless browser draws in software, so its fps numbers mean nothing. What was measured instead: draw calls, triangles and JavaScript time per frame (see the testing report).
* Only **Chrome** was used. Safari / iOS, Firefox and Edge were not tested.
* **Sound was not listened to by a person.** All sounds are synthesised in code and play without errors, but their loudness and taste are unchecked. Music loops are simple.
* **Gamepad** code exists but no gamepad was available to test it.
* The **service worker** (offline play) was built and registers, but offline mode was not tested.
* **Difficulty** was tuned with simulated players (bots) and not with real people. The first tracks should be easy to finish and win; later tracks are meant to need upgrades or a better kart. Real players may find them easier or harder.
* The AI cannot drift; a human who drifts well can gain more than the bots did.

## Known limits

* The simulation is flat (no real hills); ramps are the only height. Islands, waterfalls and clouds are scenery.
* Walls are solid and kind (they push you back); you cannot fall off an island.
* Driver and wing choices are cosmetic only. Paint is cosmetic only.
* Missions count totals from all races (they are not "per day" and do not reset).
* The track thumbnails are screenshots; if a track is changed, run `npm run previews` again.
* Tilt steering from the first game was not added.
* The three AI karts do not collect coins and do not use ramps on purpose (they may still drive over them).
* Very long browser pauses (tab hidden for minutes) are handled by pausing; the race clock never jumps.
* If the browser blocks storage (private mode), the game still works but progress is lost when the page is closed; a warning is shown on the results and settings screens.

## Ideas for later

* Time trial with ghost kart, more than 4 racers, split screen
* Items (shells, shields) on the road
* Per-track medals and online leaderboards
* Real art: authored models and textures instead of procedural ones
