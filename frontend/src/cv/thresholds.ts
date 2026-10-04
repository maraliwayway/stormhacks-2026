// Owner: Dev 1. Starting values from docs/gesture-spec.md.
// All distances are multiples of calibrated shoulder width.
// Update docs/gesture-spec.md "Tuning log" whenever you change these.

export const THRESHOLDS = {
  flapWindowMs: 400,
  strafeOffset: 0.35,
  strafeHysteresis: 0.08,
  jumpRise: 0.25,
  jumpMinVelocity: 0.6, // shoulder widths per second, upward
  squatDrop: 0.4,
  refractoryMs: 250,
  bodyLostRecalibrateMs: 2000,
  minVisibility: 0.5,
};

/** One Euro filter params. Lower minCutoff = smoother, higher beta = less lag. */
export const FILTER = { minCutoff: 1.5, beta: 0.02, dCutoff: 1.0 };

/** MediaPipe Pose landmark indices. */
export const LM = {
  L_SHOULDER: 11,
  R_SHOULDER: 12,
  L_WRIST: 15,
  R_WRIST: 16,
  L_HIP: 23,
  R_HIP: 24,
  L_KNEE: 25,
  R_KNEE: 26,
} as const;
