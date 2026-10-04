import { BodyGestureDetector } from "./bodyGestureDetector";
import { FlapDetector } from "./flapDetector";
import { DEFAULT_CALIBRATION } from "./gestureConfig";
import type {
  Calibration,
  FilteredPose,
  GestureState,
  Point,
} from "./gestureTypes";
import { L } from "./landmarks";
import { OneEuroFilter } from "./oneEuro";
import { WaveDetector } from "./waveDetector";

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
    hipX: createBodyFilter(),
    hipY: createBodyFilter(),
    shoulderX: createBodyFilter(),
    leftWristX: createWristFilter(),
    rightWristX: createWristFilter(),
  };
  const flaps = new FlapDetector();
  const waves = new WaveDetector();
  const body = new BodyGestureDetector();
  let previousTimestampMs = 0;

  function reset(): void {
    for (const filter of Object.values(filters)) {
      filter.reset();
    }
    flaps.reset();
    waves.reset();
    body.reset();
  }

  function readPose(
    landmarks: ArrayLike<Point>,
    timestampMs: number,
  ): FilteredPose {
    return {
      shoulderY: filters.shoulderY.filter(
        (landmarks[L.SHOULDER_L].y + landmarks[L.SHOULDER_R].y) / 2,
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
      wristY: {
        left: filters.leftWristY.filter(landmarks[L.WRIST_L].y, timestampMs),
        right: filters.rightWristY.filter(landmarks[L.WRIST_R].y, timestampMs),
      },
      shoulderX: filters.shoulderX.filter(
        (landmarks[L.SHOULDER_L].x + landmarks[L.SHOULDER_R].x) / 2,
        timestampMs,
      ),
      wristX: {
        left: filters.leftWristX.filter(landmarks[L.WRIST_L].x, timestampMs),
        right: filters.rightWristX.filter(landmarks[L.WRIST_R].x, timestampMs),
      },
    };
  }

  function snapshot(tracking: boolean, timestampMs: number): GestureState {
    return {
      tracking,
      ...flaps.getState(tracking, timestampMs),
      waveCount: waves.count,
      ...body.getState(),
    };
  }

  function update(
    landmarks: ArrayLike<Point> | null,
    timestampMs: number,
    calibration: Calibration = DEFAULT_CALIBRATION,
  ): GestureState {
    if (!landmarks || landmarks.length < 25) {
      reset();
      return snapshot(false, timestampMs);
    }
    const elapsedSeconds = Math.max(
      (timestampMs - previousTimestampMs) / 1000,
      1e-3,
    );
    const pose = readPose(landmarks, timestampMs);
    flaps.update(pose, calibration.shoulderWidth, elapsedSeconds, timestampMs);
    waves.update(pose, calibration.shoulderWidth, timestampMs);
    body.update(pose, calibration, elapsedSeconds, timestampMs);
    previousTimestampMs = timestampMs;
    return snapshot(true, timestampMs);
  }

  return { update, reset };
}
