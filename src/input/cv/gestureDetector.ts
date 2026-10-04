import { BodyGestureDetector } from "./bodyGestureDetector";
import { FlapDetector } from "./flapDetector";
import { DEFAULT_CALIBRATION, THRESHOLDS } from "./gestureConfig";
import {
  type Calibration,
  type FilteredPose,
  type GestureState,
  HAND_SIDES,
  type HandSide,
  type Point,
} from "./gestureTypes";
import { L, isVisiblePoint } from "./landmarks";
import { OneEuroFilter } from "./oneEuro";
import { PrayerDetector } from "./prayerDetector";
import { SwipeDetector } from "./swipeDetector";

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

const createWristFilter = () => new OneEuroFilter(12, 16);
const createBodyFilter = () => new OneEuroFilter(10, 12);
const HAND_LANDMARKS = {
  left: { wrist: L.WRIST_L, index: L.INDEX_L, pinky: L.PINKY_L },
  right: { wrist: L.WRIST_R, index: L.INDEX_R, pinky: L.PINKY_R },
} as const;

/** Keep torso tracking independent of wrist occlusion and lower-body framing. */
export function createGestureDetector(): GestureDetector {
  const bodyFilters = {
    shoulderX: createBodyFilter(),
    shoulderY: createBodyFilter(),
    shoulderLeftY: createBodyFilter(),
    shoulderRightY: createBodyFilter(),
    hipX: createBodyFilter(),
    hipY: createBodyFilter(),
  };
  const wristFilters = {
    left: { x: createWristFilter(), y: createWristFilter() },
    right: { x: createWristFilter(), y: createWristFilter() },
  };
  const flaps = new FlapDetector();
  const swipes = new SwipeDetector();
  const prayer = new PrayerDetector();
  const body = new BodyGestureDetector();
  let previousTimestampMs: number | null = null;
  let tracking = false;

  function reset(): void {
    for (const filter of Object.values(bodyFilters)) {
      filter.reset();
    }
    for (const filters of Object.values(wristFilters)) {
      filters.x.reset();
      filters.y.reset();
    }
    flaps.reset();
    swipes.reset();
    prayer.reset();
    body.reset();
    previousTimestampMs = null;
    tracking = false;
  }

  function readPose(
    landmarks: ArrayLike<Point>,
    timestampMs: number,
    calibration: Calibration,
  ): FilteredPose {
    const rawShoulderX =
      (landmarks[L.SHOULDER_L].x + landmarks[L.SHOULDER_R].x) / 2;
    const rawShoulderY =
      (landmarks[L.SHOULDER_L].y + landmarks[L.SHOULDER_R].y) / 2;
    const hipsVisible = [L.HIP_L, L.HIP_R].every((index) =>
      isVisiblePoint(landmarks[index], THRESHOLDS.minHipConfidence),
    );
    if (!hipsVisible) {
      bodyFilters.hipX.reset();
      bodyFilters.hipY.reset();
    }
    const pose: FilteredPose = {
      shoulderX: bodyFilters.shoulderX.filter(rawShoulderX, timestampMs),
      shoulderY: bodyFilters.shoulderY.filter(rawShoulderY, timestampMs),
      shoulderLeftY: bodyFilters.shoulderLeftY.filter(
        landmarks[L.SHOULDER_L].y,
        timestampMs,
      ),
      shoulderRightY: bodyFilters.shoulderRightY.filter(
        landmarks[L.SHOULDER_R].y,
        timestampMs,
      ),
      hipX: hipsVisible
        ? bodyFilters.hipX.filter(
            (landmarks[L.HIP_L].x + landmarks[L.HIP_R].x) / 2,
            timestampMs,
          )
        : calibration.hipX,
      hipY: hipsVisible
        ? bodyFilters.hipY.filter(
            (landmarks[L.HIP_L].y + landmarks[L.HIP_R].y) / 2,
            timestampMs,
          )
        : calibration.hipY,
      wristX: { left: rawShoulderX, right: rawShoulderX },
      wristY: { left: rawShoulderY, right: rawShoulderY },
      wristTracked: { left: false, right: false },
      handX: { left: rawShoulderX, right: rawShoulderX },
      handY: { left: rawShoulderY, right: rawShoulderY },
      handTracked: { left: false, right: false },
    };
    for (const side of HAND_SIDES) {
      const wrist = landmarks[HAND_LANDMARKS[side].wrist];
      pose.wristTracked[side] = isVisiblePoint(
        wrist,
        THRESHOLDS.minHandConfidence,
      );
      if (pose.wristTracked[side]) {
        pose.wristX[side] =
          pose.shoulderX +
          wristFilters[side].x.filter(wrist.x - rawShoulderX, timestampMs);
        pose.wristY[side] =
          pose.shoulderY +
          wristFilters[side].y.filter(wrist.y - rawShoulderY, timestampMs);
      } else {
        wristFilters[side].x.reset();
        wristFilters[side].y.reset();
      }
      const hand = readHand(landmarks, side, calibration.shoulderWidth);
      if (hand) {
        pose.handX[side] = hand.x;
        pose.handY[side] = hand.y;
        pose.handTracked[side] = true;
      }
    }
    return pose;
  }

  function snapshot(timestampMs: number): GestureState {
    return {
      tracking,
      ...flaps.getState(tracking, timestampMs),
      prayerCount: prayer.count,
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
      landmarks.length < 13 ||
      !Number.isFinite(calibration.shoulderWidth) ||
      calibration.shoulderWidth < 0.05 ||
      ![L.SHOULDER_L, L.SHOULDER_R].every((index) =>
        isVisiblePoint(landmarks[index], THRESHOLDS.minLandmarkConfidence),
      )
    ) {
      reset();
      return snapshot(timestampMs);
    }
    if (previousTimestampMs !== null && timestampMs <= previousTimestampMs) {
      return snapshot(previousTimestampMs);
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
    const pose = readPose(landmarks, timestampMs, calibration);
    flaps.update(pose, calibration.shoulderWidth, elapsedSeconds, timestampMs);
    if (pose.wristTracked.left && pose.wristTracked.right) {
      swipes.update(pose, calibration.shoulderWidth, timestampMs);
    } else {
      swipes.reset();
    }
    prayer.update(pose, calibration.shoulderWidth, timestampMs);
    body.update(pose, calibration, elapsedSeconds, timestampMs);
    previousTimestampMs = timestampMs;
    tracking = true;
    return snapshot(timestampMs);
  }
  return { update, reset };
}

/** Finger landmarks help when palms touch and a wrist is partly obscured. */
function readHand(
  landmarks: ArrayLike<Point>,
  side: HandSide,
  shoulderWidth: number,
): Point | null {
  const indices = HAND_LANDMARKS[side];
  const wrist = landmarks[indices.wrist];
  const wristVisible = isVisiblePoint(wrist, THRESHOLDS.minHandConfidence);
  const tips = [landmarks[indices.index], landmarks[indices.pinky]].filter(
    (point) =>
      isVisiblePoint(point, THRESHOLDS.minHandConfidence) &&
      (!wristVisible ||
        Math.hypot(point.x - wrist.x, point.y - wrist.y) <=
          shoulderWidth * 0.5),
  );
  if (!wristVisible && tips.length < 2) {
    return null;
  }
  const points = wristVisible ? [wrist, ...tips] : tips;
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}
