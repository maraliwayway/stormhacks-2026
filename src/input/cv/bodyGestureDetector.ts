import { THRESHOLDS } from "./gestureConfig";
import type { Calibration, FilteredPose, GestureState } from "./gestureTypes";

type BodyState = Pick<GestureState, "jump" | "squat">;
type HeldGesture = "jump" | "squat";
interface HoldThresholds {
  enter: number;
  exit: number;
}

/** Converts calibrated vertical torso movement into jumping and squatting. */
export class BodyGestureDetector {
  private state: BodyState = {
    jump: false,
    squat: false,
  };
  private previousHipY: number | null = null;
  private lastExitMs: Record<HeldGesture, number> = {
    jump: -Infinity,
    squat: -Infinity,
  };

  update(
    pose: FilteredPose,
    calibration: Calibration,
    elapsedSeconds: number,
    timestampMs: number,
  ): void {
    const shoulderWidth = calibration.shoulderWidth;
    const rise = (calibration.hipY - pose.hipY) / shoulderWidth;
    const upSpeed =
      this.previousHipY === null
        ? 0
        : -(pose.hipY - this.previousHipY) / elapsedSeconds / shoulderWidth;

    this.updateHeld(
      "jump",
      rise,
      { enter: THRESHOLDS.jumpEnter, exit: THRESHOLDS.jumpExit },
      timestampMs,
      upSpeed >= THRESHOLDS.jumpMinUpSpeed,
    );
    this.updateHeld(
      "squat",
      -rise,
      { enter: THRESHOLDS.squatEnter, exit: THRESHOLDS.squatExit },
      timestampMs,
    );
    if (this.state.squat) {
      this.state.jump = false;
    }

    this.previousHipY = pose.hipY;
  }

  /** Hysteresis avoids toggling near a threshold; a released gesture has a short re-entry delay. */
  private updateHeld(
    name: HeldGesture,
    value: number,
    thresholds: HoldThresholds,
    timestampMs: number,
    canEnter = true,
  ): void {
    if (!this.state[name]) {
      this.state[name] =
        value > thresholds.enter &&
        canEnter &&
        timestampMs - this.lastExitMs[name] >= THRESHOLDS.refractoryMs;
    } else if (value < thresholds.exit) {
      this.lastExitMs[name] = timestampMs;
      this.state[name] = false;
    }
  }

  getState(): BodyState {
    return { ...this.state };
  }

  reset(): void {
    this.state = {
      jump: false,
      squat: false,
    };
    this.previousHipY = null;
  }
}
