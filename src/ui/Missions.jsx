import React from 'react';
import { useStore } from '../store.js';
import { Shell } from './Shell.jsx';
import { MISSIONS, missionProgress, missionDone, missionClaimed } from '../game/progress.js';
import { play } from '../game/audio.js';

export default function Missions() {
  const save = useStore((s) => s.save);
  const claim = useStore((s) => s.claim);
  // claimable first, then in progress, then claimed
  const list = [...MISSIONS].sort((a, b) => {
    const rank = (m) => (missionClaimed(save, m) ? 2 : missionDone(save, m) ? 0 : 1);
    return rank(a) - rank(b);
  });
  return (
    <Shell title="MISSIONS" active="missions">
      <div className="panel missions">
        <p className="sub">Complete missions to earn coins. Progress counts everything you do in races.</p>
        <ul>
          {list.map((m) => {
            const p = missionProgress(save, m);
            const done = missionDone(save, m), claimed = missionClaimed(save, m);
            return (
              <li key={m.id} className={'mission' + (claimed ? ' claimed' : '')} data-id={m.id}>
                <div className="mbody">
                  <b>{m.text}</b>
                  <div className="bar"><div style={{ width: `${(p.value / p.target) * 100}%` }} /><em>{p.value} / {p.target}</em></div>
                </div>
                <div className="reward"><span className="coin-dot" />{m.reward}</div>
                {claimed ? <span className="btn small disabled">Claimed ✓</span>
                  : <button className={'btn small' + (done ? ' gold' : ' disabled')} disabled={!done} onClick={() => { const r = claim(m.id); if (r.ok) play('buy'); }}>CLAIM</button>}
              </li>
            );
          })}
        </ul>
      </div>
    </Shell>
  );
}
