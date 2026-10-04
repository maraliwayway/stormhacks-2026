// Owner: Dev 1. Ticket: "Calibration screen".
// Captures a ~2 s baseline so every threshold is relative to the player's body.

import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { LM, THRESHOLDS } from "./thresholds";

export interface Baseline {
  shoulderWidth: number;
  shoulderY: number;
  hipX: number;
  hipY: number;
}

export function isFullBodyVisible(lm: NormalizedLandmark[]): boolean {
  const required = [LM.L_SHOULDER, LM.R_SHOULDER, LM.L_WRIST, LM.R_WRIST, LM.L_HIP, LM.R_HIP];
  return required.every((i) => (lm[i]?.visibility ?? 0) >= THRESHOLDS.minVisibility);
}

export class Calibrator {
  private samples: Baseline[] = [];

  constructor(private durationMs = 2000) {}

  private startT?: number;

  /** Feed frames while the player stands still. Returns the baseline once done. */
  add(lm: NormalizedLandmark[], tMs: number): Baseline | null {
    if (!isFullBodyVisible(lm)) {
      this.reset();
      return null;
    }
    this.startT ??= tMs;
    const ls = lm[LM.L_SHOULDER], rs = lm[LM.R_SHOULDER], lh = lm[LM.L_HIP], rh = lm[LM.R_HIP];
    this.samples.push({
      shoulderWidth: Math.hypot(ls.x - rs.x, ls.y - rs.y),
      shoulderY: (ls.y + rs.y) / 2,
      hipX: (lh.x + rh.x) / 2,
      hipY: (lh.y + rh.y) / 2,
    });
    if (tMs - this.startT < this.durationMs) return null;
    return this.average();
  }

  /** 0..1 for the progress ring on the calibration screen. */
  progress(tMs: number): number {
    return this.startT === undefined ? 0 : Math.min(1, (tMs - this.startT) / this.durationMs);
  }

  reset(): void {
    this.samples = [];
    this.startT = undefined;
  }

  private average(): Baseline {
    const n = this.samples.length;
    const sum = this.samples.reduce(
      (a, s) => ({
        shoulderWidth: a.shoulderWidth + s.shoulderWidth,
        shoulderY: a.shoulderY + s.shoulderY,
        hipX: a.hipX + s.hipX,
        hipY: a.hipY + s.hipY,
      }),
      { shoulderWidth: 0, shoulderY: 0, hipX: 0, hipY: 0 },
    );
    return {
      shoulderWidth: sum.shoulderWidth / n,
      shoulderY: sum.shoulderY / n,
      hipX: sum.hipX / n,
      hipY: sum.hipY / n,
    };
  }
}
