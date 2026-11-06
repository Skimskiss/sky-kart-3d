import React from 'react';
import { useStore } from '../store.js';
import { setAudioSettings, initAudio, play } from '../game/audio.js';

export function Slider({ label, value, onChange, min = 0, max = 1, step = 0.05 }) {
  return (
    <label className="row">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} aria-label={label} onChange={(e) => onChange(parseFloat(e.target.value))} />
      <b>{Math.round(value * 100)}%</b>
    </label>
  );
}

export function Toggle({ label, value, onChange, note }) {
  return (
    <div className="row">
      <span>{label}{note && <small>{note}</small>}</span>
      <button className={'switch' + (value ? ' on' : '')} role="switch" aria-checked={value} aria-label={label} onClick={() => onChange(!value)}><i /></button>
    </div>
  );
}

export function SettingsPanel() {
  const s = useStore((st) => st.save.settings);
  const set = useStore((st) => st.setSetting);
  const failed = useStore((st) => st.saveFailed);
  const apply = (patch) => { set(patch); initAudio({ ...s, ...patch }); setAudioSettings({ ...s, ...patch }); };
  return (
    <div className="settings-panel">
      <Slider label="Master volume" value={s.master} onChange={(v) => apply({ master: v })} />
      <Slider label="Music" value={s.music} onChange={(v) => apply({ music: v })} />
      <Slider label="Sound effects" value={s.sfx} onChange={(v) => { apply({ sfx: v }); play('click'); }} />
      <Toggle label="Mute all sound" value={s.muted} onChange={(v) => apply({ muted: v })} />
      <Toggle label="Auto-accelerate (touch)" value={s.autoGas} onChange={(v) => set({ autoGas: v })} note="The kart drives by itself; use BRAKE to stop" />
      <Slider label="Steering sensitivity" min={0.5} max={1.6} step={0.1} value={s.sensitivity} onChange={(v) => set({ sensitivity: v })} />
      <Toggle label="Vibration" value={s.haptics} onChange={(v) => set({ haptics: v })} />
      <Toggle label="Show FPS" value={s.showFps} onChange={(v) => set({ showFps: v })} />
      <div className="row">
        <span>Graphics quality</span>
        <div className="seg">
          {['auto', 'low', 'medium', 'high'].map((q) => <button key={q} className={s.quality === q ? 'on' : ''} onClick={() => set({ quality: q })}>{q}</button>)}
        </div>
      </div>
      {failed && <p className="warn">Progress could not be saved (browser storage is blocked or full).</p>}
    </div>
  );
}

export function PauseMenu() {
  const settingsOpen = useStore((s) => s.settingsOpen);
  const { setPaused, openSettings, replay, quitRace } = useStore.getState();
  if (settingsOpen) {
    return (
      <div className="overlay"><div className="panel modal">
        <h2>Settings</h2>
        <SettingsPanel />
        <button className="btn gold" onClick={() => openSettings(false)}>Back</button>
      </div></div>
    );
  }
  return (
    <div className="overlay"><div className="panel modal narrow">
      <h2>Paused</h2>
      <button className="btn gold" onClick={() => setPaused(false)}>Resume</button>
      <button className="btn" onClick={() => replay()}>Restart race</button>
      <button className="btn" onClick={() => openSettings(true)}>Settings</button>
      <button className="btn dark" onClick={() => quitRace()}>Quit to map</button>
      <p className="hint">Keys: arrows / WASD drive · Space drift · Shift boost · R reset · Esc pause</p>
    </div></div>
  );
}
