import React, { Suspense, lazy, useEffect } from 'react';
import { useStore } from './store.js';
import { initAudio, setAudioSettings, startMenuMusic, stopMenuMusic, audioReady } from './game/audio.js';
import Menu from './ui/Menu.jsx';
import MapScreen from './ui/MapScreen.jsx';
import Garage from './ui/Garage.jsx';
import Missions from './ui/Missions.jsx';
import SettingsScreen from './ui/SettingsScreen.jsx';
import Results from './ui/Results.jsx';

// The 3D engine (three + r3f + sim) lives in its own chunk and is only fetched when a race starts.
const Race = lazy(() => import('./Race.jsx'));

function Loading() {
  return <div className="loading"><div className="spinner" /><p>Warming up the engines…</p></div>;
}

export default function App() {
  const screen = useStore((s) => s.screen);

  useEffect(() => {
    // audio must start from a user gesture
    const unlock = () => { const st = useStore.getState().save.settings; initAudio(st); setAudioSettings(st); if (useStore.getState().screen !== 'race') startMenuMusic(); };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    const block = (e) => { if (e.touches && e.touches.length > 1) e.preventDefault(); };
    document.addEventListener('touchmove', block, { passive: false });
    return () => document.removeEventListener('touchmove', block);
  }, []);

  // menu music plays on every screen except the race (it starts after the first tap or key press)
  useEffect(() => { if (screen === 'race') stopMenuMusic(); else if (audioReady()) startMenuMusic(); }, [screen]);

  // warm the race chunk while the player is on the map
  useEffect(() => { if (screen === 'map') import('./Race.jsx'); }, [screen]);

  return (
    <div className="app">
      {screen === 'menu' && <Menu />}
      {screen === 'map' && <MapScreen />}
      {screen === 'garage' && <Garage />}
      {screen === 'missions' && <Missions />}
      {screen === 'settings' && <SettingsScreen />}
      {screen === 'race' && <Suspense fallback={<Loading />}><Race /></Suspense>}
      {screen === 'results' && <Results />}
    </div>
  );
}
