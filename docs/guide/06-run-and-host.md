# 6. Running, building and hosting

## Play on your Windows PC

1. Install **Node.js** (LTS) from nodejs.org, once.
2. Double-click **`play now.cmd`** in the project folder.

What it does, in order:

| Step | What happens | Time |
|---|---|---|
| 1 | Checks that Node.js 18 or newer is installed and explains what to do if not. | instant |
| 2 | The first time only: `npm install` downloads the libraries (needs internet). | 1 to 2 minutes |
| 3 | `npm run build` makes a fresh `dist/` (errors are shown if the build fails). | a few seconds |
| 4 | `node scripts/play.mjs` serves the game, opens your browser and prints the phone address and a QR code. | instant |

Keep the window open while you play. Close it, or press Ctrl+C, to stop. `play now.cmd --no-open` starts without opening a browser tab.

## Play on your phone

1. The phone must be on the **same Wi-Fi** as the PC (not a guest network).
2. Start `play now.cmd` on the PC.
3. Scan the QR code with the phone's camera, or type the "On your phone" address (for example `http://192.168.1.20:4173/`).
4. The first time, Windows may ask whether Node.js may use the network: tick **Private networks** and click **Allow**.
5. Turn the phone sideways for the best view. In the browser menu, "Add to Home screen" gives it its own icon and full screen.

> **Note:** If the first address does not open, the window lists other addresses of the PC to try. A VPN on the PC or the phone can block the connection.

## All the commands

Run them in a terminal in the project folder.

| Command | What it does |
|---|---|
| `npm install` | Downloads the libraries into `node_modules/`. Needed once, and again after `package.json` changes. |
| `npm run dev` | Development server at `http://localhost:5173` that reloads as you change the code. Add `-- --host` to open it from a phone too. |
| `npm run build` | Makes the finished game in `dist/`. |
| `npm run preview` | Serves `dist/` on this PC only, to check the build. |
| `npm run play` | Serves `dist/` on this PC and the Wi-Fi (what `play now.cmd` uses). |
| `npm run check` | The four Node test programs (tracks, save and rules, AI races, gameplay). About 2 minutes. |
| `npm run test:browser` | The full browser test in Chrome (needs a fresh build). About 10 minutes. `node scripts/browser-test.mjs --quick` skips the 12-track loop. |
| `npm run balance` | The difficulty check with simulated players. `KART=skyhawk UPG=2` in front tests another kart and upgrade level. |
| `npm run previews` | Remakes the map pictures in `public/previews` (needs a fresh build, then build again to copy them into `dist/`). |
| `npm run guide` | Makes this PDF from `docs/guide/`. `node scripts/guide-shots.mjs` remakes its pictures first. |

If Chrome is not in its usual folder, set `CHROME_PATH` to `chrome.exe` before the browser scripts.

## Putting the game online

`npm run build` makes `dist/`, a plain static website: HTML, JavaScript, CSS and pictures. **Upload the contents of `dist/`** to any static host. No server program, database or account is needed.

| Host | How |
|---|---|
| Netlify | Drag the `dist` folder onto app.netlify.com/drop. |
| Vercel | Import the project; framework "Vite", build command `npm run build`, output folder `dist`. |
| GitHub Pages | Put the contents of `dist/` on a branch of their own (for example `gh-pages`) and turn on Pages for that branch. |
| Cloudflare Pages | Build command `npm run build`, output folder `dist`. |
| Your own server | Copy the files in `dist/` into any folder served by nginx, Apache or IIS. |

Things worth knowing:

* The game uses **relative paths** (`base: './'`), so it works at the root of a site **or in a sub-folder** like `example.com/games/skykart/`.
* Use **https** if you can: offline play (the service worker) and keeping the screen awake during races only work on https (or on localhost).
* Files in `dist/assets/` have a code in their name and can be cached for a long time. `index.html` and `sw.js` should not be cached for long, so players get new versions.
* Nothing is sent anywhere. There are no accounts, no analytics and no ads. Each player's progress stays in their own browser.

> **Note:** The game has **not** been put online. Nothing was uploaded or published.

## When something goes wrong

| Problem | What to do |
|---|---|
| "Node.js was not found" | Install the LTS version from nodejs.org, then run `play now.cmd` again. |
| "Could not install the game's libraries" | Check the internet connection, then run it again. |
| The phone cannot open the address | Same Wi-Fi? Allow Node.js through the Windows firewall (Private networks). Try the other addresses printed. Switch off VPNs. |
| The game is slow or hot on a phone | Settings → Graphics quality → Low. Close other apps. Turn on "Show FPS" to see the frame rate. |
| No sound | Tap the screen once (browsers block sound before a tap). Check Mute and the volume sliders, and the phone's silent switch. |
| Progress disappeared | Progress is stored per browser and per address. A different browser, a private window, clearing site data, or a different address (localhost vs. the Wi-Fi address) each have their own save. |
| Browser scripts fail with "Chrome did not start" | Install Chrome or set `CHROME_PATH`. Make sure the disk is not full. |
