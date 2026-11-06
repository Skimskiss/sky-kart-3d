// Helpers for serving the game on the local network (so a phone on the same Wi-Fi can open it).
import os from 'node:os';
import net from 'node:net';

const PRIVATE = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;
// adapters that exist on the PC but are not the network a phone is on
const VIRTUAL = /vethernet|virtualbox|vbox|vmware|hyper-v|wsl|docker|bluetooth|loopback|tailscale|zerotier|vpn|\btap\b|\btun\b|host-only|pseudo/i;

// IPv4 addresses of this machine that other devices could reach, best guess first:
// real adapters before virtual ones, private (home / office) ranges before anything else.
export function lanAddresses(interfaces = os.networkInterfaces()) {
  const found = [];
  for (const [name, list] of Object.entries(interfaces)) {
    for (const a of list || []) {
      if (a.family !== 'IPv4' && a.family !== 4) continue; // newer Node reports the family as a number
      if (a.internal) continue;
      if (a.address.startsWith('169.254.')) continue; // link-local: the adapter has no real network
      found.push({ name, address: a.address, virtual: VIRTUAL.test(name), private: PRIVATE.test(a.address) });
    }
  }
  found.sort((x, y) => Number(x.virtual) - Number(y.virtual) || Number(y.private) - Number(x.private));
  return found;
}

// First free TCP port at or after `start` (on every interface, which is how the game is served).
export function freePort(start, tries = 40) {
  return new Promise((resolve, reject) => {
    let port = start, left = tries;
    const attempt = () => {
      const probe = net.createServer();
      probe.once('error', () => { if (--left <= 0) reject(new Error('no free port found')); else { port++; attempt(); } });
      probe.once('listening', () => probe.close(() => resolve(port)));
      probe.listen(port, '0.0.0.0');
    };
    attempt();
  });
}
