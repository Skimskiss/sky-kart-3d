// Serves the built game on this PC AND on your local network, so you can play on a phone too.
//   node scripts/play.mjs [--no-open] [--port 4173]
// Run "npm run build" first ("play now.cmd" does that for you).
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { preview } from 'vite';
import { lanAddresses, freePort } from './lib/network.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
process.chdir(root);

const args = process.argv.slice(2);
const noOpen = args.includes('--no-open');
const portArg = args.indexOf('--port');
const wantPort = portArg >= 0 ? Number(args[portArg + 1]) || 4173 : 4173;

if (!existsSync(`${root}dist/index.html`)) {
  console.error('\n  The game has not been built yet. Run "npm run build" first (play now.cmd does this for you).\n');
  process.exit(1);
}

let qr = null;
try { qr = (await import('qrcode-terminal')).default; } catch { /* the QR code is a nicety; the address is still printed */ }

const port = await freePort(wantPort);
const server = await preview({ root, logLevel: 'warn', preview: { host: '0.0.0.0', port, strictPort: true, open: !noOpen } });

const addrs = lanAddresses();
const line = '  ' + '='.repeat(58);
console.log(`\n${line}\n    SKY KART 3D is running\n${line}\n`);
console.log(`    On this PC:      http://localhost:${port}/`);

if (addrs.length) {
  const phoneUrl = `http://${addrs[0].address}:${port}/`;
  console.log(`    On your phone:   ${phoneUrl}     (${addrs[0].name})`);
  if (qr) {
    console.log('\n    ...or scan this with your phone camera:\n');
    qr.generate(phoneUrl, { small: true }, (code) => console.log(code.split('\n').map((l) => '      ' + l).join('\n')));
  }
  console.log('    Phone tips:');
  console.log('      - The phone must be on the same Wi-Fi as this PC (not a guest network).');
  console.log('      - The first time, Windows may ask about "Node.js": tick "Private networks" and click Allow.');
  // other real adapters only (VMware / WSL / VPN adapters are not reachable from a phone)
  const others = addrs.slice(1).filter((a) => !a.virtual);
  if (others.length) {
    console.log('      - If that address does not open, try one of these instead:');
    for (const a of others) console.log(`          http://${a.address}:${port}/     (${a.name})`);
  }
} else {
  console.log('\n    No Wi-Fi / network connection was found, so phone play is not available right now.');
}
console.log('\n    Keep this window open while you play. Close it (or press Ctrl+C) to stop the game.\n');

const stop = async () => { try { await server.close(); } finally { process.exit(0); } };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
