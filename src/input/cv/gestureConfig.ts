import type { Calibration } from "./gestureTypes";

export const DEFAULT_CALIBRATION: Calibration = {
  shoulderWidth: 0.25,
  hipX: 0.5,
  hipY: 0.6,
  shoulderY: 0.35,
};

/** All distances are in shoulder widths, so they work at any height / distance. */
export const THRESHOLDS = {
  flapWindowMs: 400, // leaving the raised zone -> crossing the shoulder line
  flapZoneMargin: 0.15, // re-arm only after wrists rise this far above the shoulders
  flapDownMargin: 0.02, // fire just below the shoulder line, early in the downstroke
  flapMinDownSpeed: 1.2, // shoulder widths / s; a slow arm drop must not count
  flapRefractoryMs: 120,
  flapPairMs: 400, // both wrists' downstrokes must land within this of each other
  flapActiveMs: 500, // `flapping` stays true this long after a flap
  rateWindowMs: 3000,
  strafeDeadzone: 0.08, // analog strafe ignores sway smaller than this (shoulder widths)
  strafeFull: 0.45, // analog strafe reaches +-1 at this offset
  strafeEnter: 0.35, // boolean strafeLeft/Right (menus) turn on here
  strafeExit: 0.2, // hysteresis: must come back this close to centre to release
  jumpEnter: 0.25,
  jumpExit: 0.12,
  jumpMinUpSpeed: 0.5, // shoulder widths / s upward at the moment of entering
  squatEnter: 0.4,
  squatExit: 0.25,
  refractoryMs: 250,
  waveWindowMs: 1200,
  waveDistance: 0.25, // small side-to-side travel in shoulder widths, in each direction
  waveRaiseMargin: 0.1, // wrist above shoulder height
  waveMaxDrift: 0.35, // reject vertical flapping motion
};
