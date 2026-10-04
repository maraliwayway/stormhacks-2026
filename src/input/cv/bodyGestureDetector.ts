import { THRESHOLDS } from "./gestureConfig";
import type { Calibration, FilteredPose, GestureState } from "./gestureTypes";

type BodyState = Pick<
  GestureState,
  "strafe" | "strafeLeft" | "strafeRight" | "jump" | "squat"
>;
type HeldGesture = "strafeLeft" | "strafeRight" | "jump" | "squat";
interface HoldThresholds {
  enter: number;
  exit: number;
}

/** Converts calibrated torso movement into steering, jumping, and squatting. */
export class BodyGestureDetector {
  private state: BodyState = {
    strafe: 0,
    strafeLeft: false,
    strafeRight: false,
    jump: false,
    squat: false,
  };
  private previousHipY: number | null = null;
  private lastExitMs: Record<HeldGesture, number> = {
    strafeLeft: -Infinity,
    strafeRight: -Infinity,
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
    const hipOffset = (pose.hipX - calibration.hipX) / shoulderWidth;
    const neutralTilt =
      (calibration.shoulderX ?? calibration.hipX) - calibration.hipX;
    const torsoTilt =
      (pose.shoulderX - pose.hipX - neutralTilt) / shoulderWidth;
    const shoulderRoll =
      (pose.shoulderRightY - pose.shoulderLeftY) / shoulderWidth -
      (calibration.shoulderRoll ?? 0);
    const torsoOffset =
      Math.abs(torsoTilt) >= Math.abs(shoulderRoll) ? torsoTilt : -shoulderRoll;
    const steeringOffset =
      Math.abs(hipOffset) >= Math.abs(torsoOffset) ? hipOffset : torsoOffset;
    const rise = (calibration.hipY - pose.hipY) / shoulderWidth;
    const upSpeed =
      this.previousHipY === null
        ? 0
        : -(pose.hipY - this.previousHipY) / elapsedSeconds / shoulderWidth;

    const strafeThresholds = {
      enter: THRESHOLDS.strafeEnter,
      exit: THRESHOLDS.strafeExit,
    };
    this.updateHeld("strafeLeft", hipOffset, strafeThresholds, timestampMs);
    this.updateHeld("strafeRight", -hipOffset, strafeThresholds, timestampMs);
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

    const magnitude = Math.min(
      1,
      Math.max(
        0,
        (Math.abs(steeringOffset) - THRESHOLDS.strafeDeadzone) /
          (THRESHOLDS.strafeFull - THRESHOLDS.strafeDeadzone),
      ),
    );
    // Camera x is unmirrored: a larger image x means the player's left.
    this.state.strafe = steeringOffset > 0 ? -magnitude : magnitude;
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
      strafe: 0,
      strafeLeft: false,
      strafeRight: false,
      jump: false,
      squat: false,
    };
    this.previousHipY = null;
  }
}
