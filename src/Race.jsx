import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useStore, effectiveQuality } from './store.js';
import { makeRaceWorld } from './game/setup.js';
import { step, STEP } from './game/sim.js';
import { createVisuals } from './game/visuals.js';
import { input, touch, pollInput, bindKeyboard, resetInput, haptic, wantsTouchUi } from './game/input.js';
import { initAudio, play, startRaceAudio, stopRaceAudio, updateRaceAudio, setAudioSettings, setRacePaused } from './game/audio.js';
import { bus, toast } from './game/bus.js';
import Hud from './Hud.jsx';
import Touch from './Touch.jsx';
import { PauseMenu } from './ui/Pause.jsx';

// The world outlives the canvas: changing graphics quality remounts the canvas but must not restart the race.
let cachedWorld = null;
function getWorld(raceKey) {
  if (cachedWorld && cachedWorld.key === raceKey) return cachedWorld.world;
  const st = useStore.getState();
  const world = makeRaceWorld(st.save, st.trackIndex, 3);
  cachedWorld = { key: raceKey, world };
  return world;
}

function Scene({ quality, dprCap }) {
  const { scene, gl, camera, setDpr } = useThree();
  const raceKey = useStore((s) => s.raceKey);
  const world = useMemo(() => getWorld(raceKey), [raceKey]);
  const visuals = useMemo(() => createVisuals(world, { quality, scene }), [world, quality, scene]);
  const ctx = useRef({ camera, gl, rear: false });
  const acc = useRef(0);
  const adapt = useRef({ t: 0, frames: 0, good: 0, cool: 3, dpr: Math.min(window.devicePixelRatio || 1, dprCap) });
  const finished = useRef(false);

  useEffect(() => {
    bus.world = world; bus.visuals = visuals; bus.quality = quality; bus.input = input; bus.touch = touch; bus.gl = gl; finished.current = false;
    resetInput();
    initAudio(useStore.getState().save.settings);
    startRaceAudio(world.track.def.music);
    return () => { stopRaceAudio(); if (bus.world === world) bus.world = null; };
  }, [world, quality, visuals]);
  useEffect(() => () => visuals.dispose(), [visuals]);

  useFrame((state, delta) => {
    const st = useStore.getState();
    const dt = Math.min(delta, 0.1);

    const a = adapt.current;
    if (delta > 0.25 || document.hidden) { a.t = 0; a.frames = 0; a.good = 0; } else { a.t += delta; a.frames++; }
    if (a.t >= 1) {
      bus.fps = a.frames / a.t; a.t = 0; a.frames = 0; a.cool -= 1;
      if (bus.fps < 48 && a.dpr > 0.55 && a.cool <= 0) { a.dpr = Math.max(0.55, a.dpr * 0.85); setDpr(a.dpr); a.cool = 2; a.good = 0; }
      else if (bus.fps > 57) { a.good++; if (a.good >= 5 && a.dpr < dprCap) { a.dpr = Math.min(dprCap, a.dpr * 1.1); setDpr(a.dpr); a.good = 0; } }
      else a.good = 0;
      bus.dpr = a.dpr;
    }

    const cpu0 = performance.now();
    pollInput(st.save.settings);
    const paused = st.paused || st.settingsOpen;
    if (!paused) {
      acc.current += dt * (bus.timeScale || 1);
      let n = 0;
      while (acc.current >= STEP && n++ < 40) { step(world, input, STEP, !!bus.autopilot); acc.current -= STEP; }
      if (acc.current > STEP * 4) acc.current = 0;
    }
    const alpha = acc.current / STEP;
    ctx.current.camera = state.camera; ctx.current.gl = state.gl; ctx.current.rear = input.rear; ctx.current.debugCam = bus.debugCam;
    visuals.update(alpha, paused ? 0 : dt, ctx.current);

    bus.cpuMs = (bus.cpuMs || 0) * 0.95 + (performance.now() - cpu0) * 0.05; // JS time per frame (simulation + scene update), smoothed
    handleEvents(world, visuals, st.save.settings);
    const pk = world.player;
    setRacePaused(paused);
    if (pk) updateRaceAudio(Math.min(1.3, Math.hypot(pk.vx, pk.vz) / pk.maxSpeed), pk.driftDir !== 0 && pk.y < 0.3, pk.boosting || pk.boostT > 0);
    if (pk && pk.finished) {
      for (let i = 0; i < 3; i++) visuals.particles.emit(pk.x + (Math.random() - 0.5) * 14, 9 + Math.random() * 4, pk.z + (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 3, -2 - Math.random() * 2, (Math.random() - 0.5) * 3, Math.random(), Math.random(), Math.random(), 0.9, 2.2, 0);
    }

    if (world.state === 'done' && !finished.current) {
      finished.current = true;
      const rk = st.raceKey;
      setTimeout(() => {
        const now = useStore.getState();
        if (now.screen === 'race' && now.raceKey === rk) now.finishRace(world);
      }, 900);
    }
  });

  return <primitive object={visuals.root} />;
}

function handleEvents(world, visuals, settings) {
  const pk = world.player;
  const ev = world.events;
  for (let i = 0; i < ev.length; i++) {
    const e = ev[i], k = e.a;
    const mine = k && k === pk;
    const near = k && pk && (k.x - pk.x) ** 2 + (k.z - pk.z) ** 2 < 2500;
    const sc = mine ? 1 : 0.35;
    switch (e.type) {
      case 'count': play('beep'); toast(String(e.a), 0.9); break;
      case 'go': play('go'); toast('GO!', 1.1); break;
      case 'coin': play('coin', 0.7, 1 + Math.random() * 0.2); for (let n = 0; n < 5; n++) visuals.particles.emit(e.b.x, e.b.y + 1.4, e.b.z, (Math.random() - 0.5) * 6, 2 + Math.random() * 3, (Math.random() - 0.5) * 6, 1, 0.85, 0.2, 0.5, 0.45, 8); break;
      case 'boost': if (mine) { play('boost'); if (settings.haptics) haptic(30); } else if (near) play('boost', 0.25); break;
      case 'miniturbo': if (mine) { play('mini'); if (settings.haptics) haptic(25); } break;
      case 'driftlevel': if (mine) play('pop', 0.5, 1 + 0.15 * e.b); break;
      case 'hit': {
        if (mine || near) play('hit', sc);
        if (mine && settings.haptics) haptic([60, 40, 90]);
        if (mine) toast('Ouch!', 0.9);
        for (let n = 0; n < 12; n++) visuals.particles.emit(k.x, 1.5, k.z, (Math.random() - 0.5) * 12, 3 + Math.random() * 5, (Math.random() - 0.5) * 12, 1, 0.85, 0.2, 0.9, 0.6, 10);
        break;
      }
      case 'bump': if (mine || near) play('bump', (e.b || 0.5) * sc); if (mine && settings.haptics) haptic(15); break;
      case 'jump': if (mine) play('jump'); break;
      case 'land': if (mine) play('land'); break;
      case 'lap': if (mine) { play('lap'); toast(e.b === world.laps ? 'FINAL LAP!' : 'LAP ' + e.b + ' / ' + world.laps, 1.6); } break;
      case 'finish': if (mine) { play('finish'); toast('FINISH!', 3); if (settings.haptics) haptic([40, 40, 40, 40, 120]); } break;
      case 'respawn': if (mine) toast('Back on track', 1.2); break;
      case 'shortcut': if (mine) { play('mini', 0.7, 1.15); toast('SHORTCUT!', 1.3); } break;
      default: break;
    }
  }
  ev.length = 0;
}

export default function Race() {
  const settings = useStore((s) => s.save.settings);
  const paused = useStore((s) => s.paused);
  const settingsOpen = useStore((s) => s.settingsOpen);
  const quality = effectiveQuality(settings.quality);
  const dprCap = quality === 'low' ? 1 : quality === 'medium' ? 1.5 : 2;
  const initialDpr = Math.min(window.devicePixelRatio || 1, dprCap);
  const [touchUi] = useState(wantsTouchUi);

  useEffect(() => { initAudio(useStore.getState().save.settings); setAudioSettings(settings); }, [settings]);
  useEffect(() => { const t = setTimeout(() => window.dispatchEvent(new Event('resize')), 300); return () => clearTimeout(t); }, [quality]);

  useEffect(() => {
    const unbind = bindKeyboard(() => {
      const s = useStore.getState();
      if (s.settingsOpen) return s.openSettings(false);
      s.setPaused(!s.paused);
    });
    let lock = null, alive = true;
    const acquire = async () => {
      try {
        if (alive && !lock && 'wakeLock' in navigator) {
          lock = await navigator.wakeLock.request('screen');
          if (!alive) { lock.release().catch(() => {}); lock = null; return; }
          lock.addEventListener('release', () => { lock = null; });
        }
      } catch { /* not important */ }
    };
    acquire();
    // losing focus or hiding the tab pauses the race and releases every held key / touch
    const vis = () => { if (document.hidden) { resetInput(); useStore.getState().setPaused(true); } else { acquire(); window.dispatchEvent(new Event('resize')); } };
    const blur = () => { resetInput(); const s = useStore.getState(); if (s.screen === 'race') s.setPaused(true); };
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('blur', blur);
    const orient = () => setTimeout(() => window.dispatchEvent(new Event('resize')), 250);
    window.addEventListener('orientationchange', orient);
    const nudge = setTimeout(() => window.dispatchEvent(new Event('resize')), 400);
    return () => {
      alive = false;
      if (lock) lock.release().catch(() => {});
      clearTimeout(nudge);
      unbind();
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('blur', blur);
      window.removeEventListener('orientationchange', orient);
      useStore.getState().setPaused(false);
      cachedWorld = null;
      resetInput();
    };
  }, []);


  return (
    <div className={'race-root' + (touchUi ? ' touch-ui' : '')}>
      <Canvas
        key={quality}
        dpr={initialDpr}
        shadows={quality !== 'low'}
        gl={{ antialias: quality === 'high', powerPreference: 'high-performance', alpha: false }}
        camera={{ fov: 62, near: 0.5, far: 3000, position: [0, 5, -12] }}
        onCreated={({ gl }) => { gl.shadowMap.type = 1; }}
      >
        <Scene quality={quality} dprCap={dprCap} />
      </Canvas>
      <Hud />
      <Touch show={touchUi} />
      {(paused || settingsOpen) && <PauseMenu />}
    </div>
  );
}
