import { THRESHOLDS } from "./gestureConfig";
import {
  type FilteredPose,
  type GestureState,
  HAND_SIDES,
  type HandSide,
} from "./gestureTypes";

interface WristStroke {
  lowY: number;
  peakY: number;
  peakMs: number;
  raised: boolean;
  downstrokeMs: number;
  previousY: number | null;
}
function createWristStroke(): WristStroke {
  return {
    lowY: -Infinity,
    peakY: Infinity,
    peakMs: 0,
    raised: false,
    downstrokeMs: -Infinity,
    previousY: null,
  };
}
type FlapState = Pick<
  GestureState,
  "flapping" | "flapVelocity" | "flapCount" | "flapRate"
>;

/** Small upward travel prepares a paired downstroke at any arm height. */
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
    if (!pose.wristTracked.left || !pose.wristTracked.right) {
      this.reset();
      return;
    }
    let totalSpeed = 0;
    for (const side of HAND_SIDES) {
      const wrist = this.wrists[side];
      const currentY = (pose.wristY[side] - pose.shoulderY) / shoulderWidth;
      if (wrist.previousY !== null) {
        totalSpeed += Math.abs(currentY - wrist.previousY) / elapsedSeconds;
      }
      if (!this.armed) {
        wrist.lowY = Math.max(wrist.lowY, currentY);
        if (
          !wrist.raised &&
          (wrist.lowY - currentY >= THRESHOLDS.flapMinTravel ||
            (wrist.previousY === null && currentY < -THRESHOLDS.flapZoneMargin))
        ) {
          wrist.raised = true;
          wrist.peakY = currentY;
          wrist.peakMs = timestampMs;
        }
        if (wrist.raised) {
          this.followPeak(wrist, currentY, timestampMs);
          if (
            currentY - wrist.peakY >= THRESHOLDS.flapMinTravel ||
            timestampMs - wrist.peakMs > THRESHOLDS.flapWindowMs
          ) {
            // A lone arm completed its stroke before the other arm rose.
            wrist.raised = false;
            wrist.lowY = currentY;
          }
        }
      } else {
        this.followPeak(wrist, currentY, timestampMs);
        const strokeSeconds = Math.max(
          (timestampMs - wrist.peakMs) / 1000,
          0.001,
        );
        const travel = currentY - wrist.peakY;
        if (
          wrist.downstrokeMs === -Infinity &&
          travel >= THRESHOLDS.flapMinTravel &&
          travel / strokeSeconds >= THRESHOLDS.flapMinDownSpeed
        ) {
          wrist.downstrokeMs = timestampMs;
        }
      }
      wrist.previousY = currentY;
    }
    if (!this.armed && HAND_SIDES.every((side) => this.wrists[side].raised)) {
      this.armed = true;
    }
    const speedBlend = 1 - Math.exp(-elapsedSeconds / 0.05);
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
      this.clearCycle();
    } else if (
      this.armed &&
      HAND_SIDES.some(
        (side) =>
          timestampMs - this.wrists[side].peakMs > THRESHOLDS.flapWindowMs,
      )
    ) {
      this.clearCycle();
    }
    this.recentFlapsMs = this.recentFlapsMs.filter(
      (flapMs) => timestampMs - flapMs <= THRESHOLDS.rateWindowMs,
    );
  }

  private followPeak(
    wrist: WristStroke,
    currentY: number,
    timestampMs: number,
  ): void {
    wrist.peakY = Math.min(wrist.peakY, currentY);
    if (currentY - wrist.peakY <= THRESHOLDS.flapPeakTolerance) {
      wrist.peakMs = timestampMs;
    }
  }

  private clearCycle(): void {
    this.armed = false;
    for (const wrist of Object.values(this.wrists)) {
      wrist.lowY = wrist.previousY ?? -Infinity;
      wrist.peakY = Infinity;
      wrist.raised = false;
      wrist.downstrokeMs = -Infinity;
    }
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
