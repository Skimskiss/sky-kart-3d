import React from 'react';
import { useStore, fmt } from '../store.js';
import { TRACK_LIST } from '../game/tracks.js';
import { Stars } from './Shell.jsx';
import { play } from '../game/audio.js';

const ORD = ['1st', '2nd', '3rd', '4th'];

export default function Results() {
  const r = useStore((s) => s.results);
  const { replay, nextTrack, go } = useStore.getState();
  const save = useStore((s) => s.save);
  const failed = useStore((s) => s.saveFailed);
  if (!r) return null;
  const { summary: s, rows, trackIndex } = r;
  const def = TRACK_LIST[trackIndex];
  const hasNext = trackIndex + 1 < TRACK_LIST.length && trackIndex + 1 < save.unlocked;
  return (
    <div className="results sky-bg">
      <div className="banner">🏁 RACE COMPLETE! 🏁</div>
      <div className="res-layout">
        <section className="podium panel">
          <h2>{def.name}</h2>
          <div className={'place p' + s.pos}>{ORD[s.pos - 1]}</div>
          <Stars n={s.stars} size={44} />
          {!s.finished && <p className="warn">You did not finish the race.</p>}
          <div className="standings">
            {rows.map((x) => (
              <div key={x.id} className={'srow' + (x.isPlayer ? ' me' : '')}><b>{x.pos}</b><span className="dot" style={{ background: x.look.body }} />{x.name}<em>{x.time != null ? fmt(x.time) : 'DNF'}</em></div>
            ))}
          </div>
        </section>
        <section className="panel rewards">
          <div className="big-time">⏱ {fmt(s.time)}</div>
          {s.newBest && <div className="new">NEW BEST TIME!</div>}
          <ul className="breakdown">
            <li><span>Finish position bonus</span><b>+{s.placeCoins}</b></li>
            <li><span>Coins collected</span><b>+{s.pickupCoins}</b></li>
            {s.starCoins > 0 && <li><span>New stars (+{s.newStars}★)</span><b>+{s.starCoins}</b></li>}
            {s.taskCoins > 0 && <li><span>Track tasks completed</span><b>+{s.taskCoins}</b></li>}
            <li className="tot"><span><span className="coin-dot" /> Total</span><b>+{s.total}</b></li>
          </ul>
          <ul className="tasks small">
            {['Finish the race', `Collect ${def.tasks.coins} coins`, `Finish under ${fmt(def.tasks.time).slice(1, 5)}`].map((t, i) => <li key={i} className={s.tasks[i] ? 'done' : ''}><span className="check">{s.tasks[i] ? '✓' : ''}</span>{t}{s.newTasks[i] ? ' · NEW' : ''}</li>)}
          </ul>
          {s.unlockedNext && <div className="unlock">🔓 New track unlocked: {TRACK_LIST[trackIndex + 1].name}!</div>}
          {failed && <p className="warn">Progress could not be saved (browser storage is blocked or full).</p>}
          <div className="res-btns">
            {hasNext && <button className="btn gold big" onClick={() => { play('click'); nextTrack(); }}>NEXT TRACK »</button>}
            <button className={'btn big' + (hasNext ? '' : ' gold')} onClick={() => { play('click'); replay(); }}>↻ REPLAY</button>
            <button className="btn big dark" onClick={() => { play('click'); go('map'); }}>🗺️ MAP</button>
          </div>
        </section>
      </div>
    </div>
  );
}
