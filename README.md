# Sky Kart 3D: Island Grand Prix

An arcade kart racing game for the browser. Race 3 AI rivals on **12 floating-island tracks**, find shortcuts, collect coins, finish missions, upgrade and paint your kart. Works with keyboard, gamepad and touch (phones).

Made with **Vite, React, JavaScript, React Three Fiber and Three.js**. All art and sound are generated in code (no downloaded assets).

## Download and play

The repository download includes the source, the ready-to-host production build in [dist/](dist/), the [complete PDF guide](docs/Sky-Kart-3D-Complete-Guide.pdf), and [recorded test output](docs/verification/). Upload the contents of dist to a static web host, or use the local launcher below.

## Play it

* **Windows, easiest:** double-click `play now.cmd` (needs Node.js 18+). It installs, builds, starts the game and prints a phone address + QR code.
* **Or:** `npm install`, then `npm run dev` (development) or `npm run build` and `npm run preview`.
* **Host it:** upload the contents of `dist/` to any static host. See [docs/03-setup-and-deploy.md](docs/03-setup-and-deploy.md).

## Quick controls

Arrows / WASD drive, **Space** drift, **Shift** boost, **R** reset, **Esc** pause. On a phone: joystick on the left, DRIFT / BOOST / BRAKE buttons on the right (auto-accelerate is on by default).

## What is in it

* 12 distinct tracks (different road shapes, scenery, surfaces, obstacles, ramps, pads) each with a shortcut
* 3-lap races against 3 AI karts, ordered checkpoints, validated laps, accurate positions
* Stars (finish / top three / win), track tasks, best times, unlocking, Continue Adventure
* 20 missions with one-time rewards, coins, persistent save
* Garage: 5 karts, upgrades that change the driving, paints, drivers, wings, rotatable 3D preview
* Drifting with mini-boosts, boost bar, boost pads, ramps, off-road, collisions, safe recovery
* Touch controls with analog steering, music and sound settings, adaptive graphics quality

## Documents

| File | Content |
|---|---|
| [docs/01-controls-and-features.md](docs/01-controls-and-features.md) | Controls guide and how the game works |
| [docs/02-architecture.md](docs/02-architecture.md) | How the code is organised |
| [docs/03-setup-and-deploy.md](docs/03-setup-and-deploy.md) | Install, run, build, deploy |
| [docs/04-testing-report.md](docs/04-testing-report.md) | What was tested, results, performance, what was NOT tested |
| [docs/05-asset-credits.md](docs/05-asset-credits.md) | Credits and licences |
| [docs/06-known-issues.md](docs/06-known-issues.md) | Known limits and ideas |

## Tests

```bash
npm run check          # track geometry, save/rules, AI races on all 12 tracks, gameplay rules (no browser, about 2 minutes)
npm run build && npm run test:browser   # end-to-end in headless Chrome (menus, race, saving, touch, all 12 tracks)
npm run balance        # difficulty check with simulated players
```
