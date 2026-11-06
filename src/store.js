import { create } from 'zustand';
import { loadSave, persist } from './game/save.js';
import { TRACK_LIST } from './game/tracks.js';
import { nextTrackIndex, applyRace, claimMission, buyKart, buyPaint, buyDriver, buyWing, buyUpgrade, equipKart, equipPaint, equipDriver, equipWing } from './game/progress.js';

export function detectTier() {
  const mobile = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0) && window.matchMedia('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 4;
  if (mobile && (cores <= 4 || mem <= 3)) return 'low';
  if (mobile) return 'medium';
  return cores >= 8 ? 'high' : 'medium';
}
export const effectiveQuality = (q) => (q === 'auto' ? detectTier() : q);

const initial = loadSave();

export const useStore = create((set, get) => {
  // run a progress function, keep the new save and write it to localStorage right away (rewards can never be taken twice)
  const act = (fn, ...args) => {
    const r = fn(get().save, ...args);
    if (r.ok) { persist(r.save); set({ save: r.save }); }
    return r;
  };
  return {
    save: initial,
    screen: 'menu',        // menu | map | garage | missions | settings | race | results
    selected: Math.min(nextTrackIndex(initial), TRACK_LIST.length - 1),
    trackIndex: 0,
    raceKey: 0,
    paused: false,
    settingsOpen: false,
    results: null,
    saveFailed: false,

    go: (screen) => set({ screen, paused: false, settingsOpen: false }),
    select: (i) => set({ selected: i }),
    continueAdventure: () => set({ screen: 'map', selected: nextTrackIndex(get().save) }),
    startRace: (i) => { if (i >= get().save.unlocked) return; set({ screen: 'race', trackIndex: i, selected: i, raceKey: get().raceKey + 1, paused: false, settingsOpen: false, results: null }); },
    replay: () => get().startRace(get().trackIndex),
    nextTrack: () => { const i = Math.min(get().trackIndex + 1, TRACK_LIST.length - 1); if (i < get().save.unlocked) get().startRace(i); else set({ screen: 'map', selected: get().trackIndex }); },
    quitRace: () => set({ screen: 'map', paused: false, settingsOpen: false }),
    setPaused: (paused) => set({ paused }),
    openSettings: (settingsOpen) => set({ settingsOpen }),

    setSetting: (patch) => {
      const save = { ...get().save, settings: { ...get().save.settings, ...patch } };
      set({ save, saveFailed: !persist(save) });
    },

    // called once when the player's race is over
    finishRace: (world) => {
      const me = world.results.find((r) => r.isPlayer);
      const { save, summary } = applyRace(get().save, get().trackIndex, me, world.stats);
      const ok = persist(save);
      set({ save, saveFailed: !ok, screen: 'results', paused: false, results: { summary, rows: world.results, trackIndex: get().trackIndex, laps: world.laps } });
    },

    claim: (id) => act(claimMission, id),
    buyKart: (id) => act(buyKart, id), buyPaint: (id, k) => act(buyPaint, id, k), buyDriver: (id) => act(buyDriver, id), buyWing: (id) => act(buyWing, id),
    buyUpgrade: (kart, stat) => act(buyUpgrade, kart, stat),
    equipKart: (id) => act(equipKart, id), equipPaint: (id, k) => act(equipPaint, id, k), equipDriver: (id) => act(equipDriver, id), equipWing: (id) => act(equipWing, id),
    resetSave: () => { try { localStorage.removeItem('skykart3d.save.v1'); } catch { /* ignore */ } const s = loadSave(); set({ save: s, selected: 0 }); },
  };
});

export const fmt = (t) => {
  if (t == null || !isFinite(t)) return '--:--.--';
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`;
};
