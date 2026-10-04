import type { GestureState, Point } from "./gestureTypes";
import { L, isVisiblePoint } from "./landmarks";
import { OneEuroFilter } from "./oneEuro";

/** Horizontal positions in the mirrored camera preview, independent of calibration. */
export const HEAD_STEERING = {
  leftEnter: 0.35,
  leftExit: 0.42,
  rightExit: 0.58,
  rightEnter: 0.65,
  minConfidence: 0.25,
  minimumCutoff: 12,
  filterBeta: 16,
} as const;

type HeadState = Pick<
  GestureState,
  | "strafe"
  | "strafeLeft"
  | "strafeRight"
  | "headPosition"
  | "turnLeftCount"
  | "turnRightCount"
  | "lastTurnDirection"
>;

/** One lane per entry into a side zone; returning to the centre only rearms it. */
export class HeadSteering {
  private filter = new OneEuroFilter(
    HEAD_STEERING.minimumCutoff,
    HEAD_STEERING.filterBeta,
  );
  private activeZone: -1 | 0 | 1 = 0;
  private state: HeadState = {
    strafe: 0,
    strafeLeft: false,
    strafeRight: false,
    headPosition: null,
    turnLeftCount: 0,
    turnRightCount: 0,
    lastTurnDirection: 0,
  };

  update(landmarks: ArrayLike<Point>, timestampMs: number): void {
    const cameraX = readHeadX(landmarks);
    if (cameraX === null) {
      this.reset();
      return;
    }
    const previewX = this.filter.filter(1 - cameraX, timestampMs);
    let direction: -1 | 0 | 1 = 0;
    if (
      previewX <= HEAD_STEERING.leftEnter ||
      (this.activeZone === -1 && previewX < HEAD_STEERING.leftExit)
    ) {
      direction = -1;
    } else if (
      previewX >= HEAD_STEERING.rightEnter ||
      (this.activeZone === 1 && previewX > HEAD_STEERING.rightExit)
    ) {
      direction = 1;
    }
    if (direction !== 0 && direction !== this.activeZone) {
      if (direction === -1) {
        this.state.turnLeftCount++;
      } else {
        this.state.turnRightCount++;
      }
      this.state.lastTurnDirection = direction;
    }
    this.activeZone = direction;
    this.state.strafe = direction;
    this.state.strafeLeft = direction === -1;
    this.state.strafeRight = direction === 1;
    this.state.headPosition = previewX;
  }

  getState(): HeadState {
    return { ...this.state };
  }

  /** Occlusion must not rearm a held turn or replay it when the face returns. */
  reset(): void {
    this.filter.reset();
    this.state.strafe = 0;
    this.state.strafeLeft = false;
    this.state.strafeRight = false;
    this.state.headPosition = null;
  }
}

/** Paired eyes/ears provide a centre when the nose is briefly obscured. */
function readHeadX(landmarks: ArrayLike<Point>): number | null {
  const centres: number[] = [];
  const nose = landmarks[L.NOSE];
  if (isVisiblePoint(nose, HEAD_STEERING.minConfidence)) {
    centres.push(nose.x);
  }
  for (const [left, right] of [
    [L.EYE_L, L.EYE_R],
    [L.EAR_L, L.EAR_R],
  ]) {
    const leftPoint = landmarks[left];
    const rightPoint = landmarks[right];
    if (
      isVisiblePoint(leftPoint, HEAD_STEERING.minConfidence) &&
      isVisiblePoint(rightPoint, HEAD_STEERING.minConfidence)
    ) {
      centres.push((leftPoint.x + rightPoint.x) / 2);
    }
  }
  if (centres.length === 0) {
    return null;
  }
  centres.sort((a, b) => a - b);
  const middle = Math.floor(centres.length / 2);
  return centres.length % 2 === 1
    ? centres[middle]
    : (centres[middle - 1] + centres[middle]) / 2;
}
