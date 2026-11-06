# 2. The full folder structure

This chapter shows **every folder and every file** in the project, in the same order you see them on disk. For each file you get its size in lines, what it does, and which other files use it. The project lives in `your Sky Kart 3D checkout`.

## The whole tree

The tree leaves out only the files that programs make for you: `node_modules/` (the downloaded libraries), the inside of `dist/` (the finished game, shown in its own section below) and the inside of `scripts/out/` (test results).

```tree
Sky Kart 3D/
├── README.md                     short introduction and the most used commands
├── package.json                  project name, the npm commands, the libraries
├── package-lock.json             exact library versions (written by npm, do not edit)
├── vite.config.js                build settings: relative paths, 3 extra chunks
├── index.html                    the only HTML page; it loads src/main.jsx
├── play now.cmd                  Windows launcher: install, build, start, open
│
├── src/                          THE GAME (source code)
│   ├── main.jsx                  starts React, registers the offline service worker
│   ├── App.jsx                   shows the right screen, starts the menu music
│   ├── store.js                  app state: screen, save, pause (Zustand)
│   ├── styles.css                the look of every screen, the HUD and the touch buttons
│   ├── Race.jsx                  the race: 3D canvas, game loop, pause, focus loss
│   ├── Hud.jsx                   position, lap, timer, coins, minimap, boost bar
│   ├── Touch.jsx                 joystick + DRIFT / BOOST / BRAKE (/ GAS) buttons
│   │
│   ├── ui/                       the menu screens (React)
│   │   ├── Shell.jsx             shared frame: logo, coins, bottom bar, stars, sky
│   │   ├── Menu.jsx              main menu with the 3D kart
│   │   ├── MapScreen.jsx         world map: 12 track cards + the detail panel
│   │   ├── Garage.jsx            karts, drivers, wings, upgrades, paint
│   │   ├── GaragePreview.jsx     the turning 3D kart on its stand
│   │   ├── Missions.jsx          20 missions with progress bars and CLAIM
│   │   ├── SettingsScreen.jsx    the settings page
│   │   ├── Pause.jsx             pause menu + the settings panel (sliders, toggles)
│   │   └── Results.jsx           finishing order, time, rewards, next buttons
│   │
│   └── game/                     everything that is not a screen (no React here)
│       ├── tracks.js             DATA: the 12 tracks
│       ├── karts.js              DATA: karts, paints, drivers, wings, upgrades, rivals
│       ├── progress.js           RULES: rewards, stars, unlocking, missions, shop
│       ├── save.js               RULES: save format, repair, load, write
│       ├── autoplace.js          TRACK: finds where pads, ramps, hazards, shortcut go
│       ├── trackBuild.js         TRACK: curve -> road, checkpoints, "where is the kart"
│       ├── setup.js              RACE: makes the 4 racers of a race
│       ├── sim.js                RACE: the simulation, 60 steps a second
│       ├── ai.js                 RACE: the computer drivers
│       ├── input.js              keyboard + gamepad + touch -> one input object
│       ├── audio.js              all sounds and music, made in code
│       ├── bus.js                small shared object for the HUD and the tests
│       ├── geo.js                3D: helpers for simple coloured shapes
│       ├── kartModel.js          3D: the kart and its driver
│       ├── props.js              3D: scenery (palms, pines, mushrooms, towers...)
│       ├── biomes.js             3D: which scenery a track uses
│       ├── world3d.js            3D: road, walls, island, scenery (built once)
│       └── visuals.js            3D: karts, coins, camera, sky, weather, sparks
│
├── public/                       copied unchanged into the finished game
│   ├── icon.svg                  the app icon
│   ├── manifest.webmanifest      name and colours for "Add to home screen"
│   ├── sw.js                     service worker: lets the game start offline
│   └── previews/                 12 track pictures for the map (tropical.jpg ...)
│
├── scripts/                      tools and tests (Node.js); not part of the game
│   ├── lib/
│   │   ├── cdp.mjs               starts and drives a hidden Chrome
│   │   └── network.mjs           finds the PC's Wi-Fi address and a free port
│   ├── check-tracks.mjs          TEST: shape of all 12 tracks
│   ├── check-save.mjs            TEST: save repair and every rule
│   ├── check-sim.mjs             TEST: full AI races on all 12 tracks
│   ├── check-gameplay.mjs        TEST: laps, ramps, boost, stats, shortcuts
│   ├── browser-test.mjs          TEST: the real game in Chrome, desktop and phone
│   ├── bot-balance.mjs           difficulty check with simulated players
│   ├── perf-report.mjs           draw calls, triangles, JS time on every track
│   ├── play.mjs                  serves the game to this PC and to a phone
│   ├── make-previews.mjs         remakes public/previews
│   ├── tour.mjs                  a picture of every track
│   ├── shot.mjs                  quick pictures of a few screens
│   ├── screens.mjs               a picture of every menu screen
│   ├── guide-shots.mjs           the pictures in this guide
│   ├── build-guide.mjs           makes this PDF
│   └── out/                      results and pictures written by the scripts
│
├── docs/                         documents
│   ├── 01-controls-and-features.md
│   ├── 02-architecture.md
│   ├── 03-setup-and-deploy.md
│   ├── 04-testing-report.md
│   ├── 05-asset-credits.md
│   ├── 06-known-issues.md
│   ├── guide/                    the chapters of this PDF
│   │   ├── 01-overview.md ... 09-words.md
│   │   ├── images/               pictures taken from the game
│   │   └── diagrams/             the drawings (SVG)
│   └── Sky-Kart-3D-Complete-Guide.pdf     this document
│
├── dist/                         THE FINISHED GAME (made by "npm run build")
└── node_modules/                 libraries (made by "npm install", about 75 MB)
```

## The folders in one table

| Folder | What is in it | Files | Lines | Who writes it |
|---|---|---|---|---|
| (top level) | settings, launcher, the HTML page | 7 | | you |
| `src/` | the game screens that are not menus, the state, the styles | 7 | 675 | you |
| `src/ui/` | the menu screens | 9 | 531 | you |
| `src/game/` | rules, data, simulation, 3D, sound, input | 18 | 2 916 | you |
| `public/` | icon, offline worker, track pictures | 3 + 12 pictures | 55 | you (pictures: a script) |
| `scripts/` | tests and tools | 15 + 2 in `lib/` | about 1 500 | you |
| `docs/` | documents and this guide | 6 + guide | | you |
| `dist/` | the finished game to put online | 12 + 12 pictures | | `npm run build` |
| `node_modules/` | React, three.js and the other libraries | thousands | | `npm install` |
| `scripts/out/` | test logs and screenshots | varies | | the scripts |

All the game's own code is **34 files and about 4 100 lines** in `src/`. The lines are long and dense, so this is about 243 KB of text.

> **Rule:** Only `src/`, `public/`, `scripts/`, `docs/` and the top-level files are written by hand. Never edit `dist/` or `node_modules/`: they are thrown away and made again by `npm run build` and `npm install`.

## Top-level files

| File | Lines | What it does |
|---|---|---|
| `README.md` | 44 | First page of the project: what the game is, how to play it, the list of documents, the test commands. |
| `package.json` | 30 | The project's name and version, the **npm commands** (`dev`, `build`, `preview`, `play`, `check`, `test:browser`, `previews`, `balance`, `guide`) and the libraries with their versions. |
| `package-lock.json` | 2 042 | Written by npm. It pins the exact version of every library so the game builds the same way on every PC. Do not edit it. |
| `vite.config.js` | 17 | Settings for Vite, the build tool. `base: './'` makes the finished game work from any web folder. It also splits three.js, React Three Fiber and Howler into their own files so the menus load first and fast. |
| `index.html` | 18 | The single web page. It sets the phone viewport (no zoom, fills the notch area), links the icon and the manifest, and loads `src/main.jsx`. |
| `play now.cmd` | 83 | Double-click launcher for Windows. It checks Node.js, runs `npm install` the first time, builds the game, then starts `scripts/play.mjs`, which opens the browser and prints a phone address with a QR code. |

## src/ - the start, the state and the race screen

| File | Lines | What it does | Used by |
|---|---|---|---|
| `main.jsx` | 13 | The starting point. Creates the React root inside `index.html`, puts the store on `window.__store` (for tests) and registers the service worker `sw.js`. | `index.html` |
| `App.jsx` | 48 | Shows exactly one screen, chosen by `store.screen`: menu, map, garage, missions, settings, race or results. Starts sound after the first tap or key press (browsers require that) and plays menu music outside races. Loads the 3D race code only when it is needed. | `main.jsx` |
| `store.js` | 70 | The **app state**, made with Zustand: which screen is open, the save, the selected track, pause, the last results. Every action that changes the save (finish a race, claim, buy, equip) goes through here and is written to the browser at once. Also decides the "auto" graphics quality for this device. | every screen |
| `styles.css` | 190 | All the styling: sky background, buttons, cards, the garage, the HUD, the touch buttons, phone sizes (landscape and portrait), notch safe areas, reduced-motion support. | all screens |
| `Race.jsx` | 196 | The race screen. Makes the 3D canvas, builds the race world, and runs the **game loop** every frame: read input, run the simulation, update the 3D scene, play sounds. Pauses on Esc, on focus loss and when the tab is hidden. Lowers the picture resolution if the frame rate drops. | `App.jsx` |
| `Hud.jsx` | 91 | The race display drawn on top of the 3D picture: position (1st/4), lap, timer, coins, minimap, boost bar, "WRONG WAY", short messages ("LAP 2 / 3"), the pause button and the key hint. It reads numbers 10 times a second; it does not slow the race down. | `Race.jsx` |
| `Touch.jsx` | 67 | Touch controls: a joystick on the left (the further you move it, the more the kart turns) and big DRIFT, BOOST and BRAKE buttons on the right (GAS too if auto-accelerate is off). Several fingers work at the same time. | `Race.jsx` |

## src/ui/ - the menu screens

| File | Lines | What it does |
|---|---|---|
| `Shell.jsx` | 55 | Parts shared by the menu screens: the logo, the coin counter, the stars, the floating islands in the sky, and the frame with the bottom bar (Campaign, Garage, Missions with a red count of claimable rewards, Settings). |
| `Menu.jsx` | 40 | The main menu: logo, **Start / Continue Adventure** (shows the next track), World Map, Garage, Missions, Settings, the coins and stars, and your kart turning on its stand. |
| `MapScreen.jsx` | 68 | The world map: 12 track cards with a picture, number, stars and a lock. The panel on the side shows the chosen track: picture, laps, shortcut name, description, the 3 tasks, best time and best lap, and **START RACE** (only if the track is open). |
| `Garage.jsx` | 138 | The garage with four tabs. **Kart**: browse the 5 karts, see their stats, buy or equip, and choose paint. **Driver** and **Wings**: buy and equip. **Upgrades**: 4 upgrades with 5 levels each, the price of the next level and the new stats. |
| `GaragePreview.jsx` | 41 | A small 3D scene with the kart on a turntable. It turns by itself; you can drag it to turn it. Used by the garage and the main menu. |
| `Missions.jsx` | 39 | The list of 20 missions with a progress bar and the reward. Finished missions get a **CLAIM** button; claimed ones show a tick. |
| `SettingsScreen.jsx` | 21 | The settings page. It shows the settings panel from `Pause.jsx` inside the menu frame, plus **Reset all progress** (it asks "Delete ALL progress, coins and karts?" before doing it). |
| `Pause.jsx` | 72 | The **pause menu** (Resume, Restart race, Settings, Quit to map) and the **settings panel** used in two places: master / music / effects volume, mute, auto-accelerate, steering sensitivity, vibration, show FPS and graphics quality. |
| `Results.jsx` | 57 | After a race: big position, stars, the 4 finishers with times, your time ("NEW BEST TIME!"), each reward line and the total, the 3 track tasks, "New track unlocked", and **NEXT TRACK**, **REPLAY**, **MAP**. |

## src/game/ - data, rules, simulation, 3D, sound, input

This folder holds the game itself. None of these files use React. Many of them (marked **Node**) do not use the browser at all, so the test programs can run them directly.

| File | Lines | Node | What it does |
|---|---|---|---|
| `tracks.js` | 239 | yes | The **12 track definitions** as plain data: name, description, difficulty, the 3 tasks, road width, the curve points, colours (sky, fog, ground, road, walls), weather, scenery list, landmarks, music, and a recipe for pads, ramps, hazards and the shortcut. |
| `karts.js` | 100 | yes | The **shop catalogue**: 5 karts with prices, weights and stats; 8 paints; 5 drivers; 4 wings; upgrade prices; and `simStats()`, which turns stats (1 to 10) into real numbers: top speed, acceleration, steering speed, boost. Also the 6 rival drivers and how strong they are on each track. |
| `progress.js` | 140 | yes | The **rules that change the save**: coins for each place, stars, unlocking the next track, track tasks, the 20 missions, claiming, buying and equipping. Every function returns a new save and never changes the old one. |
| `save.js` | 90 | yes | The **save**: its shape, the default save, `sanitize()` (turns any broken or edited save into a valid one), loading from and writing to `localStorage`. A broken save is kept aside under a second key. |
| `autoplace.js` | 150 | yes | Looks at how curved each part of the road is and **places the gameplay objects**: boost pads and ramps on straights, sand / mud / ice zones, swinging boulders, coin lines, and where the shortcut leaves and rejoins the road. Always the same result for a track (seeded). |
| `trackBuild.js` | 339 | yes | Turns a track's curve into **road samples every 2 m** (position, direction, side, curve), builds the shortcut road, checkpoints, walls and coins, and answers "**where is this kart?**" (`locate`): which sample, how far from the centre, on the shortcut or not. |
| `setup.js` | 29 | yes | Builds the **4 racers** for a race: you (from the garage: kart, upgrades, paint, driver, wing) and 3 rivals (chosen by the track number). |
| `sim.js` | 417 | yes | The **race simulation**, 60 steps per second: countdown, speed, steering, drifting and mini-boosts, the boost bar, pads, ramps and jumps, surfaces, walls, bumps between karts, swinging obstacles, coins, checkpoints, laps, positions, safe recovery, finish and results. |
| `ai.js` | 108 | yes | The **computer drivers**: follow the road with a lane of their own, slow down for curves, use boost on straights, sometimes take the shortcut, and stay close to the player (rubber band). |
| `input.js` | 86 | | Reads the **keyboard, a gamepad and the touch buttons** and merges them into one `input` object (steer, gas, brake, drift, boost, look back, reset). Clears everything when the window loses focus. |
| `audio.js` | 220 | | **All sound, made in code**: engine, drift, coins, boost, jumps, hits, countdown, menu clicks, and a short music loop per track plus menu music. Uses Howler to play them. Nothing starts before the first tap or key press. |
| `bus.js` | 7 | | A tiny shared object (`window.__sky`): the race world, short messages, FPS and picture scale. The HUD reads it; the tests use it to drive the game. |
| `geo.js` | 46 | | Helpers for **low-poly shapes**: boxes, cylinders, cones, spheres and more, each with a colour, merged into one shape. Also a seeded random generator. |
| `kartModel.js` | 92 | | Builds the **3D kart and driver** from simple shapes, with the chosen paint, helmet colours and wing. Used in the race and the garage. |
| `props.js` | 74 | | The **scenery models**: palms, pines, cacti, pillars, coral, maple trees, mushrooms, moon rocks, towers and more, plus big landmarks (lighthouse, pyramid, volcano, castle...). |
| `biomes.js` | 2 | | Says which scenery models a track uses (keeps `world3d.js` general). |
| `world3d.js` | 477 | | Builds the **world that does not move**, once per race: road, kerbs, walls, start gate, checkpoint flags, pads, ramps, the shortcut road, the floating island with its cliffs, scenery (thousands of copies drawn in a few batches), landmarks, small islands around. |
| `visuals.js` | 300 | | Everything that **moves on screen**: karts (smoothly between simulation steps), coins, swinging boulders, the chase camera, the sky and sun, clouds, weather (snow, rain, embers, leaves...), lightning, aurora, sparks and dust. |

## public/ - copied into the finished game unchanged

| File | What it does |
|---|---|
| `icon.svg` | The game icon (browser tab and home screen). |
| `manifest.webmanifest` | Name, colours and icon for "Add to home screen" on phones. Landscape is preferred. |
| `sw.js` | The **service worker**: after the first visit it keeps a copy of the game so it can start without internet. New versions are picked up when online. |
| `previews/*.jpg` | 12 pictures of the tracks seen from above, shown on the map. Made by `scripts/make-previews.mjs` from the game itself. |

## scripts/ - tests and tools

These are run with Node.js from the project folder. They are not part of the game and are not uploaded.

| File | Lines | What it does | Needs |
|---|---|---|---|
| `lib/cdp.mjs` | 76 | Starts a hidden Chrome, opens the built game and lets a script press keys, touch the screen, read values and take pictures. | Chrome |
| `lib/network.mjs` | 37 | Finds the PC's address on the home Wi-Fi and a free port. | |
| `check-tracks.mjs` | 116 | Checks that every track is a closed smooth loop, does not touch itself, has sane corners, a straight start, ordered checkpoints, a shorter shortcut, pads, ramps, coins on the road and tasks. | |
| `check-save.mjs` | 136 | 27 checks of saving and rules: broken saves, stars, unlocking, no double rewards, missions, purchases, upgrades, equipment. | |
| `check-sim.mjs` | 32 | Runs a full 3-lap race on every track with all karts driven by the AI and checks that everyone finishes. | |
| `check-gameplay.mjs` | 167 | 31 checks of the driving rules: laps need checkpoints, ramps, low gravity, boost, drifting, pads, walls, braking, recovery, bumps, kart stats, and that every shortcut is faster. | |
| `browser-test.mjs` | 255 | 76 checks in real Chrome: menus, buttons, keys, pause, rewards, saving and reloading, garage, broken saves, settings, all 12 tracks finished, phone touch and screen sizes. | Chrome, `dist/` |
| `bot-balance.mjs` | 48 | Races simulated "casual" and "good" players on every track to see how hard the campaign is. | |
| `perf-report.mjs` | 31 | Measures draw calls, triangles and JavaScript time on every track at low, medium and high quality. | Chrome, `dist/` |
| `play.mjs` | 56 | Serves `dist/` on the PC and the local network, opens the browser, prints the phone address and a QR code. | `dist/` |
| `make-previews.mjs` | 7 | Remakes the 12 map pictures in `public/previews` (runs `tour.mjs`). | Chrome, `dist/` |
| `tour.mjs` | 34 | Takes a picture of every track, from above or while driving. | Chrome, `dist/` |
| `shot.mjs` | 28 | Quick pictures of the menu, map, garage and one race. | Chrome, `dist/` |
| `screens.mjs` | 22 | A picture of every menu screen at any screen size (for checking phone layouts). | Chrome, `dist/` |
| `guide-shots.mjs` | 68 | Takes the pictures used in this guide. | Chrome, `dist/` |
| `build-guide.mjs` | 327 | Turns the chapters in `docs/guide/` into this PDF, using Chrome's "print to PDF". | Chrome |

## docs/ - the documents

| File | What is in it |
|---|---|
| `01-controls-and-features.md` | Keys, gamepad and touch controls; how races, stars, rewards, missions, the garage and saving work. |
| `02-architecture.md` | A short version of chapters 2 and 3 of this guide. |
| `03-setup-and-deploy.md` | Install, run, build and put online. |
| `04-testing-report.md` | What was tested, the results, the performance numbers, what was not tested. |
| `05-asset-credits.md` | Where every picture and sound comes from (all made in code) and the library licences (all MIT). |
| `06-known-issues.md` | Known limits and ideas for later. |
| `guide/` | The 9 chapters of this PDF (Markdown), `images/` and `diagrams/`. |
| `Sky-Kart-3D-Complete-Guide.pdf` | This document. |

## dist/ - the finished game

`npm run build` reads `index.html`, everything in `src/` and `public/`, and writes the finished game into `dist/`. This folder is **all you upload** to a web host. The file names inside `assets/` contain a code (for example `index-Ba7Aa88X.js`) that changes whenever the content changes, so browsers never use an old copy.

```tree
dist/
├── index.html                    1 KB   the page
├── icon.svg, manifest.webmanifest, sw.js      copied from public/
├── previews/                   480 KB   the 12 map pictures
└── assets/
    ├── index-….js              195 KB  (64 KB zipped)   React, menus, rules, track data
    ├── index-….css              23 KB   (6 KB zipped)   all styles
    ├── three-….js              683 KB (175 KB zipped)   three.js (3D engine)
    ├── r3f-….js                138 KB  (45 KB zipped)   React Three Fiber
    ├── Race-….js                74 KB  (30 KB zipped)   race, simulation, 3D world
    ├── audio-….js               36 KB  (10 KB zipped)   Howler + the sound code
    ├── kartModel-….js            8 KB   (3 KB zipped)   the kart model
    └── GaragePreview-….js        2 KB   (1 KB zipped)   the turning kart
```

The whole `dist/` folder is **1.6 MB**, about 330 KB of zipped code. A player first downloads the page, the styles and the menu code (about 70 KB zipped), so the buttons appear quickly. three.js and React Three Fiber follow for the turning kart on the main menu, and the race code is fetched while the player looks at the map, before the first race starts.

## node_modules/ - the libraries

`npm install` downloads the libraries listed in `package.json` into this folder (about 75 MB). The game needs six of them; three more are only used while building and testing.

| Library | Version | Used for | In the finished game? |
|---|---|---|---|
| react, react-dom | 18.3 | the screens | yes |
| three | 0.169 | 3D drawing (WebGL) | yes |
| @react-three/fiber | 8.17 | puts the three.js canvas inside React and runs the frame loop | yes |
| zustand | 4.5 | the small app-state store | yes |
| howler | 2.2 | plays sounds and music on every browser | yes |
| vite | 5.4 | development server and build | no |
| @vitejs/plugin-react | 4.3 | lets Vite understand `.jsx` | no |
| qrcode-terminal | 0.12 | prints the phone QR code in `play now.cmd` | no |

All of them use the MIT licence.
