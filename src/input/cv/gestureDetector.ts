import { OneEuroFilter } from './oneEuro';
import { L } from './landmarks';

/** Minimal landmark shape, so tests can pass plain objects. */
export interface Point { x: number; y: number }

/**
 * Baseline captured by calibration. Image coordinates (0..1, y grows downward,
 * x is NOT mirrored). Defaults let gestures be tested before calibration exists.
 */
export interface Calibration {
  shoulderWidth: number;
  hipX: number;
  hipY: number;
  shoulderY: number;
}

export const DEFAULT_CALIBRATION: Calibration = {
  shoulderWidth: 0.25,
  hipX: 0.5,
  hipY: 0.6,
  shoulderY: 0.35,
};

/** All distances are in shoulder widths, so they work at any height / distance. */
export const THRESHOLDS = {
  flapWindowMs: 400, //     leaving the raised zone -> crossing the shoulder line
  flapZoneMargin: 0.15, //  re-arm only after wrists rise this far above the shoulders
  flapDownMargin: 0.02, //  fire just below the shoulder line, early in the downstroke
  flapMinDownSpeed: 1.2, // shoulder widths / s; a slow arm drop must not count
  flapRefractoryMs: 120,
  flapPairMs: 400, //       both wrists' downstrokes must land within this of each other
  flapActiveMs: 500, //     `flapping` stays true this long after a flap
  rateWindowMs: 3000,
  strafeDeadzone: 0.08, //  analog strafe ignores sway smaller than this (shoulder widths)
  strafeFull: 0.45, //      analog strafe reaches +-1 at this offset
  strafeEnter: 0.35, //     boolean strafeLeft/Right (menus) turn on here
  strafeExit: 0.2, //       hysteresis: must come back this close to centre to release
  jumpEnter: 0.25,
  jumpExit: 0.12,
  jumpMinUpSpeed: 0.5, //   shoulder widths / s upward at the moment of entering
  squatEnter: 0.4,
  squatExit: 0.25,
  refractoryMs: 250,
  swipeWindowMs: 500, //    the sweep must happen within this
  swipeDistance: 1.0, //    right wrist travels this far (shoulder widths) relative to the shoulders
  swipeMaxDrift: 0.6, //    ...and may rise/fall at most this much, so flaps do not count
  swipeRefractoryMs: 800,
};

export interface GestureState {
  tracking: boolean;
  flapping: boolean;
  flapVelocity: number;
  flapCount: number;
  flapRate: number;
  /** Total right-arm swipes (left -> right on the mirrored view). Only ever increases. */
  swipeCount: number;
  /** Analog strafe: -1 (fully left) .. 0 (centre) .. +1 (fully right), proportional to how far you lean/step. */
  strafe: number;
  strafeLeft: boolean;
  strafeRight: boolean;
  jump: boolean;
  squat: boolean;
}

// Landmark units are image fractions, so speeds are small numbers (~0.1-2 /s): beta must be large.
const mkWristFilter = () => new OneEuroFilter(6.0, 12.0);
const mkBodyFilter = () => new OneEuroFilter(4.0, 8.0);

export function createGestureDetector() {
  const f = {
    wristLy: mkWristFilter(), wristRy: mkWristFilter(),
    shoulderY: mkBodyFilter(),
    hipX: mkBodyFilter(), hipY: mkBodyFilter(),
    shoulderX: mkBodyFilter(),
    wristRx: mkWristFilter(),
  };

  // flap
  const wrist = {
    L: { above: false, lastAboveTs: 0, downTs: -Infinity, prevY: null as number | null },
    R: { above: false, lastAboveTs: 0, downTs: -Infinity, prevY: null as number | null },
  };
  let flapCount = 0;
  let lastFlapTs = -Infinity;
  let flapTimes: number[] = [];
  let flapSpeed = 0;

  // swipe: right wrist position relative to the shoulders, last ~500 ms
  let swipeCount = 0;
  let lastSwipeTs = -Infinity;
  let swipeTrail: { ts: number; rel: number; y: number }[] = [];

  // held gestures
  let strafe = 0;
  let strafeLeft = false;
  let strafeRight = false;
  let jump = false;
  let squat = false;
  const lastExit = { strafeLeft: -Infinity, strafeRight: -Infinity, jump: -Infinity, squat: -Infinity };

  let prevHipY: number | null = null;
  let prevTs = 0;

  function reset() {
    Object.values(f).forEach((x) => x.reset());
    for (const w of [wrist.L, wrist.R]) {
      w.above = false; w.downTs = -Infinity; w.prevY = null;
    }
    swipeTrail = [];
    strafe = 0;
    strafeLeft = strafeRight = jump = squat = false;
    prevHipY = null;
    flapSpeed = 0;
  }

  /** Enter above `enter`, leave below `exit`; re-entry blocked for refractoryMs after leaving. */
  function hold(name: keyof typeof lastExit, on: boolean, value: number, enter: number, exit: number, ts: number, extra = true) {
    if (!on) {
      if (value > enter && extra && ts - lastExit[name] >= THRESHOLDS.refractoryMs) return true;
      return false;
    }
    if (value < exit) {
      lastExit[name] = ts;
      return false;
    }
    return true;
  }

  function update(lm: ArrayLike<Point> | null, ts: number, calib: Calibration = DEFAULT_CALIBRATION): GestureState {
    if (!lm || lm.length < 25) {
      reset();
      return snapshot(false, ts);
    }
    const sw = calib.shoulderWidth;
    const dt = Math.max((ts - prevTs) / 1000, 1e-3);

    const shoulderY = f.shoulderY.filter((lm[L.SHOULDER_L].y + lm[L.SHOULDER_R].y) / 2, ts);
    const hipX = f.hipX.filter((lm[L.HIP_L].x + lm[L.HIP_R].x) / 2, ts);
    const hipY = f.hipY.filter((lm[L.HIP_L].y + lm[L.HIP_R].y) / 2, ts);
    const wy = { L: f.wristLy.filter(lm[L.WRIST_L].y, ts), R: f.wristRy.filter(lm[L.WRIST_R].y, ts) };

    // Both wrists must rise to re-arm, then cross the shoulders on a brisk downstroke.
    let speedSum = 0;
    for (const side of ['L', 'R'] as const) {
      const w = wrist[side];
      const y = wy[side];
      const downSpeed = w.prevY === null ? 0 : (y - w.prevY) / dt / sw;
      if (y < shoulderY - THRESHOLDS.flapZoneMargin * sw) {
        w.above = true;
        w.lastAboveTs = ts; // last moment the wrist was still in the top zone
      } else if (w.above && y > shoulderY + THRESHOLDS.flapDownMargin * sw) {
        if (ts - w.lastAboveTs <= THRESHOLDS.flapWindowMs && downSpeed >= THRESHOLDS.flapMinDownSpeed) w.downTs = ts;
        w.above = false;
      }
      if (w.prevY !== null) speedSum += Math.abs(y - w.prevY) / dt / sw;
      w.prevY = y;
    }
    flapSpeed += 0.3 * (speedSum / 2 - flapSpeed);

    const { L: wl, R: wr } = wrist;
    if (
      ts - wl.downTs <= THRESHOLDS.flapPairMs &&
      ts - wr.downTs <= THRESHOLDS.flapPairMs &&
      ts - lastFlapTs >= THRESHOLDS.flapRefractoryMs
    ) {
      flapCount++;
      lastFlapTs = ts;
      flapTimes.push(ts);
      wl.downTs = wr.downTs = -Infinity;
    }
    flapTimes = flapTimes.filter((t) => ts - t <= THRESHOLDS.rateWindowMs);

    // ---- swipe: right arm sweeps from the player's left, across the body, out to their right ----
    // Measured relative to the shoulders, so leaning or stepping sideways does not count.
    // Image x is not mirrored: the player's right is SMALLER x, so a swipe is x decreasing.
    const shoulderX = f.shoulderX.filter((lm[L.SHOULDER_L].x + lm[L.SHOULDER_R].x) / 2, ts);
    const rel = (f.wristRx.filter(lm[L.WRIST_R].x, ts) - shoulderX) / sw;
    swipeTrail.push({ ts, rel, y: (wy.R - shoulderY) / sw });
    while (swipeTrail.length && ts - swipeTrail[0].ts > THRESHOLDS.swipeWindowMs) swipeTrail.shift();
    const startRel = Math.max(...swipeTrail.map((p) => p.rel));
    const yRange = Math.max(...swipeTrail.map((p) => p.y)) - Math.min(...swipeTrail.map((p) => p.y));
    if (
      startRel - rel >= THRESHOLDS.swipeDistance &&
      yRange <= THRESHOLDS.swipeMaxDrift &&
      ts - lastSwipeTs >= THRESHOLDS.swipeRefractoryMs
    ) {
      swipeCount++;
      lastSwipeTs = ts;
      swipeTrail = [];
    }

    // ---- body position gestures (relative to calibrated baseline) ----
    // Image x is not mirrored: stepping to your own LEFT moves you to larger x.
    const dx = (hipX - calib.hipX) / sw;
    const rise = (calib.hipY - hipY) / sw; // positive = hips higher than baseline
    const upSpeed = prevHipY === null ? 0 : -(hipY - prevHipY) / dt / sw;

    strafeLeft = hold('strafeLeft', strafeLeft, dx, THRESHOLDS.strafeEnter, THRESHOLDS.strafeExit, ts);
    strafeRight = hold('strafeRight', strafeRight, -dx, THRESHOLDS.strafeEnter, THRESHOLDS.strafeExit, ts);
    jump = hold('jump', jump, rise, THRESHOLDS.jumpEnter, THRESHOLDS.jumpExit, ts, upSpeed >= THRESHOLDS.jumpMinUpSpeed);
    squat = hold('squat', squat, -rise, THRESHOLDS.squatEnter, THRESHOLDS.squatExit, ts);
    if (squat) jump = false;

    // Analog: linear ramp from the deadzone edge to strafeFull. Positive dx (image) = player's left => negative.
    const mag = Math.min(1, Math.max(0, (Math.abs(dx) - THRESHOLDS.strafeDeadzone) / (THRESHOLDS.strafeFull - THRESHOLDS.strafeDeadzone)));
    strafe = dx > 0 ? -mag : mag;

    prevHipY = hipY;
    prevTs = ts;
    return snapshot(true, ts);
  }

  function snapshot(tracking: boolean, ts: number): GestureState {
    const flapping = tracking && ts - lastFlapTs <= THRESHOLDS.flapActiveMs;
    return {
      tracking,
      flapping,
      flapVelocity: flapping ? flapSpeed : 0,
      flapCount,
      flapRate: flapTimes.length / (THRESHOLDS.rateWindowMs / 1000),
      swipeCount,
      strafe, strafeLeft, strafeRight, jump, squat,
    };
  }

  return { update, reset };
}
