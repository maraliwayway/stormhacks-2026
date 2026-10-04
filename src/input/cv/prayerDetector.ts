import { THRESHOLDS } from "./gestureConfig";
import type { FilteredPose } from "./gestureTypes";

/** Hands together select once. Hands must separate before another selection. */
export class PrayerDetector {
  count = 0;
  private held = false;
  private closeStartedMs: number | null = null;
  private openStartedMs: number | null = null;

  update(pose: FilteredPose, shoulderWidth: number, timestampMs: number): void {
    if (!pose.handTracked.left || !pose.handTracked.right) {
      this.closeStartedMs = null;
      this.openStartedMs = null;
      return;
    }
    const distance =
      Math.hypot(
        pose.handX.left - pose.handX.right,
        pose.handY.left - pose.handY.right,
      ) / shoulderWidth;
    if (distance >= THRESHOLDS.prayerOpenDistance) {
      this.openStartedMs ??= timestampMs;
      if (timestampMs - this.openStartedMs >= THRESHOLDS.prayerHoldMs) {
        this.held = false;
      }
      this.closeStartedMs = null;
      return;
    }
    this.openStartedMs = null;
    const centreX = (pose.handX.left + pose.handX.right) / 2;
    const centreY = (pose.handY.left + pose.handY.right) / 2;
    const height = (centreY - pose.shoulderY) / shoulderWidth;
    const wristsApart =
      pose.wristTracked.left &&
      pose.wristTracked.right &&
      Math.hypot(
        pose.wristX.left - pose.wristX.right,
        pose.wristY.left - pose.wristY.right,
      ) /
        shoulderWidth >
        THRESHOLDS.prayerWristDistance;
    const together =
      distance <= THRESHOLDS.prayerCloseDistance &&
      !wristsApart &&
      Math.abs(centreX - pose.shoulderX) <=
        THRESHOLDS.prayerCentreOffset * shoulderWidth &&
      height >= -THRESHOLDS.prayerHeightAbove &&
      height <= THRESHOLDS.prayerHeightBelow;
    if (!together || this.held) {
      this.closeStartedMs = null;
      return;
    }
    this.closeStartedMs ??= timestampMs;
    if (timestampMs - this.closeStartedMs >= THRESHOLDS.prayerHoldMs) {
      this.count++;
      this.held = true;
      this.closeStartedMs = null;
    }
  }

  /** Tracking loss clears a pending contact; a held pose must still open to re-arm. */
  reset(): void {
    this.closeStartedMs = null;
    this.openStartedMs = null;
  }
}
