import React, { Suspense, lazy } from 'react';
import { useStore } from '../store.js';
import { Logo, CoinPill, SkyDecor } from './Shell.jsx';
import { TRACK_LIST } from '../game/tracks.js';
import { nextTrackIndex, totalStars } from '../game/progress.js';
import { kartById, paintById, driverById, wingById } from '../game/karts.js';
import { play } from '../game/audio.js';

const GaragePreview = lazy(() => import('./GaragePreview.jsx'));

export default function Menu() {
  const save = useStore((s) => s.save);
  const go = useStore((s) => s.go);
  const cont = useStore((s) => s.continueAdventure);
  const g = save.garage, kart = kartById(g.kart), paint = paintById(g.paints[kart.id] || kart.paint), drv = driverById(g.driver);
  const look = { body: paint.body, trim: paint.trim, helmet: drv.helmet, stripe: drv.stripe, wing: wingById(g.wing).id };
  const next = TRACK_LIST[nextTrackIndex(save)];
  const started = Object.keys(save.tracks).length > 0;
  const b = (label, fn, cls = '') => <button className={'btn big ' + cls} onClick={() => { play('click'); fn(); }}>{label}</button>;
  return (
    <div className="menu sky-bg"><SkyDecor />
      <div className="menu-top"><CoinPill n={save.coins} /><span className="pill">★ {totalStars(save)} / {TRACK_LIST.length * 3}</span></div>
      <div className="menu-main">
        <div className="menu-left">
          <Logo />
          <p className="tag">ISLAND GRAND PRIX</p>
          <div className="menu-btns">
            {b(<>▶ {started ? 'Continue Adventure' : 'Start Adventure'}<small>{next.name}</small></>, cont, 'gold')}
            {b('🗺️ World Map', () => go('map'))}
            {b('🔧 Garage', () => go('garage'))}
            {b('📋 Missions', () => go('missions'))}
            {b('⚙️ Settings', () => go('settings'))}
          </div>
        </div>
        <div className="menu-right"><Suspense fallback={null}><GaragePreview look={look} /></Suspense></div>
      </div>
      <footer className="foot">Arrow keys / WASD drive · Space drift · Shift boost · Touch controls on phones</footer>
    </div>
  );
}
