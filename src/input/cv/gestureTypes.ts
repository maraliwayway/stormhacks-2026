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
  prayerCount: number;
  swipeLeftCount: number;
  swipeRightCount: number;
  lastSwipeDirection: -1 | 0 | 1;
  swipeInProgress: boolean;
  steeringMode: "head";
  /** Mirrored camera zone: -1 (left), 0 (centre/untracked), +1 (right). */
  strafe: number;
  strafeLeft: boolean;
  strafeRight: boolean;
  headPosition: number | null;
  turnLeftCount: number;
  turnRightCount: number;
  lastTurnDirection: -1 | 0 | 1;
  jump: boolean;
  squat: boolean;
}

/** Smoothed image coordinates before conversion to shoulder widths. */
export interface FilteredPose {
  shoulderX: number;
  shoulderY: number;
  hipY: number;
  wristX: Record<HandSide, number>;
  wristY: Record<HandSide, number>;
  wristTracked: Record<HandSide, boolean>;
  handX: Record<HandSide, number>;
  handY: Record<HandSide, number>;
  handTracked: Record<HandSide, boolean>;
}

export type HandSide = "left" | "right";
export const HAND_SIDES: readonly HandSide[] = ["left", "right"];
