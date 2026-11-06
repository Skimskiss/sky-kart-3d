import React, { useEffect, useRef } from 'react';
import { useStore } from './store.js';
import { touch } from './game/input.js';

const capture = (e) => { try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ } };

// Every control owns its own pointer, so several can be held at once (steer + gas + drift + boost).
function Btn({ label, cls, field }) {
  const off = (e) => { e.currentTarget.classList.remove('on'); touch[field] = false; };
  return (
    <button className={'tbtn ' + cls} aria-label={label}
      onPointerDown={(e) => { e.preventDefault(); capture(e); e.currentTarget.classList.add('on'); touch[field] = true; }}
      onPointerUp={off} onPointerCancel={off} onLostPointerCapture={off} onContextMenu={(e) => e.preventDefault()}>
      <span>{label}</span>
    </button>
  );
}

// Analog joystick: horizontal offset from the centre of the ring is the steering amount (-1..1).
export default function Touch({ show }) {
  const settings = useStore((s) => s.save.settings);
  const knob = useRef(null);
  const pad = useRef(null);
  const active = useRef(null);

  useEffect(() => {
    if (!show) return undefined;
    touch.enabled = true;
    return () => { touch.enabled = false; touch.steer = 0; touch.gas = touch.brake = touch.drift = touch.boost = false; };
  }, [show]);
  if (!show) return null;

  const setFromEvent = (e) => {
    const r = pad.current.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = r.width * 0.34;
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const l = Math.hypot(dx, dy);
    const kx = l > R ? (dx / l) * R : dx, ky = l > R ? (dy / l) * R : dy;
    let v = Math.max(-1, Math.min(1, dx / R));
    v = Math.abs(v) < 0.1 ? 0 : Math.sign(v) * Math.pow((Math.abs(v) - 0.1) / 0.9, 0.85) * Math.min(1.6, settings.sensitivity || 1);
    touch.steer = Math.max(-1, Math.min(1, v));
    if (knob.current) knob.current.style.transform = `translate(${kx}px, ${ky}px)`;
  };
  const release = (e) => {
    if (active.current !== null && e && e.pointerId !== active.current) return;
    active.current = null; touch.steer = 0;
    if (knob.current) knob.current.style.transform = 'translate(0,0)';
  };

  return (
    <div className="touch" onContextMenu={(e) => e.preventDefault()}>
      <div className="joy" ref={pad}
        onPointerDown={(e) => { e.preventDefault(); capture(e); active.current = e.pointerId; setFromEvent(e); }}
        onPointerMove={(e) => { if (active.current === e.pointerId) setFromEvent(e); }}
        onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}>
        <span className="arrow l">◀</span><span className="arrow r">▶</span>
        <div className="knob" ref={knob} />
      </div>
      <div className="btns">
        <Btn label="BRAKE" cls="brake" field="brake" />
        {!settings.autoGas && <Btn label="GAS" cls="gas" field="gas" />}
        <Btn label="BOOST" cls="boost" field="boost" />
        <Btn label="DRIFT" cls="drift" field="drift" />
      </div>
    </div>
  );
}
