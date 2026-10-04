// Owner: Dev 1. Glue between PoseTracker, Calibrator and GestureDetector.
// Scenes call start() / beginCalibration() and read latestLandmarks for the overlay.

import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { Calibrator, type Baseline } from "./Calibration";
import { GestureDetector } from "./GestureDetector";
import { PoseTracker } from "./PoseTracker";

type State = "off" | "starting" | "calibrating" | "tracking" | "failed";

class PoseSessionImpl {
  state: State = "off";
  error?: string;
  latestLandmarks: NormalizedLandmark[] | null = null;
  calibrationProgress = 0;
  tracker?: PoseTracker;

  private calibrator = new Calibrator();
  private detector?: GestureDetector;
  private onCalibrated?: (b: Baseline) => void;

  async start(): Promise<void> {
    if (this.state !== "off" && this.state !== "failed") return;
    this.state = "starting";
    try {
      const video = document.getElementById("webcam") as HTMLVideoElement;
      this.tracker = new PoseTracker(video, (lm, t) => this.handle(lm, t));
      await this.tracker.init();
      this.tracker.start();
      this.state = "calibrating";
    } catch (err) {
      console.warn("Pose tracking unavailable, falling back to keyboard", err);
      this.error = String(err);
      this.state = "failed";
    }
  }

  beginCalibration(onDone: (b: Baseline) => void): void {
    this.calibrator.reset();
    this.calibrationProgress = 0;
    this.onCalibrated = onDone;
    if (this.state === "tracking") this.state = "calibrating";
  }

  private handle(lm: NormalizedLandmark[] | null, tMs: number): void {
    this.latestLandmarks = lm;
    if (this.state === "calibrating") {
      if (!lm) return;
      const baseline = this.calibrator.add(lm, tMs);
      this.calibrationProgress = this.calibrator.progress(tMs);
      if (baseline) {
        if (this.detector) this.detector.setBaseline(baseline);
        else this.detector = new GestureDetector(baseline);
        this.state = "tracking";
        this.onCalibrated?.(baseline);
      }
      return;
    }
    if (this.state === "tracking") this.detector?.update(lm, tMs);
  }
}

export const PoseSession = new PoseSessionImpl();
