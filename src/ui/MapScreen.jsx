import React from 'react';
import { useStore, fmt } from '../store.js';
import { TRACK_LIST } from '../game/tracks.js';
import { Shell, Stars } from './Shell.jsx';
import { play } from '../game/audio.js';

export function TrackThumb({ def, className = '' }) {
  const th = def.theme;
  const style = { background: `linear-gradient(180deg, ${th.skyTop} 0%, ${th.skyBot} 55%, ${th.ground} 56%, ${th.ground2 || th.ground} 100%)` };
  return (
    <div className={'thumb ' + className} style={style}>
      <img src={`previews/${def.id}.jpg`} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
    </div>
  );
}

export default function MapScreen() {
  const save = useStore((s) => s.save);
  const selected = useStore((s) => s.selected);
  const select = useStore((s) => s.select);
  const startRace = useStore((s) => s.startRace);
  const def = TRACK_LIST[selected];
  const rec = save.tracks[def.id] || { stars: 0, tasks: [false, false, false], best: null };
  const locked = selected >= save.unlocked;
  const tasks = [
    { icon: '🏁', text: 'Finish the race' },
    { icon: '🪙', text: `Collect ${def.tasks.coins} coins` },
    { icon: '⏱', text: `Finish under ${fmt(def.tasks.time).slice(1, 5)}` },
  ];
  return (
    <Shell title="ISLAND GRAND PRIX" active="map">
      <div className="map-layout">
        <section className="panel grid-panel" aria-label="World map: 12 tracks">
          <div className="track-grid">
            {TRACK_LIST.map((t, i) => {
              const r = save.tracks[t.id];
              const lock = i >= save.unlocked;
              return (
                <button key={t.id} className={'track-card' + (i === selected ? ' sel' : '') + (lock ? ' locked' : '')} onClick={() => { play('click'); select(i); }} aria-label={`${i + 1}. ${t.name}${lock ? ' (locked)' : ''}`}>
                  <TrackThumb def={t} />
                  <span className="num">{i + 1}</span>
                  <span className="cap"><b>{t.name}</b>{lock ? <span className="lock">🔒</span> : <Stars n={r ? r.stars : 0} size={14} />}</span>
                </button>
              );
            })}
          </div>
        </section>
        <aside className="panel detail">
          <h2>{def.name}</h2>
          <Stars n={rec.stars} size={30} />
          <TrackThumb def={def} className="big" />
          <div className="laps">🏁 3 LAPS · {def.shortcut.name}</div>
          <p className="blurb">{def.blurb}</p>
          <h3>TRACK TASKS</h3>
          <ul className="tasks">
            {tasks.map((t, i) => (
              <li key={i} className={rec.tasks[i] ? 'done' : ''}><span className="check">{rec.tasks[i] ? '✓' : ''}</span><span>{t.icon}</span>{t.text}</li>
            ))}
          </ul>
          <div className="best">Best time: <b>{fmt(rec.best)}</b></div>
          {locked
            ? <button className="btn big disabled" disabled>🔒 Finish track {selected} to unlock</button>
            : <button className="btn gold big" onClick={() => { play('click'); startRace(selected); }}>▶ {rec.best ? 'REPLAY' : 'START RACE'}</button>}
        </aside>
      </div>
    </Shell>
  );
}
