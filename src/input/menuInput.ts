import type { InputState } from './types';

export type MenuEvent = 'up' | 'down' | 'left' | 'right' | 'confirm';

export const MENU = {
  confirmFlaps: 2, //      flaps needed to confirm...
  confirmWindowMs: 1500, // ...within this window, so one stray arm swing can't select
};

const NONE: readonly MenuEvent[] = [];

/**
 * Turns InputState into discrete menu events, so menus use the same input as gameplay
 * (CV or keyboard) and there is no separate menu input code.
 *   strafe left/right -> 'left' / 'right'   (rising edge, one event per lean)
 *   jump              -> 'up'
 *   squat             -> 'down'
 *   2 flaps in 1.5 s  -> 'confirm'
 * Call poll() once per frame from the scene; it returns the events since the last call.
 * Nothing fires while the player is not tracked or not calibrated.
 */
export function createMenuInput(getState: () => Readonly<InputState>, now: () => number = () => performance.now()) {
  let prev = { left: false, right: false, up: false, down: false };
  let lastFlapCount: number | null = null;
  let flapTimes: number[] = [];

  return {
    poll(): readonly MenuEvent[] {
      const s = getState();
      const t = now();
      const events: MenuEvent[] = [];

      const active = s.tracking && s.calibrated;
      const cur = {
        left: active && s.strafeLeft,
        right: active && s.strafeRight,
        up: active && s.jump,
        down: active && s.squat,
      };
      if (cur.left && !prev.left) events.push('left');
      if (cur.right && !prev.right) events.push('right');
      if (cur.up && !prev.up) events.push('up');
      if (cur.down && !prev.down) events.push('down');
      prev = cur;

      // First poll only records the baseline, so flaps from before the menu opened do not count.
      if (lastFlapCount === null || !active) {
        lastFlapCount = s.flapCount;
        if (!active) flapTimes = [];
      } else if (s.flapCount > lastFlapCount) {
        for (let i = lastFlapCount; i < s.flapCount; i++) flapTimes.push(t);
        lastFlapCount = s.flapCount;
      }
      flapTimes = flapTimes.filter((x) => t - x <= MENU.confirmWindowMs);
      if (flapTimes.length >= MENU.confirmFlaps) {
        events.push('confirm');
        flapTimes = [];
      }

      return events.length ? events : NONE;
    },

    /** 0..1 progress towards confirm, for a "flap to start" hint animation. */
    confirmProgress(): number {
      const t = now();
      const n = flapTimes.filter((x) => t - x <= MENU.confirmWindowMs).length;
      return Math.min(1, n / MENU.confirmFlaps);
    },

    /** Clear state, e.g. when switching scenes so a held pose does not carry over. */
    reset() {
      prev = { left: false, right: false, up: false, down: false };
      lastFlapCount = null;
      flapTimes = [];
    },
  };
}
