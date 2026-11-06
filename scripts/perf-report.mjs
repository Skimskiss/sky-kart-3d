// Draw calls, triangles and JS time per frame for every track at each quality level (headless Chrome).
//   npm run build && node scripts/perf-report.mjs [--md]
// Frame RATE is not reported: headless Chrome draws with a software renderer, so it would say nothing about real devices.
import { serveDist, launch, sleep } from './lib/cdp.mjs';
const srv = await serveDist();
const b = await launch({ width: 844, height: 390, mobile: true });
const rows = [];
try {
  await b.goto(srv.url); await b.waitFor('!!window.__store');
  await b.eval('(() => { const s = window.__store.getState(); window.__store.setState({ save: { ...s.save, unlocked: 12 } }); })()');
  for (const q of ['low', 'medium', 'high']) {
    await b.eval(`window.__store.getState().setSetting({ quality: ${JSON.stringify(q)} })`);
    for (let i = 0; i < 12; i++) {
      await b.eval(`window.__store.getState().startRace(${i})`);
      await b.waitFor('!!(window.__sky && window.__sky.world && window.__sky.gl)', 40000);
      await b.waitFor('window.__sky.world.state === "racing"', 20000);
      await b.eval('window.__sky.autopilot = true; window.__sky.timeScale = 1;');
      await sleep(3500);
      const m = await b.eval('(() => { const i = window.__sky.gl.info; return { id: window.__sky.world.track.id, calls: i.render.calls, tris: i.render.triangles, geos: i.memory.geometries, cpu: window.__sky.cpuMs }; })()');
      rows.push({ quality: q, track: m.id, drawCalls: m.calls, triangles: m.tris, geometries: m.geos, jsMsPerFrame: +m.cpu.toFixed(2) });
      await b.eval('window.__store.getState().quitRace()'); await sleep(200);
    }
  }
} finally { await b.close(); await srv.close(); }
console.table(rows);
for (const q of ['low', 'medium', 'high']) {
  const r = rows.filter((x) => x.quality === q);
  const mx = (k) => Math.max(...r.map((x) => x[k]));
  console.log(`${q.padEnd(6)} max draw calls ${mx('drawCalls')}, max triangles ${mx('triangles')}, max JS ms/frame ${mx('jsMsPerFrame')}`);
}
process.exit(0);
