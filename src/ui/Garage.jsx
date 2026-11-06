import React, { Suspense, lazy, useState } from 'react';
import { useStore } from '../store.js';
import { Shell } from './Shell.jsx';
import { KARTS, PAINTS, DRIVERS, WINGS, UPGRADES, STAT_KEYS, STAT_NAMES, MAX_UPGRADE, kartById, paintById, driverById, wingById, effectiveStats, upgradeCost } from '../game/karts.js';
import { upgradeLevels } from '../game/progress.js';
import { play } from '../game/audio.js';

const GaragePreview = lazy(() => import('./GaragePreview.jsx'));

const TABS = [['kart', 'KART', '🏎️'], ['driver', 'DRIVER', '🪖'], ['wings', 'WINGS', '🪽'], ['tune', 'UPGRADES', '🔧']];

function StatBars({ stats, base }) {
  return (
    <div className="statbars">
      {STAT_KEYS.map((k) => (
        <div key={k} className="stat"><span>{STAT_NAMES[k]}</span>
          <div className="bar"><div style={{ width: `${stats[k] * 10}%` }} />{base && stats[k] > base[k] && <i style={{ left: `${base[k] * 10}%`, width: `${(stats[k] - base[k]) * 10}%` }} />}</div>
          <b>{stats[k].toFixed(1)}</b>
        </div>
      ))}
    </div>
  );
}

export default function Garage() {
  const save = useStore((s) => s.save);
  const st = useStore.getState;
  const g = save.garage;
  const [tab, setTab] = useState('kart');
  const [viewKart, setViewKart] = useState(g.kart);
  const [pPaint, setPPaint] = useState(null);
  const [pDriver, setPDriver] = useState(null);
  const [pWing, setPWing] = useState(null);
  const [msg, setMsg] = useState('');

  const kart = kartById(viewKart), owned = g.owned.includes(kart.id);
  const paintId = pPaint || g.paints[kart.id] || kart.paint;
  const paint = paintById(paintId), driver = driverById(pDriver || g.driver), wing = wingById(pWing || g.wing);
  const upg = upgradeLevels(save, kart.id);
  const stats = effectiveStats(kart, upg);
  const look = { body: paint.body, trim: paint.trim, helmet: driver.helmet, stripe: driver.stripe, wing: wing.id };
  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(''), 1800); };
  const done = (r, okText) => { if (r.ok) { play('buy'); flash(okText); } else flash(r.reason === 'not enough coins' ? 'Not enough coins' : r.reason); return r.ok; };

  const cycle = (d) => { const i = (KARTS.findIndex((k) => k.id === viewKart) + d + KARTS.length) % KARTS.length; setViewKart(KARTS[i].id); setPPaint(null); play('click'); };

  // the one main action button depends on the tab
  let action = null;
  if (tab === 'kart') {
    action = owned
      ? (g.kart === kart.id ? <button className="btn disabled" disabled>EQUIPPED ✓</button> : <button className="btn gold" onClick={() => done(st().equipKart(kart.id), 'Kart equipped')}>EQUIP</button>)
      : <button className={'btn gold' + (save.coins < kart.price ? ' poor' : '')} onClick={() => done(st().buyKart(kart.id), 'Kart bought!')}>BUY · <span className="coin-dot" /> {kart.price.toLocaleString()}</button>;
  }
  const paintAction = () => {
    if (!owned) return <button className="btn disabled" disabled>Buy this kart to paint it</button>;
    const p = paint;
    if (!g.ownedPaints.includes(p.id)) return <button className={'btn gold' + (save.coins < p.price ? ' poor' : '')} onClick={() => { if (done(st().buyPaint(p.id, kart.id), 'Paint bought!')) setPPaint(null); }}>BUY PAINT · <span className="coin-dot" /> {p.price}</button>;
    if ((g.paints[kart.id] || kart.paint) === p.id) return <span className="eq">Paint equipped ✓</span>;
    return <button className="btn gold" onClick={() => { if (done(st().equipPaint(p.id, kart.id), 'Paint equipped')) setPPaint(null); }}>EQUIP PAINT</button>;
  };

  return (
    <Shell title="GARAGE" active="garage">
      <div className="garage-layout">
        <div className="gtabs" role="tablist">
          {TABS.map(([id, label, icon]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => { play('click'); setTab(id); }}><span>{icon}</span>{label}</button>)}
        </div>
        <section className="stage">
          <Suspense fallback={<div className="preview3d loading">Loading…</div>}><GaragePreview look={look} /></Suspense>
          {tab === 'kart' && <><button className="arrow-btn l" aria-label="Previous kart" onClick={() => cycle(-1)}>‹</button><button className="arrow-btn r" aria-label="Next kart" onClick={() => cycle(1)}>›</button></>}
          <div className="stage-name"><b>{tab === 'driver' ? driver.name : tab === 'wings' ? wing.name + ' wing' : kart.name}</b>{tab === 'kart' && <small>{kart.blurb}</small>}{tab === 'kart' && !owned && <em>🔒 Not owned</em>}</div>
          {msg && <div className="flash">{msg}</div>}
        </section>
        <aside className="panel gside">
          {tab !== 'tune' && <StatBars stats={stats} base={kart.base} />}
          {tab === 'kart' && (
            <>
              <h3>KARTS</h3>
              <div className="chips">{KARTS.map((k) => <button key={k.id} className={'chip' + (k.id === viewKart ? ' on' : '')} onClick={() => { setViewKart(k.id); setPPaint(null); play('click'); }}>{k.name}{g.owned.includes(k.id) ? (g.kart === k.id ? ' ✓' : '') : ' 🔒'}</button>)}</div>
              <h3>PAINT COLORS</h3>
              <div className="swatches">
                {PAINTS.map((p) => (
                  <button key={p.id} className={'swatch' + (paintId === p.id ? ' on' : '')} aria-label={`${p.name}${g.ownedPaints.includes(p.id) ? '' : ' (' + p.price + ' coins)'}`} style={{ background: `linear-gradient(135deg, ${p.body} 55%, ${p.trim} 55%)` }} onClick={() => { setPPaint(p.id); play('click'); }}>
                    {!g.ownedPaints.includes(p.id) && <small>{p.price}</small>}
                  </button>
                ))}
              </div>
              <div className="actions">{paintAction()}{action}</div>
            </>
          )}
          {tab === 'driver' && (
            <>
              <h3>DRIVER (cosmetic)</h3>
              <div className="chips">{DRIVERS.map((d) => <button key={d.id} className={'chip' + (driver.id === d.id ? ' on' : '')} onClick={() => { setPDriver(d.id); play('click'); }}><i className="dot" style={{ background: d.helmet }} />{d.name}{g.ownedDrivers.includes(d.id) ? (g.driver === d.id ? ' ✓' : '') : ` · ${d.price}`}</button>)}</div>
              <div className="actions">
                {g.ownedDrivers.includes(driver.id)
                  ? (g.driver === driver.id ? <button className="btn disabled" disabled>EQUIPPED ✓</button> : <button className="btn gold" onClick={() => { if (done(st().equipDriver(driver.id), 'Driver equipped')) setPDriver(null); }}>EQUIP</button>)
                  : <button className={'btn gold' + (save.coins < driver.price ? ' poor' : '')} onClick={() => { if (done(st().buyDriver(driver.id), 'Driver bought!')) setPDriver(null); }}>BUY · <span className="coin-dot" /> {driver.price}</button>}
              </div>
            </>
          )}
          {tab === 'wings' && (
            <>
              <h3>WINGS (cosmetic)</h3>
              <div className="chips">{WINGS.map((w) => <button key={w.id} className={'chip' + (wing.id === w.id ? ' on' : '')} onClick={() => { setPWing(w.id); play('click'); }}>{w.name}{g.ownedWings.includes(w.id) ? (g.wing === w.id ? ' ✓' : '') : ` · ${w.price}`}</button>)}</div>
              <p className="hint">{wing.note}</p>
              <div className="actions">
                {g.ownedWings.includes(wing.id)
                  ? (g.wing === wing.id ? <button className="btn disabled" disabled>EQUIPPED ✓</button> : <button className="btn gold" onClick={() => { if (done(st().equipWing(wing.id), 'Wing equipped')) setPWing(null); }}>EQUIP</button>)
                  : <button className={'btn gold' + (save.coins < wing.price ? ' poor' : '')} onClick={() => { if (done(st().buyWing(wing.id), 'Wing bought!')) setPWing(null); }}>BUY · <span className="coin-dot" /> {wing.price}</button>}
              </div>
            </>
          )}
          {tab === 'tune' && (
            <>
              <h3>UPGRADES · {kart.name}</h3>
              {!owned ? <p className="hint">Buy this kart first (Kart tab) to upgrade it.</p> : (
                <ul className="upgrades">
                  {UPGRADES.map((u) => {
                    const lv = upg[u.id], cost = upgradeCost(lv);
                    return (
                      <li key={u.id}>
                        <div><b>{u.name}</b><small>{u.note}</small>
                          <div className="pips">{Array.from({ length: MAX_UPGRADE }, (_, i) => <i key={i} className={i < lv ? 'on' : ''} />)}</div></div>
                        {cost == null ? <span className="eq">MAX</span> : <button className={'btn small gold' + (save.coins < cost ? ' poor' : '')} onClick={() => done(st().buyUpgrade(kart.id, u.id), u.name + ' upgraded!')}><span className="coin-dot" /> {cost}</button>}
                      </li>
                    );
                  })}
                </ul>
              )}
              <StatBars stats={stats} base={kart.base} />
            </>
          )}
        </aside>
      </div>
    </Shell>
  );
}
