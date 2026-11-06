// Regenerates the track thumbnails in public/previews (needs a fresh `npm run build`; uses headless Chrome).
//   node scripts/make-previews.mjs
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const here = fileURLToPath(new URL('.', import.meta.url));
const r = spawnSync(process.execPath, [`${here}tour.mjs`, `${here}../public/previews`, 'aerial', '640', '400'], { stdio: 'inherit' });
process.exit(r.status || 0);
