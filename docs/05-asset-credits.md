# Asset credits

**All game content is original and made in code.** There are no downloaded images, models, fonts, sounds or music.

| Part | Source |
|---|---|
| Karts, drivers, wings, tracks, scenery, coins, pads, ramps | Generated procedurally with Three.js primitives (boxes, cones, spheres ...) and vertex colours, written for this project |
| Sky, clouds, weather, particles, aurora, lightning | Code (shaders and point sprites) |
| Sounds (engine, coins, boost, countdown, menu clicks ...) | Synthesised at runtime in `src/game/audio.js` (sine / triangle / saw waves and noise) |
| Music | Generated per track at runtime from a small seeded melody, bass and drum pattern |
| Track thumbnails (`public/previews/*.jpg`) | Screenshots of the game's own 3D scene, made by `scripts/make-previews.mjs` |
| Icon (`public/icon.svg`) | Hand-written SVG |
| Fonts | None loaded; the system font stack is used |

The five concept images given with the request (title / HUD, world map, garage, missions, results) were used only as a visual reference for the layout and mood. No part of them is included in the game, and they are not stored in the project folder.

The names, characters and look are original; no Nintendo (or other company) names, characters, tracks or sounds are used.

## Libraries (all MIT licensed)

| Library | Use |
|---|---|
| React, React DOM | user interface |
| Three.js | 3D rendering |
| @react-three/fiber | React renderer for Three.js (canvas and frame loop) |
| Zustand | small state store |
| Howler.js | audio playback |
| Vite, @vitejs/plugin-react | build tool |
| qrcode-terminal (dev only) | QR code printed by `play now.cmd` |
