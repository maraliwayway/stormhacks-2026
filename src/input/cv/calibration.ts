import { L } from './landmarks';
import type { Calibration } from './gestureDetector';

export interface CalPoint { x: number; y: number; visibility?: number }

export const CAL = {
  captureMs: 2000, //      baseline length; with the time to step into the box, total stays under ~5 s
  lostPromptMs: 2000, //   body missing this long after calibration => ask to recalibrate
  edgeMargin: 0.02, //     landmarks closer than this to the image edge count as cut off
  minVisibility: 0.5,
  maxSpread: 0.4, //       hips may wander at most this many shoulder widths during capture
  minShoulderWidth: 0.05,
};

/** Landmarks that must be visible and inside the frame for "full body in frame". */
const REQUIRED = [
  L.SHOULDER_L, L.SHOULDER_R, L.HIP_L, L.HIP_R,
  L.KNEE_L, L.KNEE_R, L.ANKLE_L, L.ANKLE_R,
];

export function bodyInFrame(lm: ArrayLike<CalPoint> | null): boolean {
  if (!lm || lm.length < 29) return false;
  const lo = CAL.edgeMargin;
  const hi = 1 - CAL.edgeMargin;
  return REQUIRED.every((i) => {
    const p = lm[i];
    return (p.visibility ?? 1) >= CAL.minVisibility && p.x > lo && p.x < hi && p.y > lo && p.y < hi;
  });
}

export type CalibrationPhase = 'idle' | 'waiting' | 'capturing' | 'done';

export interface CalibrationStatus {
  phase: CalibrationPhase;
  /** 0..1 through the capture window. */
  progress: number;
  bodyInFrame: boolean;
  /** Set once phase is 'done'; kept until the next start(). */
  calibration: Calibration | null;
}

interface Sample { sw: number; hipX: number; hipY: number; shoulderY: number; shoulderX: number }

const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const spread = (a: number[]) => Math.max(...a) - Math.min(...a);

export function createCalibrator() {
  let phase: CalibrationPhase = 'idle';
  let startTs = 0;
  let samples: Sample[] = [];
  let calibration: Calibration | null = null;

  const status = (inFrame: boolean, ts: number): CalibrationStatus => ({
    phase,
    progress: phase === 'capturing' ? Math.min(1, (ts - startTs) / CAL.captureMs) : phase === 'done' ? 1 : 0,
    bodyInFrame: inFrame,
    calibration,
  });

  /** Begin (or restart) calibration. The old baseline stays valid until a new one completes. */
  function start() {
    phase = 'waiting';
    samples = [];
  }

  function update(lm: ArrayLike<CalPoint> | null, ts: number): CalibrationStatus {
    const inFrame = bodyInFrame(lm);
    if (phase === 'idle' || phase === 'done' || !lm) {
      if (phase === 'capturing') { phase = 'waiting'; samples = []; }
      return status(inFrame, ts);
    }

    if (!inFrame) {
      phase = 'waiting';
      samples = [];
      return status(false, ts);
    }

    if (phase === 'waiting') {
      phase = 'capturing';
      startTs = ts;
      samples = [];
    }

    samples.push({
      sw: Math.abs(lm[L.SHOULDER_L].x - lm[L.SHOULDER_R].x),
      hipX: (lm[L.HIP_L].x + lm[L.HIP_R].x) / 2,
      hipY: (lm[L.HIP_L].y + lm[L.HIP_R].y) / 2,
      shoulderY: (lm[L.SHOULDER_L].y + lm[L.SHOULDER_R].y) / 2,
      shoulderX: (lm[L.SHOULDER_L].x + lm[L.SHOULDER_R].x) / 2,
    });

    if (ts - startTs >= CAL.captureMs) {
      const sw = median(samples.map((s) => s.sw));
      const moved = Math.max(spread(samples.map((s) => s.hipX)), spread(samples.map((s) => s.hipY))) / sw;
      if (sw < CAL.minShoulderWidth || moved > CAL.maxSpread) {
        // Player was still walking into position (or too far away): try again.
        phase = 'capturing';
        startTs = ts;
        samples = [];
      } else {
        calibration = {
          shoulderWidth: sw,
          hipX: median(samples.map((s) => s.hipX)),
          hipY: median(samples.map((s) => s.hipY)),
          shoulderY: median(samples.map((s) => s.shoulderY)),
          shoulderX: median(samples.map((s) => s.shoulderX)),
        };
        phase = 'done';
        samples = [];
      }
    }
    return status(true, ts);
  }

  return { start, update };
}

/** True once the body has been missing for lostPromptMs. Resets as soon as it is back. */
export function createLostBodyMonitor() {
  let lostSince: number | null = null;
  return {
    update(tracking: boolean, ts: number): boolean {
      if (tracking) { lostSince = null; return false; }
      if (lostSince === null) lostSince = ts;
      return ts - lostSince >= CAL.lostPromptMs;
    },
  };
}
