import type { Calibration } from "./gestureTypes";

export const DEFAULT_CALIBRATION: Calibration = {
  shoulderWidth: 0.25,
  hipX: 0.5,
  hipY: 0.6,
  shoulderY: 0.35,
};

/** All distances are in shoulder widths, so they work at any height / distance. */
export const THRESHOLDS = {
  flapWindowMs: 700,
  flapZoneMargin: 0.08, // an initial raised pose can prepare the first downstroke
  flapMinDownSpeed: 0.35, // shoulder widths / s, relative to the torso
  flapMinTravel: 0.08, // small up/down strokes work at any arm height
  flapPeakTolerance: 0.015,
  flapRefractoryMs: 100,
  flapPairMs: 350,
  flapActiveMs: 500, // `flapping` stays true this long after a flap
  rateWindowMs: 3000,
  jumpEnter: 0.25,
  jumpExit: 0.12,
  jumpMinUpSpeed: 0.5, // shoulder widths / s upward at the moment of entering
  squatEnter: 0.4,
  squatExit: 0.25,
  refractoryMs: 250,
  minLandmarkConfidence: 0.25,
  minHandConfidence: 0.15,
  minHipConfidence: 0.5,
  maxGestureGapMs: 600,
  prayerCloseDistance: 0.3,
  prayerOpenDistance: 0.6,
  prayerWristDistance: 0.6,
  prayerHoldMs: 60,
  prayerHeightAbove: 0.5,
  prayerHeightBelow: 0.8,
  prayerCentreOffset: 0.65,
  swipeWindowMs: 900,
  swipeMinDurationMs: 80,
  swipeDistance: 0.4,
  swipeStartOffset: 0.15,
  swipeHeightRange: 0.55,
  swipeOtherHandDown: 0.2,
  swipeMaxVerticalDrift: 0.25,
  swipeMaxBodyDrift: 0.3,
  swipeMaxBacktrack: 0.12,
  swipeCooldownMs: 300,
};
