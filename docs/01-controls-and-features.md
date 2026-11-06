# Controls and features

## Keyboard (PC)

| Key | Action |
|---|---|
| Arrow Up / W | Accelerate |
| Arrow Down / S | Brake (hold longer to reverse) |
| Arrow Left / Right, A / D | Steer |
| Space | Drift (hold while steering) |
| Shift or B | Boost (burns the boost bar) |
| R | Put the kart back on the road |
| C | Look behind |
| Esc or P | Pause |

A gamepad also works (stick = steer, RT/A = gas, LT/B = brake, RB = drift, X = boost, Start = pause).

## Touch (phone / tablet)

* **Joystick (left):** move your thumb left or right. The more you move, the more the kart turns (analog steering). A sensitivity slider is in Settings.
* **DRIFT** (big orange button), **BOOST** (big blue button), **BRAKE** (red button).
* **Auto-accelerate** is on by default: the kart drives by itself and you only steer, drift and brake. Turn it off in Settings to get a GAS button.
* All buttons can be held at the same time (steer + drift + boost works).
* Controls stay inside the safe area (notches, rounded corners). The game works in landscape and portrait; landscape is more comfortable.

## How a race works

* 4 karts (you and 3 AI rivals), 3 laps, 3-2-1-GO countdown.
* **Checkpoints:** the road has checkpoints (blue flags). A lap only counts when you pass them all in order, so skipping parts of the track does not work.
* **Positions** are worked out from validated progress, so they are always right.
* **Coins** are on the road and come back every lap. They also fill the boost bar a little.
* **Boost bar:** fills while you drift, from boost pads and from coins. Hold BOOST to use it.
* **Drift mini-boost:** drift for a while (blue, then orange, then purple sparks) and let go to get a short speed burst.
* **Boost pads** (blue arrows), **ramps** (launch you into the air), **sand / mud / water** (slow), **ice** (slippery), swinging **obstacles** (spin you out).
* **Off-road** (grass) slows you down. If you get stuck, the game puts you back on the road after a few seconds, or press R.
* **Shortcuts:** every track has a second road across the infield (narrow, with its own surface and dangers). It is shorter, so it saves time, but it is harder to drive. The AI also uses shortcuts.

## Campaign, stars and rewards

* 12 tracks on floating islands: Tropical Coast, Snow Peaks, Desert Ruins, Emerald Jungle, Coral Ocean, Autumn Forest, Lunar Circuit, Mushroom Grove, Thunder Island, Volcanic Core, Aurora Pass, Sky Castle.
* Only track 1 is open at the start. **Finishing a track (any place) unlocks the next one.**
* **Stars:** 1 star for finishing, 2 for finishing in the top three, 3 for winning. Stars never go down.
* **Track tasks** (shown on the map): finish the race, collect N coins, finish under a time. Each task gives a one-time bonus.
* **Coins you earn:** position bonus (150 / 100 / 60 / 30), coins picked up, +100 for each new star, +50 for each new task.
* The map shows best times and stars. **Continue Adventure** (main menu) jumps to the next track you have not finished. You can replay any open track.

## Missions

20 missions (coins, drifting seconds, boost pads, boost time, ramp jumps, shortcuts, races finished, wins, race time, stars). Progress counts automatically from all your races. When a mission is complete, press **CLAIM** once to get its coins. A claimed mission can never be claimed again.

## Garage

* **5 karts** (Comet is free; Sprout, Bulldog, Stardust and Skyhawk are bought with coins). Each has different Speed / Accel / Handling / Boost stats and weight.
* **Upgrades:** 4 upgrades per kart (Engine, Gearbox, Tyres, Boost tank), 5 levels each. The stats really change the driving (top speed, acceleration, steering rate, boost bar fill, boost strength).
* **Paint colors** (8, some free), **drivers** (5 helmets) and **wings** (4 styles) are cosmetic.
* Drag the 3D kart to rotate it. Press EQUIP to use a kart; EQUIPPED means it is already in use.

## Saving

Everything is saved in the browser (localStorage, key `skykart3d.save.v1`): coins, stars, best times, unlocked tracks, missions, owned karts, upgrades, paints, equipment and settings. A damaged save is detected and replaced by a fresh one (the damaged text is kept under `skykart3d.save.v1.bad`). Settings → "Reset all progress" deletes everything.
