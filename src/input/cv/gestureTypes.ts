/** Minimal landmark shape, so tests can pass plain objects. */
export interface Point {
  x: number;
  y: number;
  visibility?: number;
  presence?: number;
}

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
  /** Resting shoulder slope in shoulder widths, to avoid treating posture as steering. */
  shoulderRoll?: number;
}

export interface GestureState {
  tracking: boolean;
  flapping: boolean;
  flapVelocity: number;
  flapCount: number;
  flapRate: number;
  swipeLeftCount: number;
  swipeRightCount: number;
  lastSwipeDirection: -1 | 0 | 1;
  swipeInProgress: boolean;
  /** Analog strafe: -1 (fully left) .. 0 (centre) .. +1 (fully right), proportional to how far you lean/step. */
  strafe: number;
  strafeLeft: boolean;
  strafeRight: boolean;
  jump: boolean;
  squat: boolean;
}

/** Smoothed image coordinates before conversion to shoulder widths. */
export interface FilteredPose {
  shoulderX: number;
  shoulderY: number;
  shoulderLeftY: number;
  shoulderRightY: number;
  hipX: number;
  hipY: number;
  wristX: Record<HandSide, number>;
  wristY: Record<HandSide, number>;
}

export type HandSide = "left" | "right";
export const HAND_SIDES: readonly HandSide[] = ["left", "right"];
