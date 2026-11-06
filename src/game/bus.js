// Tiny mutable bridge between the render loop and the DOM HUD (read by timers, never by React renders).
export const bus = { world: null, toast: '', toastT: 0, fps: 0, dpr: 1, quality: 'medium', frames: 0 };
if (typeof window !== 'undefined') window.__sky = bus;
export function toast(text, seconds = 1.6) {
  bus.toast = text;
  bus.toastT = performance.now() + seconds * 1000;
}
