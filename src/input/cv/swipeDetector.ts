import { THRESHOLDS } from "./gestureConfig";
import { type FilteredPose, HAND_SIDES, type HandSide } from "./gestureTypes";

interface SwipeMotion {
  direction: -1 | 1;
  originX: number;
  originY: number;
  peakX: number;
  shoulderX: number;
  shoulderY: number;
  lastStillMs: number;
  startedMs: number | null;
  samples: number;
}

/** One hand crosses the torso horizontally in the mirrored preview. */
export class SwipeDetector {
  leftCount = 0;
  rightCount = 0;
  lastDirection: -1 | 0 | 1 = 0;
  private blockedUntilMs = 0;
  private motions: Record<HandSide, SwipeMotion | null> = {
    left: null,
    right: null,
  };

  get inProgress(): boolean {
    return Object.values(this.motions).some(
      (motion) => motion !== null && motion.startedMs !== null,
    );
  }

  update(pose: FilteredPose, shoulderWidth: number, timestampMs: number): void {
    for (const side of HAND_SIDES) {
      const otherSide = side === "left" ? "right" : "left";
      const relativeY = (pose.wristY[side] - pose.shoulderY) / shoulderWidth;
      const otherHandDown =
        pose.wristY[otherSide] >
        pose.shoulderY + THRESHOLDS.swipeOtherHandDown * shoulderWidth;
      if (
        timestampMs < this.blockedUntilMs ||
        Math.abs(relativeY) > THRESHOLDS.swipeHeightRange ||
        !otherHandDown
      ) {
        this.motions[side] = null;
        continue;
      }
      // Camera x is unmirrored. Increasing preview x means decreasing camera x.
      const previewX = (pose.shoulderX - pose.wristX[side]) / shoulderWidth;
      this.updateHand(
        side,
        previewX,
        relativeY,
        pose,
        shoulderWidth,
        timestampMs,
      );
    }
  }

  private updateHand(
    side: HandSide,
    previewX: number,
    relativeY: number,
    pose: FilteredPose,
    shoulderWidth: number,
    timestampMs: number,
  ): void {
    let motion = this.motions[side];
    if (!motion) {
      if (Math.abs(previewX) < THRESHOLDS.swipeStartOffset) {
        return;
      }
      motion = {
        direction: previewX < 0 ? 1 : -1,
        originX: previewX,
        originY: relativeY,
        peakX: previewX,
        shoulderX: pose.shoulderX,
        shoulderY: pose.shoulderY,
        lastStillMs: timestampMs,
        startedMs: null,
        samples: 1,
      };
      this.motions[side] = motion;
      return;
    }
    const bodyDrift =
      Math.max(
        Math.abs(pose.shoulderX - motion.shoulderX),
        Math.abs(pose.shoulderY - motion.shoulderY),
      ) / shoulderWidth;
    const verticalDrift = Math.abs(relativeY - motion.originY);
    const backtrack = (motion.peakX - previewX) * motion.direction;
    const expired =
      motion.startedMs !== null &&
      timestampMs - motion.startedMs > THRESHOLDS.swipeWindowMs;
    if (
      bodyDrift > THRESHOLDS.swipeMaxBodyDrift ||
      verticalDrift > THRESHOLDS.swipeMaxVerticalDrift ||
      backtrack > THRESHOLDS.swipeMaxBacktrack ||
      expired
    ) {
      this.motions[side] = null;
      return;
    }
    const travel = (previewX - motion.originX) * motion.direction;
    if (travel < 0.05 && motion.startedMs === null) {
      motion.lastStillMs = timestampMs;
      return;
    }
    motion.startedMs ??= motion.lastStillMs;
    motion.samples++;
    if ((previewX - motion.peakX) * motion.direction > 0) {
      motion.peakX = previewX;
    }
    const crossedTorso =
      previewX * motion.direction >= THRESHOLDS.swipeStartOffset;
    if (
      crossedTorso &&
      travel >= THRESHOLDS.swipeDistance &&
      motion.samples >= 3 &&
      timestampMs - motion.startedMs >= THRESHOLDS.swipeMinDurationMs
    ) {
      if (motion.direction === 1) {
        this.rightCount++;
      } else {
        this.leftCount++;
      }
      this.lastDirection = motion.direction;
      this.blockedUntilMs = timestampMs + THRESHOLDS.swipeCooldownMs;
      this.motions.left = null;
      this.motions.right = null;
    }
  }

  /** Clear incomplete motion without replaying completed gestures. */
  reset(): void {
    this.motions.left = null;
    this.motions.right = null;
    this.lastDirection = 0;
  }
}
