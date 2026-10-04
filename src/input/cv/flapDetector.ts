import { THRESHOLDS } from "./gestureConfig";
import {
  type FilteredPose,
  type GestureState,
  HAND_SIDES,
  type HandSide,
} from "./gestureTypes";

interface WristStroke {
  peakY: number;
  lastRaisedY: number;
  lastRaisedMs: number;
  downstrokeMs: number;
  previousY: number | null;
}
function createWristStroke(): WristStroke {
  return {
    peakY: Infinity,
    lastRaisedY: 0,
    lastRaisedMs: 0,
    downstrokeMs: -Infinity,
    previousY: null,
  };
}
type FlapState = Pick<
  GestureState,
  "flapping" | "flapVelocity" | "flapCount" | "flapRate"
>;

/** Both arms arm one cycle together; a downstroke is measured relative to the shoulders. */
export class FlapDetector {
  private wrists: Record<HandSide, WristStroke> = {
    left: createWristStroke(),
    right: createWristStroke(),
  };
  private armed = false;
  private count = 0;
  private lastFlapMs = -Infinity;
  private recentFlapsMs: number[] = [];
  private speed = 0;

  update(
    pose: FilteredPose,
    shoulderWidth: number,
    elapsedSeconds: number,
    timestampMs: number,
  ): void {
    const relativeY = {
      left: (pose.wristY.left - pose.shoulderY) / shoulderWidth,
      right: (pose.wristY.right - pose.shoulderY) / shoulderWidth,
    };
    const bothRaised = HAND_SIDES.every(
      (side) => relativeY[side] < -THRESHOLDS.flapZoneMargin,
    );
    if (!this.armed && bothRaised) {
      this.armed = true;
      for (const side of HAND_SIDES) {
        this.wrists[side].peakY = relativeY[side];
        this.wrists[side].downstrokeMs = -Infinity;
      }
    }
    let totalSpeed = 0;
    for (const side of HAND_SIDES) {
      const wrist = this.wrists[side];
      const currentY = relativeY[side];
      if (wrist.previousY !== null) {
        totalSpeed += Math.abs(currentY - wrist.previousY) / elapsedSeconds;
      }
      wrist.previousY = currentY;
      if (!this.armed) {
        continue;
      }
      wrist.peakY = Math.min(wrist.peakY, currentY);
      if (currentY < -THRESHOLDS.flapZoneMargin) {
        wrist.lastRaisedY = currentY;
        wrist.lastRaisedMs = timestampMs;
      } else if (
        currentY > THRESHOLDS.flapDownMargin &&
        wrist.downstrokeMs === -Infinity
      ) {
        const strokeSeconds = Math.max(
          (timestampMs - wrist.lastRaisedMs) / 1000,
          0.001,
        );
        const downSpeed = (currentY - wrist.lastRaisedY) / strokeSeconds;
        if (
          timestampMs - wrist.lastRaisedMs <= THRESHOLDS.flapWindowMs &&
          currentY - wrist.peakY >= THRESHOLDS.flapMinTravel &&
          downSpeed >= THRESHOLDS.flapMinDownSpeed
        ) {
          wrist.downstrokeMs = timestampMs;
        }
      }
    }
    const speedBlend = 1 - Math.exp(-elapsedSeconds / 0.09);
    this.speed += speedBlend * (totalSpeed / 2 - this.speed);
    const paired = HAND_SIDES.every(
      (side) =>
        timestampMs - this.wrists[side].downstrokeMs <= THRESHOLDS.flapPairMs,
    );
    if (
      this.armed &&
      paired &&
      timestampMs - this.lastFlapMs >= THRESHOLDS.flapRefractoryMs
    ) {
      this.count++;
      this.lastFlapMs = timestampMs;
      this.recentFlapsMs.push(timestampMs);
      this.armed = false;
    } else if (
      this.armed &&
      HAND_SIDES.some(
        (side) =>
          timestampMs - this.wrists[side].lastRaisedMs >
          THRESHOLDS.flapWindowMs,
      )
    ) {
      this.armed = false;
    }
    this.recentFlapsMs = this.recentFlapsMs.filter(
      (flapMs) => timestampMs - flapMs <= THRESHOLDS.rateWindowMs,
    );
  }

  getState(tracking: boolean, timestampMs: number): FlapState {
    const flapping =
      tracking && timestampMs - this.lastFlapMs <= THRESHOLDS.flapActiveMs;
    return {
      flapping,
      flapVelocity: flapping ? this.speed : 0,
      flapCount: this.count,
      flapRate:
        this.recentFlapsMs.filter(
          (flapMs) => timestampMs - flapMs <= THRESHOLDS.rateWindowMs,
        ).length /
        (THRESHOLDS.rateWindowMs / 1000),
    };
  }

  reset(): void {
    this.armed = false;
    this.wrists = { left: createWristStroke(), right: createWristStroke() };
    this.lastFlapMs = -Infinity;
    this.speed = 0;
  }
}
