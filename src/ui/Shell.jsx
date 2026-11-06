import React from 'react';
import { useStore } from '../store.js';
import { play } from '../game/audio.js';
import { MISSIONS, missionDone, missionClaimed } from '../game/progress.js';

export const Logo = ({ small }) => (
  <div className={'logo' + (small ? ' small' : '')} aria-label="Sky Kart 3D">
    <span className="l1">SKY</span><span className="l2">KART</span><span className="l3">3D</span>
  </div>
);

// Floating islands drifting in the menu sky (plain SVG, no images)
export function SkyDecor() {
  const island = (x, y, sc, d, top = '#6fd05a') => (
    <svg key={x + y} className="isle" style={{ left: x, top: y, width: 220 * sc, animationDelay: d + 's' }} viewBox="0 0 220 140" aria-hidden="true">
      <path d="M10 50 Q110 20 210 50 L170 90 Q140 130 110 138 Q80 130 50 90Z" fill="#a3794f" /><path d="M10 50 Q110 20 210 50 Q110 74 10 50Z" fill={top} />
      <rect x="98" y="18" width="7" height="34" fill="#8a5a2b" /><path d="M100 20 q-34 -4 -44 14 q26 -12 44 -4z M100 20 q34 -4 44 14 q-26 -12 -44 -4z M100 20 q-8 -26 -34 -26 q22 6 34 26z M100 20 q8 -26 34 -26 q-22 6 -34 26z" fill="#2fae4d" />
      <path d="M158 70 v30" stroke="#bfe9ff" strokeWidth="7" opacity=".8" />
    </svg>
  );
  return <div className="sky-decor" aria-hidden="true">{island('6%', '58%', 0.8, 0)}{island('44%', '10%', 0.6, -2, '#9be37a')}{island('70%', '66%', 0.7, -4, '#f1dc9a')}{island('83%', '14%', 0.5, -1)}</div>;
}

export const CoinPill = ({ n }) => <div className="pill coin" aria-label={`${n} coins`}><span className="coin-dot" /><b>{n.toLocaleString()}</b></div>;
export const Stars = ({ n, size = 18 }) => (
  <span className="stars" aria-label={`${n} of 3 stars`}>{[0, 1, 2].map((i) => <span key={i} className={i < n ? 'on' : ''} style={{ fontSize: size }}>★</span>)}</span>
);

// Common frame of the menu-style screens: logo, title, coins, bottom navigation.
export function Shell({ title, active, children }) {
  const save = useStore((s) => s.save);
  const go = useStore((s) => s.go);
  const claimable = MISSIONS.filter((m) => missionDone(save, m) && !missionClaimed(save, m)).length;
  const tab = (id, label, icon, badge) => (
    <button key={id} className={'navbtn' + (active === id ? ' on' : '')} onClick={() => { play('click'); go(id); }}>
      <span className="ni">{icon}</span>{label}{badge ? <i className="badge">{badge}</i> : null}
    </button>
  );
  return (
    <div className="shell sky-bg">
      <header className="topbar">
        <button className="logo-btn" onClick={() => go('menu')} aria-label="Main menu"><Logo small /></button>
        <h1 className="title">{title}</h1>
        <div className="racer"><div className="avatar">🏁</div><div><small>RACER 01</small><CoinPill n={save.coins} /></div></div>
      </header>
      <main className="content">{children}</main>
      <nav className="bottomnav">
        {tab('map', 'Campaign', '🏁')}
        {tab('garage', 'Garage', '🔧')}
        {tab('missions', 'Missions', '📋', claimable)}
        {tab('settings', 'Settings', '⚙️')}
      </nav>
    </div>
  );
}
