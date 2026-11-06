# Setup, run and deploy

You need **Node.js 18 or newer** (https://nodejs.org, LTS version). It was developed and tested with Node 24 on Windows 11.

## Easiest way (Windows)

Double-click **`play now.cmd`**. The first time it installs the libraries (needs internet), builds the game, starts a small web server and opens the browser. It also prints an address (and a QR code) for your phone: the phone must be on the **same Wi-Fi** as the PC. Keep the window open while playing.

## With commands

```bash
npm install          # once
npm run dev          # development server with hot reload (http://localhost:5173)
npm run build        # production build into dist/
npm run preview      # serve dist/ locally
npm run play         # serve dist/ on the local network (phone testing)
npm run check        # fast checks: track geometry, save/rules, AI races, gameplay (no browser)
npm run test:browser # full browser test (needs Chrome; see docs/04-testing-report.md)
npm run previews     # re-make the track thumbnails in public/previews (needs Chrome and a fresh build)
```

## Deploying (static hosting)

`npm run build` creates the folder **`dist/`**. It is a plain static site: copy the *contents* of `dist/` to any static host (GitHub Pages, Netlify, Cloudflare Pages, S3 + CloudFront, an nginx / Apache folder, ...). No server code is needed.

* The build uses relative paths (`base: './'`), so it works from the site root **or from a sub-folder** (for example `https://example.com/games/skykart/`).
* Serve it over **https** if possible: a service worker (offline play) and the screen wake-lock only work on https or localhost.
* Cache hint: files in `dist/assets/` have a hash in their name and can be cached for a long time; `index.html` and `sw.js` should not be cached for long.
* Nothing is sent anywhere: there is no server, no analytics, no accounts. Progress stays in the player's browser.

I did **not** deploy or publish the game anywhere.

## Folder to copy

Only `dist/` is needed to host the game. The rest is source code, tests and documents.
