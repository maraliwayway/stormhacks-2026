import { THRESHOLDS } from "./gestureConfig";
import {
  type FilteredPose,
  type GestureState,
  HAND_SIDES,
  type HandSide,
} from "./gestureTypes";

interface WristStroke {
  raised: boolean;
  lastRaisedMs: number;
  downstrokeMs: number;
  previousY: number | null;
}

function createWristStroke(): WristStroke {
  return {
    raised: false,
    lastRaisedMs: 0,
    downstrokeMs: -Infinity,
    previousY: null,
  };
}

type FlapState = Pick<
  GestureState,
  "flapping" | "flapVelocity" | "flapCount" | "flapRate"
>;

/** Pairs brisk downstrokes from both wrists into one completed flap. */
export class FlapDetector {
  private wrists: Record<HandSide, WristStroke> = {
    left: createWristStroke(),
    right: createWristStroke(),
  };
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
    let totalSpeed = 0;
    for (const side of HAND_SIDES) {
      const wrist = this.wrists[side];
      const wristY = pose.wristY[side];
      const downSpeed =
        wrist.previousY === null
          ? 0
          : (wristY - wrist.previousY) / elapsedSeconds / shoulderWidth;
      const raisedBoundary =
        pose.shoulderY - THRESHOLDS.flapZoneMargin * shoulderWidth;
      const downstrokeBoundary =
        pose.shoulderY + THRESHOLDS.flapDownMargin * shoulderWidth;

      if (wristY < raisedBoundary) {
        wrist.raised = true;
        wrist.lastRaisedMs = timestampMs;
      } else if (wrist.raised && wristY > downstrokeBoundary) {
        const withinWindow =
          timestampMs - wrist.lastRaisedMs <= THRESHOLDS.flapWindowMs;
        if (withinWindow && downSpeed >= THRESHOLDS.flapMinDownSpeed) {
          wrist.downstrokeMs = timestampMs;
        }
        wrist.raised = false;
      }

      if (wrist.previousY !== null) {
        totalSpeed +=
          Math.abs(wristY - wrist.previousY) / elapsedSeconds / shoulderWidth;
      }
      wrist.previousY = wristY;
    }
    this.speed += 0.3 * (totalSpeed / 2 - this.speed);

    const bothDownstrokesRecent = HAND_SIDES.every(
      (side) =>
        timestampMs - this.wrists[side].downstrokeMs <= THRESHOLDS.flapPairMs,
    );
    const readyForNextFlap =
      timestampMs - this.lastFlapMs >= THRESHOLDS.flapRefractoryMs;
    if (bothDownstrokesRecent && readyForNextFlap) {
      this.count++;
      this.lastFlapMs = timestampMs;
      this.recentFlapsMs.push(timestampMs);
      for (const wrist of Object.values(this.wrists)) {
        wrist.downstrokeMs = -Infinity;
      }
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
      flapRate: this.recentFlapsMs.length / (THRESHOLDS.rateWindowMs / 1000),
    };
  }

  /** Discard unfinished strokes while preserving the session count and rate history. */
  reset(): void {
    for (const wrist of Object.values(this.wrists)) {
      wrist.raised = false;
      wrist.downstrokeMs = -Infinity;
      wrist.previousY = null;
    }
    this.speed = 0;
  }
}
