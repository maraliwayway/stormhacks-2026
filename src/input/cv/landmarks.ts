import type { Point } from "./gestureTypes";

export const L = {
  NOSE: 0,
  EYE_L: 2,
  EYE_R: 5,
  EAR_L: 7,
  EAR_R: 8,
  SHOULDER_L: 11,
  SHOULDER_R: 12,
  ELBOW_L: 13,
  ELBOW_R: 14,
  WRIST_L: 15,
  WRIST_R: 16,
  PINKY_L: 17,
  PINKY_R: 18,
  INDEX_L: 19,
  INDEX_R: 20,
  HIP_L: 23,
  HIP_R: 24,
  KNEE_L: 25,
  KNEE_R: 26,
  ANKLE_L: 27,
  ANKLE_R: 28,
} as const;

/** Validate each body part independently; an obscured hand must not disable steering. */
export function isVisiblePoint(
  point: Point | undefined,
  confidence: number,
): point is Point {
  return Boolean(
    point &&
      Number.isFinite(point.x) &&
      Number.isFinite(point.y) &&
      point.x >= 0 &&
      point.x <= 1 &&
      point.y >= 0 &&
      point.y <= 1 &&
      (point.visibility ?? 1) >= confidence &&
      (point.presence ?? 1) >= confidence,
  );
}
