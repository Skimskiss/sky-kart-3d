// End-to-end tests in a real (headless) Chrome against the production build in dist/.
//   npm run build && node scripts/browser-test.mjs [--quick]      (--quick skips the 12-track race loop)
// NOTE: headless Chrome renders WebGL in software, so frame rates here say NOTHING about real phones or PCs.
import { mkdirSync, writeFileSync } from 'node:fs';
import { serveDist, launch, sleep } from './lib/cdp.mjs';

const quick = process.argv.includes('--quick');
const out = 'scripts/out/browser';
mkdirSync(out, { recursive: true });
const srv = await serveDist();
const results = [];
const check = (name, cond, info = '') => { results.push({ name, ok: !!cond, info }); console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${name}${info ? '  (' + info + ')' : ''}`); if (!cond) process.exitCode = 1; };
const S = (b, expr) => b.eval(`(${expr})(window.__store.getState())`);
const save = (b) => b.eval('JSON.parse(localStorage.getItem("skykart3d.save.v1") || "null")');
const text = (b) => b.eval('document.body.innerText');
const key = async (b, type, code) => b.key(type, code);
const OVERFLOW = `(() => { const bad = []; for (const e of document.querySelectorAll('.app *')) { const r = e.getBoundingClientRect(); if (r.width > 0 && r.height > 0 && (r.right > innerWidth + 2 || r.left < -2) && getComputedStyle(e).position !== 'fixed') { let p = e.parentElement, scrolls = false; while (p && p !== document.body) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') { const pr = p.getBoundingClientRect(); if (pr.right <= innerWidth + 2) { scrolls = true; break; } } p = p.parentElement; } if (!scrolls) bad.push((e.className && e.className.baseVal === undefined ? e.className : e.tagName) + ':' + Math.round(r.right)); } } return bad.slice(0, 5); })()`;
const tap = async (b, code, ms = 100) => { await key(b, 'keyDown', code); await sleep(ms); await key(b, 'keyUp', code); };

let b = await launch({ width: 1280, height: 720 });
try {
  console.log('Menus and navigation');
  await b.goto(srv.url);
  await b.waitFor('!!document.querySelector(".menu")');
  let t = await text(b);
  check('main menu shows the title and all buttons', /Start Adventure|Continue Adventure/i.test(t) && /World Map/i.test(t) && /Garage/i.test(t) && /Missions/i.test(t) && /Settings/i.test(t));
  await b.clickText('Settings'); check('Settings button opens settings', /SETTINGS/.test(await text(b)) && !!(await b.eval('document.querySelector(".settings-screen")')));
  await b.clickText('Campaign'); check('Campaign tab opens the map with 12 track cards', (await b.eval('document.querySelectorAll(".track-card").length')) === 12);
  check('only the first track is unlocked at the start', (await b.eval('document.querySelectorAll(".track-card.locked").length')) === 11);
  await b.clickText('Garage'); await sleep(1500); check('Garage opens with a 3D preview canvas', !!(await b.eval('document.querySelector(".preview3d canvas")')));
  await b.clickText('Missions'); check('Missions screen lists missions', (await b.eval('document.querySelectorAll(".mission").length')) >= 10);
  await b.clickText('Campaign');
  await b.shot(`${out}/map-1280.png`);

  console.log('Locked track / start race with the keyboard');
  await b.eval('document.querySelectorAll(".track-card")[5].click()'); await sleep(200);
  check('a locked track cannot be started (button disabled)', await b.eval('[...document.querySelectorAll(".detail .btn")].every((x) => x.disabled)'));
  await b.eval('document.querySelectorAll(".track-card")[0].click()'); await sleep(200);
  await b.clickText('START RACE');
  await b.waitFor('!!(window.__sky && window.__sky.world && window.__sky.visuals)', 40000);
  check('race screen starts (canvas + HUD)', !!(await b.eval('document.querySelector(".race-root canvas")')) && !!(await b.eval('document.querySelector(".hud")')));
  await b.waitFor('window.__sky.world.state === "racing"', 15000);
  check('countdown finishes and the race begins', true);
  await key(b, 'keyDown', 'ArrowUp'); await sleep(2500);
  let w = await b.eval('({ sp: window.__sky.world.player.speed, steer: window.__sky.input.steer, thr: window.__sky.input.throttle })');
  check('ArrowUp accelerates the kart', w.thr === 1 && w.sp > 15, `speed ${w.sp.toFixed(1)}`);
  await key(b, 'keyDown', 'ArrowLeft'); await sleep(300);
  w = await b.eval('({ steer: window.__sky.input.steer })'); check('ArrowLeft steers left', w.steer === -1);
  await key(b, 'keyUp', 'ArrowLeft'); await key(b, 'keyDown', 'Space'); await key(b, 'keyDown', 'ShiftLeft'); await sleep(200);
  w = await b.eval('({ d: window.__sky.input.drift, bo: window.__sky.input.boost })'); check('Space = drift and Shift = boost are read together with the gas key', w.d && w.bo);
  await key(b, 'keyUp', 'Space'); await key(b, 'keyUp', 'ShiftLeft');
  await key(b, 'keyDown', 'ArrowDown'); await sleep(200); w = await b.eval('({ b: window.__sky.input.brake })'); check('ArrowDown brakes', w.b === 1);
  await key(b, 'keyUp', 'ArrowDown'); await key(b, 'keyUp', 'ArrowUp');

  console.log('Pause and focus loss');
  await key(b, 'keyDown', 'ArrowUp');
  await tap(b, 'Escape'); await sleep(300);
  check('Escape opens the pause menu', await b.eval('!!document.querySelector(".overlay") && /paused/i.test(document.body.innerText)'));
  const t0 = await b.eval('window.__sky.world.time'); await sleep(1200); const t1 = await b.eval('window.__sky.world.time');
  check('simulation time stands still while paused', Math.abs(t1 - t0) < 0.001, `${t0.toFixed(3)} -> ${t1.toFixed(3)}`);
  await key(b, 'keyUp', 'ArrowUp'); await sleep(100);
  check('held keys are cleared when paused/released', (await b.eval('window.__sky.input.throttle')) === 0);
  await b.clickText('Resume'); await sleep(300);
  check('Resume closes the pause menu', !(await b.eval('!!document.querySelector(".overlay")')));
  await key(b, 'keyDown', 'ArrowUp'); await sleep(300);
  await b.eval('window.dispatchEvent(new Event("blur"))'); await sleep(300);
  check('losing window focus pauses the race and clears held input', (await b.eval('window.__store.getState().paused')) === true && (await b.eval('window.__sky.input.throttle')) === 0);
  await key(b, 'keyUp', 'ArrowUp');
  await b.clickText('Resume');
  await tap(b, 'Escape'); await sleep(300);
  await b.clickText('Settings'); check('Settings is reachable from the pause menu', /Master volume/.test(await text(b)));
  await b.eval('window.__store.getState().openSettings(false)'); await b.eval('window.__store.getState().setPaused(true)'); await sleep(200);
  await b.shot(`${out}/pause.png`);
  await b.clickText('Resume');

  console.log('Finish a race, rewards, saving');
  const before = await save(b);
  await b.eval('window.__sky.autopilot = true; window.__sky.timeScale = 8;');
  await b.waitFor('window.__store.getState().screen === "results"', 120000);
  await sleep(500);
  let sv = await save(b);
  const res = await S(b, 's => s.results.summary');
  check('results screen appears after the race', /RACE COMPLETE/.test(await text(b)));
  check('finishing gave coins and they were saved to localStorage', sv && sv.coins > ((before && before.coins) || 0) && sv.coins === res.total, `+${res.total} coins, position ${res.pos}`);
  check('the next track is unlocked and the star count is saved', sv.unlocked === 2 && sv.tracks.tropical.stars >= 1, `stars ${sv.tracks.tropical.stars}`);
  check('best time is stored', sv.tracks.tropical.best > 30);
  await b.shot(`${out}/results.png`);
  const coinsAfter = sv.coins;

  await b.goto(srv.url); await b.waitFor('!!document.querySelector(".menu")');
  sv = await save(b);
  check('progress survives a page reload', sv.coins === coinsAfter && sv.unlocked === 2 && (await S(b, 's => s.save.unlocked')) === 2);
  await b.clickText('Continue Adventure');
  check('Continue Adventure goes to the map with the next unfinished track selected', (await S(b, 's => s.screen')) === 'map' && (await S(b, 's => s.selected')) === 1);

  console.log('Missions');
  await b.clickText('Missions');
  const claimables = await b.eval('[...document.querySelectorAll(".mission")].filter((m) => { const btn = m.querySelector("button"); return btn && !btn.disabled; }).map((m) => m.dataset.id)');
  check('completed missions show an enabled CLAIM button', claimables.length >= 1, claimables.join(','));
  const c0 = (await save(b)).coins;
  await b.eval('document.querySelector(".mission button:not([disabled])").click()'); await sleep(300);
  const c1 = (await save(b)).coins;
  check('claiming adds the reward once', c1 > c0, `${c0} -> ${c1}`);
  await b.eval('[...document.querySelectorAll(".mission")].forEach((m) => { const x = m.querySelector("button"); if (x && !x.disabled) x.click(); })'); await sleep(200);
  const claimedId = claimables[0];
  const sv2 = await save(b); const c2 = sv2.coins;
  await b.eval(`window.__store.getState().claim(${JSON.stringify(claimedId)})`); await sleep(100);
  check('the same reward cannot be claimed twice', (await save(b)).coins === c2);
  await b.goto(srv.url); await b.waitFor('!!document.querySelector(".menu")');
  check('claimed missions stay claimed after reload', (await save(b)).claimed[claimedId] === true);

  console.log('Results and pause buttons');
  await b.eval('window.__store.getState().startRace(0)'); await b.waitFor('!!(window.__sky && window.__sky.world)', 40000);
  await b.eval('window.__sky.autopilot = true; window.__sky.timeScale = 9;');
  await b.waitFor('window.__store.getState().screen === "results"', 120000); await sleep(400);
  check('results screen has NEXT TRACK, REPLAY and MAP buttons', /NEXT TRACK/.test(await text(b)) && /REPLAY/.test(await text(b)) && /MAP/.test(await text(b)));
  await b.clickText('NEXT TRACK'); await b.waitFor('!!(window.__sky && window.__sky.world)', 40000);
  check('NEXT TRACK starts the next track', (await S(b, 's => s.screen')) === 'race' && (await S(b, 's => s.trackIndex')) === 1);
  await b.waitFor('window.__sky.world.state === "racing"', 15000); await sleep(1500);
  const rk0 = await S(b, 's => s.raceKey');
  await tap(b, 'Escape'); await sleep(300); await b.clickText('Restart race'); await b.waitFor('!!(window.__sky && window.__sky.world)', 40000);
  check('Restart race in the pause menu restarts the race', (await S(b, 's => s.raceKey')) === rk0 + 1 && (await b.eval('window.__sky.world.time')) < 3);
  await b.waitFor('window.__sky.world.state === "racing"', 15000);
  await tap(b, 'Escape'); await sleep(300); await b.clickText('Quit to map'); await sleep(300);
  check('Quit to map leaves the race', (await S(b, 's => s.screen')) === 'map');
  await b.eval('window.__store.getState().startRace(0)'); await b.waitFor('!!(window.__sky && window.__sky.world)', 40000);
  await b.eval('window.__sky.autopilot = true; window.__sky.timeScale = 9;');
  await b.waitFor('window.__store.getState().screen === "results"', 120000); await sleep(400);
  await b.clickText('REPLAY'); await b.waitFor('!!(window.__sky && window.__sky.world)', 40000);
  check('REPLAY restarts the same track', (await S(b, 's => s.screen')) === 'race' && (await S(b, 's => s.trackIndex')) === 0);
  await b.eval('window.__sky.autopilot = true; window.__sky.timeScale = 9;');
  await b.waitFor('window.__store.getState().screen === "results"', 120000); await sleep(400);
  await b.clickText('MAP', '.res-btns button'); await sleep(300);
  check('MAP returns to the world map', (await S(b, 's => s.screen')) === 'map');
  await b.clickText('Settings', '.bottomnav button'); await sleep(200); await b.clickText('Campaign', '.bottomnav button'); await sleep(200);
  await b.eval('document.querySelector(".logo-btn").click()'); await sleep(200);
  check('the logo button returns to the main menu', (await S(b, 's => s.screen')) === 'menu');

  console.log('Garage: purchase, equip, upgrade, reload');
  await b.eval('(() => { const s = window.__store.getState(); const n = { ...s.save, coins: 6000 }; localStorage.setItem("skykart3d.save.v1", JSON.stringify(n)); window.__store.setState({ save: n }); })()');
  await b.eval('window.__store.getState().go("garage")'); await sleep(1500);
  await b.clickText('Sprout', '.chip'); await sleep(200);
  await b.clickText('BUY ·'); await sleep(300);
  sv = await save(b);
  check('buying a kart takes the coins and equips it', sv.garage.owned.includes('sprout') && sv.garage.kart === 'sprout' && sv.coins === 6000 - 700, `coins ${sv.coins}`);
  await b.clickText('UPGRADES', '.gtabs button'); await sleep(200);
  await b.eval('document.querySelector(".upgrades button").click()'); await sleep(300);
  sv = await save(b); check('an upgrade is bought and saved', sv.garage.upgrades.sprout && sv.garage.upgrades.sprout.spd === 1 && sv.coins === 6000 - 700 - 150, JSON.stringify(sv.garage.upgrades));
  await b.clickText('KART', '.gtabs button'); await sleep(200);
  await b.eval('document.querySelectorAll(".swatch")[3].click()'); await sleep(200);
  await b.clickText('BUY PAINT'); await sleep(300);
  sv = await save(b); check('a paint is bought and equipped for that kart', sv.garage.paints.sprout === 'ocean');
  await b.clickText('Comet', '.chip'); await sleep(200); await b.clickText('EQUIP'); await sleep(200);
  await b.clickText('Sprout', '.chip'); await sleep(200); await b.clickText('EQUIP'); await sleep(200);
  sv = await save(b); check('equipment selection works (comet and back to sprout)', sv.garage.kart === 'sprout');
  await b.shot(`${out}/garage.png`);
  await b.goto(srv.url); await b.waitFor('!!document.querySelector(".menu")');
  sv = await save(b); check('garage purchases survive a reload', sv.garage.owned.includes('sprout') && sv.garage.kart === 'sprout' && sv.garage.paints.sprout === 'ocean');
  await b.eval('window.__store.getState().startRace(0)'); await b.waitFor('!!(window.__sky && window.__sky.world)', 40000);
  const ps = await b.eval('({ id: window.__sky.world.player.look.kartId, ms: window.__sky.world.player.maxSpeed, body: window.__sky.world.player.look.body })');
  check('the equipped kart and its upgrade are used in the race (stats affect gameplay)', ps.id === 'sprout' && Math.abs(ps.ms - (30 + 4.6)) < 0.01 && ps.body === '#0ea5e9', `maxSpeed ${ps.ms}`);
  await b.eval('window.__store.getState().quitRace()');

  console.log('Invalid save data');
  await b.eval('localStorage.setItem("skykart3d.save.v1", "{{{ definitely not json")'); await b.goto(srv.url);
  await b.waitFor('!!document.querySelector(".menu")');
  check('a corrupt save falls back to a fresh game without crashing', (await S(b, 's => s.save.coins')) === 0 && /start adventure/i.test(await text(b)));
  await b.eval('localStorage.setItem("skykart3d.save.v1", JSON.stringify({ coins: "x", unlocked: 99, garage: { kart: "nope", owned: [1, 2] } }))'); await b.goto(srv.url);
  await b.waitFor('!!document.querySelector(".menu")');
  check('a nonsense save is repaired', (await S(b, 's => s.save.unlocked')) === 12 && (await S(b, 's => s.save.garage.kart')) === 'comet');
  await b.eval('localStorage.removeItem("skykart3d.save.v1")'); await b.goto(srv.url);

  console.log('Settings');
  await b.waitFor('!!document.querySelector(".menu")');
  await b.eval('window.__store.getState().go("settings")'); await sleep(300);
  await b.eval('document.querySelector(\'button[aria-label="Auto-accelerate (touch)"]\').click()'); await sleep(200);
  await b.eval('document.querySelector(\'button[aria-label="Mute all sound"]\').click()'); await sleep(200);
  sv = await save(b); check('settings toggles are saved', sv.settings.autoGas === false && sv.settings.muted === true);
  await b.clickText('low', '.seg button'); sv = await save(b); check('graphics quality can be set', sv.settings.quality === 'low');
  await b.eval('document.querySelector(\'button[aria-label="Mute all sound"]\').click()'); await b.clickText('auto', '.seg button');

  if (!quick) {
    console.log('All 12 tracks: start, race with autopilot, finish, results');
    await b.eval('(() => { const s = window.__store.getState(); const n = { ...s.save, unlocked: 12 }; window.__store.setState({ save: n }); })()');
    const rows = [];
    for (let i = 0; i < 12; i++) {
      await b.eval(`window.__store.getState().startRace(${i})`);
      await b.waitFor('!!(window.__sky && window.__sky.world && window.__sky.visuals)', 40000);
      await b.eval('window.__sky.autopilot = true; window.__sky.timeScale = 9;');
      let done = true;
      try { await b.waitFor('window.__store.getState().screen === "results"', 150000); } catch { done = false; }
      const r = done ? await S(b, 's => ({ sum: s.results.summary, rows: s.results.rows })') : null;
      const info = await b.eval('window.__sky.world ? ({ id: window.__sky.world.track.id, laps: window.__sky.world.player.lapTimes.length }) : null');
      rows.push({ track: i + 1, done, pos: r && r.sum.pos, time: r && r.sum.time && +r.sum.time.toFixed(1), laps: info && info.laps });
      check(`track ${i + 1} is playable and finishable (autopilot)`, done && r.sum.finished && r.rows.length === 4, r ? `pos ${r.sum.pos}, ${r.sum.time.toFixed(1)}s` : 'timeout');
    }
    console.table(rows);
    sv = await save(b); check('all 12 tracks unlocked / finished states saved', sv && Object.keys(sv.tracks).length === 12, `${Object.keys(sv.tracks).length} tracks recorded`);
  }
  const bad = b.logs.filter((l) => l.type === 'error' || l.type === 'exception' || l.type === 'warning');
  check('no console errors or warnings during the whole run', bad.length === 0, bad.slice(0, 3).map((x) => x.text.slice(0, 120)).join(' | '));
} catch (e) {
  console.log('TEST ERROR:', e.message); process.exitCode = 1;
  try { await b.shot(`${out}/error.png`); } catch { /* ignore */ }
} finally { await b.close(); }

// ----- touch + responsive layout in a phone-sized window -----
console.log('Phone: touch controls, simultaneous touches, orientation');
b = await launch({ width: 844, height: 390, mobile: true });
try {
  await b.goto(srv.url); await b.waitFor('!!document.querySelector(".menu")');
  await b.eval('window.__store.getState().startRace(0)'); await b.waitFor('!!(window.__sky && window.__sky.world)', 40000);
  await b.waitFor('window.__sky.world.state === "racing"', 15000);
  const r = (sel) => b.eval(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); const q = e.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2, q.width]; })()`);
  check('touch UI is shown (joystick + 3 big buttons)', !!(await b.eval('document.querySelector(".joy")')) && (await b.eval('document.querySelectorAll(".tbtn").length')) === 3);
  check('auto-accelerate is on by default (no GAS button)', !(await b.eval('!!document.querySelector(".tbtn.gas")')));
  const joy = await r('.joy'), drift = await r('.tbtn.drift'), boost = await r('.tbtn.boost'), brake = await r('.tbtn.brake');
  check('buttons are large enough for thumbs (>= 70 px)', drift[2] >= 70 && boost[2] >= 70 && brake[2] >= 60, `drift ${Math.round(drift[2])}px boost ${Math.round(boost[2])}px brake ${Math.round(brake[2])}px`);
  await b.touch('touchStart', [{ x: joy[0] + 50, y: joy[1], id: 1 }, { x: drift[0], y: drift[1], id: 2 }, { x: boost[0], y: boost[1], id: 3 }]); await sleep(500);
  let st = await b.eval('({ steer: window.__sky.input.steer, drift: window.__sky.input.drift, boost: window.__sky.input.boost, thr: window.__sky.input.throttle })');
  check('three simultaneous touches work (steer + drift + boost, gas is automatic)', st.steer > 0.3 && st.drift && st.boost && st.thr === 1, JSON.stringify(st));
  await b.touch('touchMove', [{ x: joy[0] - 60, y: joy[1], id: 1 }, { x: drift[0], y: drift[1], id: 2 }, { x: boost[0], y: boost[1], id: 3 }]); await sleep(200);
  st = await b.eval('({ steer: window.__sky.input.steer })'); check('joystick is analog and steers the other way', st.steer < -0.3, `steer ${st.steer.toFixed(2)}`);
  await b.touch('touchStart', [{ x: joy[0] - 60, y: joy[1], id: 1 }, { x: drift[0], y: drift[1], id: 2 }, { x: boost[0], y: boost[1], id: 3 }, { x: brake[0], y: brake[1], id: 4 }]); await sleep(300);
  st = await b.eval('({ brake: window.__sky.input.brake, thr: window.__sky.input.throttle })'); check('brake overrides auto-gas', st.brake === 1 && st.thr === 0);
  await b.touch('touchEnd', []); await sleep(300);
  st = await b.eval('({ steer: window.__sky.input.steer, drift: window.__sky.input.drift, boost: window.__sky.input.boost, brake: window.__sky.input.brake })');
  check('releasing all touches clears every input', st.steer === 0 && !st.drift && !st.boost && st.brake === 0, JSON.stringify(st));
  await b.touch('touchStart', [{ x: drift[0], y: drift[1], id: 2 }]); await sleep(150);
  await b.eval('document.dispatchEvent(new Event("visibilitychange"))'); await b.eval('window.dispatchEvent(new Event("blur"))'); await sleep(250);
  check('focus loss while a button is held clears it and pauses', (await b.eval('window.__sky.input.drift')) === false && (await b.eval('window.__store.getState().paused')) === true);
  await b.touch('touchEnd', []);
  await b.eval('window.__store.getState().setPaused(false)');
  await sleep(1200);
  await b.shot(`${out}/phone-landscape.png`);
  const lay = (w, h) => b.eval(`({ cw: document.querySelector("canvas").clientWidth, ch: document.querySelector("canvas").clientHeight, iw: innerWidth, ih: innerHeight, sw: document.documentElement.scrollWidth, hud: !!document.querySelector(".hud"), joy: (() => { const q = document.querySelector(".joy").getBoundingClientRect(); return q.left >= 0 && q.bottom <= innerHeight; })(), btn: (() => { const q = document.querySelector(".tbtn.drift").getBoundingClientRect(); return q.right <= innerWidth && q.bottom <= innerHeight; })() })`);
  let L = await lay(); check('landscape: canvas fills the screen, buttons on screen, no sideways scroll', L.cw === L.iw && L.ch === L.ih && L.joy && L.btn && L.sw <= L.iw, JSON.stringify(L));
  await b.setSize(390, 844, true); await sleep(1500);
  L = await lay(); check('rotated to portrait: canvas resized, controls still on screen, no sideways scroll', L.cw === L.iw && L.ch === L.ih && L.joy && L.btn && L.sw <= L.iw, JSON.stringify(L));
  await b.shot(`${out}/phone-portrait.png`);
  await b.eval('window.__store.getState().quitRace()'); await sleep(500);
  const m = await b.eval(OVERFLOW); check('map screen fits a portrait phone (nothing sticks out sideways)', m.length === 0, JSON.stringify(m));
  await b.shot(`${out}/phone-map-portrait.png`);
  for (const scr of ['garage', 'missions', 'settings', 'menu']) { await b.eval(`window.__store.getState().go(${JSON.stringify(scr)})`); await sleep(900); const q = await b.eval(OVERFLOW); check(`${scr} screen fits a portrait phone (nothing sticks out sideways)`, q.length === 0, JSON.stringify(q)); if (scr === 'garage') await b.shot(`${out}/phone-garage-portrait.png`); }
  await b.setSize(844, 390, true); await sleep(600);
  await b.eval('window.__store.getState().go("map")'); await sleep(800); await b.shot(`${out}/phone-map-landscape.png`);
  const bad = b.logs.filter((l) => l.type === 'error' || l.type === 'exception' || l.type === 'warning');
  check('no console errors on the phone run', bad.length === 0, bad.slice(0, 3).map((x) => x.text.slice(0, 120)).join(' | '));
} catch (e) { console.log('TEST ERROR (phone):', e.message); process.exitCode = 1; try { await b.shot(`${out}/error-phone.png`); } catch { /* ignore */ } }
finally { await b.close(); await srv.close(); }

const failed = results.filter((x) => !x.ok);
writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 1));
console.log(failed.length ? `\n${failed.length} browser check(s) FAILED of ${results.length}` : `\nAll ${results.length} browser checks passed.`);
process.exit(failed.length ? 1 : 0);
