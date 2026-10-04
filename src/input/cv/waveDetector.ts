import { THRESHOLDS } from "./gestureConfig";
import { type FilteredPose, HAND_SIDES, type HandSide } from "./gestureTypes";

interface WaveMotion {
  startedMs: number;
  minX: number;
  maxX: number;
  peakX: number;
  direction: number;
  initialY: number;
}

/** One raised hand travels sideways and back; lowering both hands permits the next wave. */
export class WaveDetector {
  count = 0;
  private latched = false;
  private motions: Record<HandSide, WaveMotion | null> = {
    left: null,
    right: null,
  };

  update(pose: FilteredPose, shoulderWidth: number, timestampMs: number): void {
    const raisedBoundary =
      pose.shoulderY - THRESHOLDS.waveRaiseMargin * shoulderWidth;
    const raised = {
      left: pose.wristY.left < raisedBoundary,
      right: pose.wristY.right < raisedBoundary,
    };
    if (!raised.left && !raised.right) {
      this.latched = false;
    }

    for (const side of HAND_SIDES) {
      const otherSide = side === "left" ? "right" : "left";
      // Two raised arms belong to flapping, not menu confirmation.
      if (this.latched || !raised[side] || raised[otherSide]) {
        this.motions[side] = null;
        continue;
      }
      const relativeX = (pose.wristX[side] - pose.shoulderX) / shoulderWidth;
      const relativeY = (pose.wristY[side] - pose.shoulderY) / shoulderWidth;
      this.updateHand(side, relativeX, relativeY, timestampMs);
    }
  }

  private updateHand(
    side: HandSide,
    relativeX: number,
    relativeY: number,
    timestampMs: number,
  ): void {
    let motion = this.motions[side];
    const expired =
      motion !== null &&
      motion.direction !== 0 &&
      timestampMs - motion.startedMs > THRESHOLDS.waveWindowMs;
    const drifted =
      motion !== null &&
      Math.abs(relativeY - motion.initialY) > THRESHOLDS.waveMaxDrift;
    if (!motion || expired || drifted) {
      motion = {
        startedMs: timestampMs,
        minX: relativeX,
        maxX: relativeX,
        peakX: relativeX,
        direction: 0,
        initialY: relativeY,
      };
      this.motions[side] = motion;
    }

    if (motion.direction === 0) {
      motion.minX = Math.min(motion.minX, relativeX);
      motion.maxX = Math.max(motion.maxX, relativeX);
      if (relativeX - motion.minX >= THRESHOLDS.waveDistance) {
        motion.direction = 1;
      } else if (motion.maxX - relativeX >= THRESHOLDS.waveDistance) {
        motion.direction = -1;
      }
      if (motion.direction !== 0) {
        motion.startedMs = timestampMs;
        motion.peakX = relativeX;
      }
      return;
    }

    if ((relativeX - motion.peakX) * motion.direction > 0) {
      motion.peakX = relativeX;
    }
    const returnDistance = (motion.peakX - relativeX) * motion.direction;
    if (returnDistance >= THRESHOLDS.waveDistance) {
      this.count++;
      this.latched = true;
      this.motions.left = null;
      this.motions.right = null;
    }
  }

  /** Preserve confirmations already consumed by the menu. */
  reset(): void {
    this.motions.left = null;
    this.motions.right = null;
    this.latched = false;
  }
}
