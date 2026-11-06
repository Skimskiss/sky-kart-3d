import React, { useState } from 'react';
import { Shell } from './Shell.jsx';
import { SettingsPanel } from './Pause.jsx';
import { useStore } from '../store.js';

export default function SettingsScreen() {
  const reset = useStore((s) => s.resetSave);
  const [confirm, setConfirm] = useState(false);
  return (
    <Shell title="SETTINGS" active="settings">
      <div className="panel settings-screen">
        <SettingsPanel />
        <div className="danger">
          {!confirm ? <button className="btn dark small" onClick={() => setConfirm(true)}>Reset all progress…</button>
            : <><span>Delete ALL progress, coins and karts?</span><button className="btn small" onClick={() => setConfirm(false)}>Cancel</button><button className="btn small red" onClick={() => { reset(); setConfirm(false); }}>Yes, delete</button></>}
        </div>
        <p className="hint">Sky Kart 3D · all art and sound are made in code. See docs/05-asset-credits.md.</p>
      </div>
    </Shell>
  );
}
