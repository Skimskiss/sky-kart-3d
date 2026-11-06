import React, { useEffect, useRef, useState } from 'react';
import { useStore, fmt } from './store.js';
import { bus } from './game/bus.js';

const ORD = ['1st', '2nd', '3rd', '4th'];

// Minimap: the track outline is drawn once into an offscreen canvas, karts are drawn on top ~15 times a second.
function Minimap({ world }) {
  const ref = useRef(null);
  const base = useRef(null);
  useEffect(() => {
    if (!world) return undefined;
    const tr = world.track, S = 132;
    let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
    for (let i = 0; i < tr.N; i++) { minX = Math.min(minX, tr.px[i]); maxX = Math.max(maxX, tr.px[i]); minZ = Math.min(minZ, tr.pz[i]); maxZ = Math.max(maxZ, tr.pz[i]); }
    const sc = (S - 26) / Math.max(maxX - minX, maxZ - minZ);
    const ox = S / 2 - ((minX + maxX) / 2) * sc, oz = S / 2 + ((minZ + maxZ) / 2) * sc;
    const P = (x, z) => [x * sc + ox, -z * sc + oz];
    const off = document.createElement('canvas'); off.width = off.height = S;
    const g = off.getContext('2d');
    g.lineJoin = 'round'; g.lineCap = 'round';
    const stroke = (xs, zs, n, closed, w, c) => { g.beginPath(); for (let i = 0; i < n; i++) { const [x, y] = P(xs[i], zs[i]); i ? g.lineTo(x, y) : g.moveTo(x, y); } if (closed) g.closePath(); g.lineWidth = w; g.strokeStyle = c; g.stroke(); };
    stroke(tr.px, tr.pz, tr.N, true, 9, '#0b1a33');
    stroke(tr.px, tr.pz, tr.N, true, 6, '#e8f1ff');
    if (tr.branch) { stroke(tr.branch.px, tr.branch.pz, tr.branch.M, false, 6, '#0b1a33'); stroke(tr.branch.px, tr.branch.pz, tr.branch.M, false, 3.5, '#ffb347'); }
    const [sx, sy] = P(tr.px[0], tr.pz[0]);
    g.fillStyle = '#fff'; g.fillRect(sx - 4, sy - 1.5, 8, 3);
    base.current = { off, P };
    let alive = true;
    const draw = () => {
      if (!alive || !ref.current || !base.current) return;
      const c = ref.current.getContext('2d');
      c.clearRect(0, 0, S, S);
      c.drawImage(base.current.off, 0, 0);
      for (const k of world.karts) {
        const [x, y] = base.current.P(k.x, k.z);
        c.beginPath(); c.arc(x, y, k.isPlayer ? 5 : 3.6, 0, 6.3);
        c.fillStyle = k.isPlayer ? '#ff3b4d' : (k.look && k.look.body) || '#38bdf8';
        c.fill(); c.lineWidth = 1.5; c.strokeStyle = '#fff'; c.stroke();
      }
    };
    const id = setInterval(draw, 66);
    draw();
    return () => { alive = false; clearInterval(id); };
  }, [world]);
  return <canvas ref={ref} width={132} height={132} className="minimap" />;
}

export default function Hud() {
  const [h, setH] = useState({ pos: 1, lap: 1, laps: 3, time: 0, coins: 0, meter: 0, toast: '', wrong: false, fps: 0, boosting: false });
  const [world, setWorld] = useState(null);
  const showFps = useStore((s) => s.save.settings.showFps);
  const setPaused = useStore((s) => s.setPaused);
  useEffect(() => {
    const id = setInterval(() => {
      const w = bus.world;
      setWorld((cur) => (cur === w ? cur : w));
      if (!w || !w.player) return;
      const k = w.player;
      setH({
        pos: k.rank + 1, lap: Math.max(1, Math.min(w.laps, k.crossed)), laps: w.laps, time: Math.max(0, w.state === 'countdown' ? 0 : k.finished ? k.finishTime : w.time),
        coins: w.stats.coins, meter: k.meter, boosting: k.boosting, toast: performance.now() < bus.toastT ? bus.toast : '', wrong: k.wrongT > 0.6, fps: bus.fps,
      });
    }, 100);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="hud">
      <div className="hud-left">
        <div className="pill pos"><span className="big">{ORD[h.pos - 1] || h.pos}</span><span className="sm">/ 4</span></div>
        <div className="pill lap">LAP <b>{h.lap}</b> / {h.laps}</div>
      </div>
      <div className="hud-top">
        <div className="pill"><span className="ico">⏱</span><b>{fmt(h.time)}</b></div>
        <div className="pill coin"><span className="coin-dot" /><b>{h.coins}</b></div>
      </div>
      <div className="hud-right">
        <button className="pause-btn" aria-label="Pause" onClick={() => setPaused(true)}>❚❚</button>
        <Minimap world={world} />
      </div>
      <div className={'boost-bar' + (h.boosting ? ' on' : '') + (h.meter > 0.99 ? ' full' : '')} aria-label="Boost meter">
        <div className="fill" style={{ width: `${Math.round(h.meter * 100)}%` }} />
        <span>BOOST</span>
      </div>
      {h.toast && <div className="toast" key={h.toast + Math.floor(performance.now() / 500)}>{h.toast}</div>}
      {h.wrong && <div className="wrong">WRONG WAY</div>}
      {h.time < 9 && !('ontouchstart' in window) && <div className="keyhint">↑ gas · ← → steer · SPACE drift · SHIFT boost · R reset · ESC pause</div>}
      {showFps && <div className="fps">{Math.round(h.fps)} fps</div>}
    </div>
  );
}
