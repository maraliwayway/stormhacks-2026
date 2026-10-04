import type { Calibration } from "./gestureTypes";

export const DEFAULT_CALIBRATION: Calibration = {
  shoulderWidth: 0.25,
  hipX: 0.5,
  hipY: 0.6,
  shoulderY: 0.35,
};

/** All distances are in shoulder widths, so they work at any height / distance. */
export const THRESHOLDS = {
  flapWindowMs: 500, // leaving the raised zone -> crossing the shoulder line
  flapZoneMargin: 0.15, // re-arm only after wrists rise this far above the shoulders
  flapDownMargin: 0.02, // fire just below the shoulder line, early in the downstroke
  flapMinDownSpeed: 1.0, // relative shoulder widths / s; body movement does not add arm speed
  flapMinTravel: 0.22,
  flapRefractoryMs: 120,
  flapPairMs: 220, // both downstrokes must belong to the same armed cycle
  flapActiveMs: 500, // `flapping` stays true this long after a flap
  rateWindowMs: 3000,
  strafeDeadzone: 0.05, // ignore small sway but respond to a comfortable torso tilt
  strafeFull: 0.35,
  strafeEnter: 0.35, // boolean strafeLeft/Right (menus) turn on here
  strafeExit: 0.2, // hysteresis: must come back this close to centre to release
  jumpEnter: 0.25,
  jumpExit: 0.12,
  jumpMinUpSpeed: 0.5, // shoulder widths / s upward at the moment of entering
  squatEnter: 0.4,
  squatExit: 0.25,
  refractoryMs: 250,
  minLandmarkConfidence: 0.5,
  maxGestureGapMs: 250,
  swipeWindowMs: 900,
  swipeMinDurationMs: 80,
  swipeDistance: 0.8,
  swipeStartOffset: 0.3,
  swipeHeightRange: 0.55,
  swipeOtherHandDown: 0.2,
  swipeMaxVerticalDrift: 0.25,
  swipeMaxBodyDrift: 0.3,
  swipeMaxBacktrack: 0.12,
  swipeCooldownMs: 300,
};
