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
  /** Optional for compatibility with existing calibration producers. */
  shoulderX?: number;
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
  waveWindowMs: 1200,
  waveDistance: 0.25, // small side-to-side travel in shoulder widths, in each direction
  waveRaiseMargin: 0.1, // wrist above shoulder height
  waveMaxDrift: 0.35, // reject vertical flapping motion
};

export interface GestureState {
  tracking: boolean;
  flapping: boolean;
  flapVelocity: number;
  flapCount: number;
  flapRate: number;
  /** Total completed hand waves. Only ever increases. */
  waveCount: number;
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
    wristLx: mkWristFilter(), wristRx: mkWristFilter(),
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

  // One raised hand moves sideways and back; lower both hands before confirming again.
  let waveCount = 0;
  let waveLatched = false;
  type Wave = { start: number; low: number; high: number; peak: number; direction: number; y: number };
  const waves: { L: Wave | null; R: Wave | null } = { L: null, R: null };

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
    waves.L = waves.R = null;
    waveLatched = false;
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

    const shoulderX = f.shoulderX.filter((lm[L.SHOULDER_L].x + lm[L.SHOULDER_R].x) / 2, ts);
    const wx = { L: f.wristLx.filter(lm[L.WRIST_L].x, ts), R: f.wristRx.filter(lm[L.WRIST_R].x, ts) };
    const raised = { L: wy.L < shoulderY - THRESHOLDS.waveRaiseMargin * sw,
      R: wy.R < shoulderY - THRESHOLDS.waveRaiseMargin * sw };
    if (!raised.L && !raised.R) waveLatched = false;
    for (const side of ['L', 'R'] as const) {
      // A one-hand wave stays separate from two-arm flapping.
      if (waveLatched || !raised[side] || raised[side === 'L' ? 'R' : 'L']) {
        waves[side] = null;
        continue;
      }
      const rel = (wx[side] - shoulderX) / sw;
      const y = (wy[side] - shoulderY) / sw;
      let w = waves[side];
      if (!w || (w.direction !== 0 && ts - w.start > THRESHOLDS.waveWindowMs) || Math.abs(y - w.y) > THRESHOLDS.waveMaxDrift) {
        waves[side] = w = { start: ts, low: rel, high: rel, peak: rel, direction: 0, y };
      }
      if (w.direction === 0) {
        w.low = Math.min(w.low, rel);
        w.high = Math.max(w.high, rel);
        if (rel - w.low >= THRESHOLDS.waveDistance) w.direction = 1;
        else if (w.high - rel >= THRESHOLDS.waveDistance) w.direction = -1;
        if (w.direction !== 0) { w.start = ts; w.peak = rel; }
      } else if (w.direction !== 0) {
        if ((rel - w.peak) * w.direction > 0) w.peak = rel;
        if ((w.peak - rel) * w.direction >= THRESHOLDS.waveDistance) {
          waveCount++;
          waveLatched = true;
          waves.L = waves.R = null;
        }
      }
    }

    // ---- body position gestures (relative to calibrated baseline) ----
    // Image x is not mirrored: stepping to your own LEFT moves you to larger x.
    const hipDx = (hipX - calib.hipX) / sw;
    // A torso tilt moves the shoulders while the hips can stay planted.
    const neutralTilt = (calib.shoulderX ?? calib.hipX) - calib.hipX;
    const tiltDx = (shoulderX - hipX - neutralTilt) / sw;
    const dx = Math.abs(hipDx) >= Math.abs(tiltDx) ? hipDx : tiltDx;
    const rise = (calib.hipY - hipY) / sw; // positive = hips higher than baseline
    const upSpeed = prevHipY === null ? 0 : -(hipY - prevHipY) / dt / sw;

    strafeLeft = hold('strafeLeft', strafeLeft, hipDx, THRESHOLDS.strafeEnter, THRESHOLDS.strafeExit, ts);
    strafeRight = hold('strafeRight', strafeRight, -hipDx, THRESHOLDS.strafeEnter, THRESHOLDS.strafeExit, ts);
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
      waveCount,
      strafe, strafeLeft, strafeRight, jump, squat,
    };
  }

  return { update, reset };
}
