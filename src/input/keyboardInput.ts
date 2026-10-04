import { EMPTY_INPUT, type InputSource, type InputState } from './types';

const RATE_WINDOW_MS = 3000;

/**
 * Keyboard fallback with the same InputState as CV (for bad lighting, or building
 * the game without a camera).
 *   Space = flap | Left/A, Right/D = strafe | Up/W = jump | Down/S = squat
 */
export function createKeyboardInput(target: EventTarget = window, now: () => number = () => performance.now()): InputSource {
  const down = new Set<string>();
  let flapCount = 0;
  let flapTimes: number[] = [];
  let lastFlapTs = -Infinity;

  const state: InputState = { ...EMPTY_INPUT, tracking: true, calibrated: true };

  const has = (...keys: string[]) => keys.some((k) => down.has(k));

  const refresh = () => {
    const left = has('arrowleft', 'a');
    const right = has('arrowright', 'd');
    state.strafeLeft = left && !right;
    state.strafeRight = right && !left;
    state.strafe = state.strafeRight ? 1 : state.strafeLeft ? -1 : 0;
    state.jump = has('arrowup', 'w');
    state.squat = has('arrowdown', 's') && !state.jump;
    state.flapping = has(' ');
    state.flapVelocity = state.flapping ? 1 : 0;
  };

  const GAME_KEYS = new Set([' ', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'a', 'd', 'w', 's']);

  const onDown = (e: Event) => {
    const ev = e as KeyboardEvent;
    if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const k = ev.key.toLowerCase();
    if (!GAME_KEYS.has(k)) return;
    ev.preventDefault?.();
    if (k === ' ' && !down.has(' ')) {
      const t = now();
      flapCount++;
      flapTimes.push(t);
      lastFlapTs = t;
    }
    down.add(k);
    refresh();
  };
  const onUp = (e: Event) => {
    down.delete((e as KeyboardEvent).key.toLowerCase());
    refresh();
  };
  const onBlur = () => { down.clear(); refresh(); };

  return {
    getState() {
      const t = now();
      flapTimes = flapTimes.filter((x) => t - x <= RATE_WINDOW_MS);
      state.flapCount = flapCount;
      state.flapRate = flapTimes.length / (RATE_WINDOW_MS / 1000);
      // Like CV: stays "flapping" briefly after a tap so single taps register.
      state.flapping = has(' ') || t - lastFlapTs <= 300;
      state.flapVelocity = state.flapping ? 1 : 0;
      return state;
    },
    start: async () => {
      target.addEventListener('keydown', onDown);
      target.addEventListener('keyup', onUp);
      globalThis.addEventListener?.('blur', onBlur);
    },
    stop() {
      target.removeEventListener('keydown', onDown);
      target.removeEventListener('keyup', onUp);
      globalThis.removeEventListener?.('blur', onBlur);
      down.clear();
      refresh();
    },
  };
}
