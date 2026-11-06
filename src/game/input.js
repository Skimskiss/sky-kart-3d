// Merged keyboard + gamepad + touch input. Written to plain objects so the game loop never touches React.
export const input = { steer: 0, throttle: 0, brake: 0, drift: false, boost: false, rear: false, reset: false };
export const touch = { enabled: false, steer: 0, gas: false, brake: false, drift: false, boost: false };

const keys = new Set();
let onPause = null;
let padPausePrev = false;

export function bindKeyboard(pauseFn) {
  onPause = pauseFn;
  const down = (e) => {
    if (e.code === 'Escape' || e.code === 'KeyP') { if (!e.repeat) onPause && onPause(); e.preventDefault(); return; }
    keys.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  };
  const up = (e) => keys.delete(e.code);
  const blur = () => resetInput();
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', blur);
  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
    window.removeEventListener('blur', blur);
    resetInput();
  };
}

const has = (...c) => c.some((k) => keys.has(k));

export function pollInput(settings) {
  let steer = 0, throttle = 0, brake = 0, drift = false, boost = false, rear = false, reset = false;
  if (has('ArrowLeft', 'KeyA')) steer -= 1;
  if (has('ArrowRight', 'KeyD')) steer += 1;
  if (has('ArrowUp', 'KeyW')) throttle = 1;
  if (has('ArrowDown', 'KeyS')) brake = 1;
  drift = has('Space');
  boost = has('ShiftLeft', 'ShiftRight', 'KeyB');
  rear = has('KeyC');
  reset = has('KeyR');

  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = pads && Array.from(pads).find((p) => p && p.connected);
  if (gp) {
    const ax = gp.axes[0] || 0;
    if (Math.abs(ax) > 0.12) steer = ax;
    const rt = gp.buttons[7] ? gp.buttons[7].value : 0;
    const lt = gp.buttons[6] ? gp.buttons[6].value : 0;
    if (rt > 0.05 || (gp.buttons[0] && gp.buttons[0].pressed)) throttle = Math.max(throttle, rt || 1);
    if (lt > 0.05 || (gp.buttons[1] && gp.buttons[1].pressed)) brake = Math.max(brake, lt || 1);
    if (gp.buttons[5] && gp.buttons[5].pressed) drift = true;
    if (gp.buttons[2] && gp.buttons[2].pressed) boost = true;
    if (gp.buttons[4] && gp.buttons[4].pressed) rear = true;
    const ps = !!(gp.buttons[9] && gp.buttons[9].pressed);
    if (ps && !padPausePrev && onPause) onPause();
    padPausePrev = ps;
  }

  if (touch.enabled) {
    if (touch.steer !== 0) steer = touch.steer;
    if (touch.gas) throttle = 1;
    if (settings.autoGas && !touch.brake) throttle = 1;
    if (touch.brake) { brake = 1; throttle = 0; }
    if (touch.drift) drift = true;
    if (touch.boost) boost = true;
  }
  input.steer = Math.max(-1, Math.min(1, steer));
  input.throttle = throttle; input.brake = brake; input.drift = drift; input.boost = boost; input.rear = rear; input.reset = reset;
}

// Touch controls are shown on touch devices, and in any very narrow window.
export const wantsTouchUi = () => ('ontouchstart' in window) || navigator.maxTouchPoints > 0 || window.innerWidth < 720;

// Clears every held input (keys and touches). Called on focus loss, pause and when a race ends.
export function resetInput() {
  keys.clear();
  Object.assign(touch, { steer: 0, gas: false, brake: false, drift: false, boost: false });
  Object.assign(input, { steer: 0, throttle: 0, brake: 0, drift: false, boost: false, rear: false, reset: false });
}

export function haptic(ms) {
  try {
    const ua = navigator.userActivation;
    if (navigator.vibrate && (!ua || ua.hasBeenActive)) navigator.vibrate(ms);
  } catch { /* ignore */ }
}
