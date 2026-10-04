import { BodyGestureDetector } from "./bodyGestureDetector";
import { FlapDetector } from "./flapDetector";
import { DEFAULT_CALIBRATION, THRESHOLDS } from "./gestureConfig";
import type {
  Calibration,
  FilteredPose,
  GestureState,
  Point,
} from "./gestureTypes";
import { L } from "./landmarks";
import { OneEuroFilter } from "./oneEuro";
import { SwipeDetector } from "./swipeDetector";

// Keep the shared camera integration API in this module.
export { DEFAULT_CALIBRATION, THRESHOLDS } from "./gestureConfig";
export type { Calibration, GestureState, Point } from "./gestureTypes";

export interface GestureDetector {
  update(
    landmarks: ArrayLike<Point> | null,
    timestampMs: number,
    calibration?: Calibration,
  ): GestureState;
  reset(): void;
}

// Image-coordinate speeds are small (~0.1–2 /s), so beta must be large to follow quick movement.
const createWristFilter = () => new OneEuroFilter(6, 12);
const createBodyFilter = () => new OneEuroFilter(4, 8);

/** Smooth one camera frame, then update the independent gesture recognizers. */
export function createGestureDetector(): GestureDetector {
  const filters = {
    leftWristY: createWristFilter(),
    rightWristY: createWristFilter(),
    shoulderY: createBodyFilter(),
    shoulderLeftY: createBodyFilter(),
    shoulderRightY: createBodyFilter(),
    hipX: createBodyFilter(),
    hipY: createBodyFilter(),
    shoulderX: createBodyFilter(),
    leftWristX: createWristFilter(),
    rightWristX: createWristFilter(),
  };
  const flaps = new FlapDetector();
  const swipes = new SwipeDetector();
  const body = new BodyGestureDetector();
  let previousTimestampMs: number | null = null;
  let lastObservedMs = -Infinity;
  let tracking = false;

  function reset(): void {
    for (const filter of Object.values(filters)) {
      filter.reset();
    }
    flaps.reset();
    swipes.reset();
    body.reset();
    previousTimestampMs = null;
    lastObservedMs = -Infinity;
    tracking = false;
  }

  function readPose(
    landmarks: ArrayLike<Point>,
    timestampMs: number,
  ): FilteredPose {
    const rawShoulderX =
      (landmarks[L.SHOULDER_L].x + landmarks[L.SHOULDER_R].x) / 2;
    const rawShoulderY =
      (landmarks[L.SHOULDER_L].y + landmarks[L.SHOULDER_R].y) / 2;
    const shoulderX = filters.shoulderX.filter(rawShoulderX, timestampMs);
    const shoulderY = filters.shoulderY.filter(rawShoulderY, timestampMs);
    return {
      shoulderX,
      shoulderY,
      shoulderLeftY: filters.shoulderLeftY.filter(
        landmarks[L.SHOULDER_L].y,
        timestampMs,
      ),
      shoulderRightY: filters.shoulderRightY.filter(
        landmarks[L.SHOULDER_R].y,
        timestampMs,
      ),
      hipX: filters.hipX.filter(
        (landmarks[L.HIP_L].x + landmarks[L.HIP_R].x) / 2,
        timestampMs,
      ),
      hipY: filters.hipY.filter(
        (landmarks[L.HIP_L].y + landmarks[L.HIP_R].y) / 2,
        timestampMs,
      ),
      // Filter arm movement relative to the torso so stepping/bobbing cannot become an arm gesture.
      wristY: {
        left:
          shoulderY +
          filters.leftWristY.filter(
            landmarks[L.WRIST_L].y - rawShoulderY,
            timestampMs,
          ),
        right:
          shoulderY +
          filters.rightWristY.filter(
            landmarks[L.WRIST_R].y - rawShoulderY,
            timestampMs,
          ),
      },
      wristX: {
        left:
          shoulderX +
          filters.leftWristX.filter(
            landmarks[L.WRIST_L].x - rawShoulderX,
            timestampMs,
          ),
        right:
          shoulderX +
          filters.rightWristX.filter(
            landmarks[L.WRIST_R].x - rawShoulderX,
            timestampMs,
          ),
      },
    };
  }

  function snapshot(tracking: boolean, timestampMs: number): GestureState {
    return {
      tracking,
      ...flaps.getState(tracking, timestampMs),
      swipeLeftCount: swipes.leftCount,
      swipeRightCount: swipes.rightCount,
      lastSwipeDirection: swipes.lastDirection,
      swipeInProgress: swipes.inProgress,
      ...body.getState(),
    };
  }

  function update(
    landmarks: ArrayLike<Point> | null,
    timestampMs: number,
    calibration: Calibration = DEFAULT_CALIBRATION,
  ): GestureState {
    if (
      !Number.isFinite(timestampMs) ||
      !landmarks ||
      landmarks.length < 25 ||
      !isReliablePose(landmarks, calibration)
    ) {
      reset();
      return snapshot(false, timestampMs);
    }
    if (timestampMs <= lastObservedMs) {
      return snapshot(tracking, lastObservedMs);
    }
    if (
      previousTimestampMs !== null &&
      timestampMs - previousTimestampMs > THRESHOLDS.maxGestureGapMs
    ) {
      reset();
    }
    const elapsedSeconds =
      previousTimestampMs === null
        ? 1 / 30
        : Math.max((timestampMs - previousTimestampMs) / 1000, 1e-3);
    const pose = readPose(landmarks, timestampMs);
    flaps.update(pose, calibration.shoulderWidth, elapsedSeconds, timestampMs);
    swipes.update(pose, calibration.shoulderWidth, timestampMs);
    body.update(pose, calibration, elapsedSeconds, timestampMs);
    previousTimestampMs = timestampMs;
    lastObservedMs = timestampMs;
    tracking = true;
    return snapshot(true, timestampMs);
  }

  return { update, reset };
}

function isReliablePose(
  landmarks: ArrayLike<Point>,
  calibration: Calibration,
): boolean {
  if (
    !Number.isFinite(calibration.shoulderWidth) ||
    calibration.shoulderWidth < 0.05
  ) {
    return false;
  }
  return [
    L.SHOULDER_L,
    L.SHOULDER_R,
    L.HIP_L,
    L.HIP_R,
    L.WRIST_L,
    L.WRIST_R,
  ].every((index) => {
    const point = landmarks[index];
    return (
      point &&
      Number.isFinite(point.x) &&
      Number.isFinite(point.y) &&
      point.x >= 0 &&
      point.x <= 1 &&
      point.y >= 0 &&
      point.y <= 1 &&
      (point.visibility ?? 1) >= THRESHOLDS.minLandmarkConfidence &&
      (point.presence ?? 1) >= THRESHOLDS.minLandmarkConfidence
    );
  });
}
