import { THRESHOLDS } from "./gestureConfig";
import type { Calibration } from "./gestureDetector";
import { L, isVisiblePoint } from "./landmarks";

export interface CalPoint {
  x: number;
  y: number;
  visibility?: number;
}

export const CAL = {
  captureMs: 2000, // baseline length; with the time to step into the box, total stays under ~5 seconds
  lostPromptMs: 2000, // body missing this long after calibration => ask to recalibrate
  edgeMargin: 0.02, // landmarks closer than this to the image edge count as cut off
  minVisibility: 0.25,
  maxSpread: 0.4, // hips may wander at most this many shoulder widths during capture
  minShoulderWidth: 0.05,
};

/** Shoulders are enough to calibrate a laptop view; hips are used when visible. */
const REQUIRED = [L.SHOULDER_L, L.SHOULDER_R];

export function bodyInFrame(landmarks: ArrayLike<CalPoint> | null): boolean {
  if (!landmarks || landmarks.length < 13) {
    return false;
  }
  const lowerBound = CAL.edgeMargin;
  const upperBound = 1 - CAL.edgeMargin;
  return REQUIRED.every((index) => {
    const point = landmarks[index];
    return (
      isVisiblePoint(point, CAL.minVisibility) &&
      point.x > lowerBound &&
      point.x < upperBound &&
      point.y > lowerBound &&
      point.y < upperBound
    );
  });
}

export type CalibrationPhase = "idle" | "waiting" | "capturing" | "done";

export interface CalibrationStatus {
  phase: CalibrationPhase;
  /** 0..1 through the capture window. */
  progress: number;
  bodyInFrame: boolean;
  /** Set once phase is 'done'; kept until the next start(). */
  calibration: Calibration | null;
}

interface Sample {
  hipsVisible: boolean;
  shoulderWidth: number;
  hipX: number;
  hipY: number;
  shoulderY: number;
  shoulderX: number;
  shoulderRoll: number;
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = sorted.length >> 1;
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function spread(values: number[]): number {
  return Math.max(...values) - Math.min(...values);
}

export function createCalibrator() {
  let phase: CalibrationPhase = "idle";
  let captureStartedMs = 0;
  let samples: Sample[] = [];
  let calibration: Calibration | null = null;

  function status(inFrame: boolean, timestampMs: number): CalibrationStatus {
    let progress = 0;
    if (phase === "capturing") {
      progress = Math.min(1, (timestampMs - captureStartedMs) / CAL.captureMs);
    } else if (phase === "done") {
      progress = 1;
    }
    return { phase, progress, bodyInFrame: inFrame, calibration };
  }

  /** Begin (or restart) calibration. The old baseline stays valid until a new one completes. */
  function start(): void {
    phase = "waiting";
    samples = [];
  }

  function update(
    landmarks: ArrayLike<CalPoint> | null,
    timestampMs: number,
  ): CalibrationStatus {
    const inFrame = bodyInFrame(landmarks);
    if (phase === "idle" || phase === "done" || !landmarks) {
      if (phase === "capturing") {
        phase = "waiting";
        samples = [];
      }
      return status(inFrame, timestampMs);
    }

    if (!inFrame) {
      phase = "waiting";
      samples = [];
      return status(false, timestampMs);
    }

    if (phase === "waiting") {
      phase = "capturing";
      captureStartedMs = timestampMs;
      samples = [];
    }

    const shoulderX =
      (landmarks[L.SHOULDER_L].x + landmarks[L.SHOULDER_R].x) / 2;
    const shoulderY =
      (landmarks[L.SHOULDER_L].y + landmarks[L.SHOULDER_R].y) / 2;
    const shoulderWidth = Math.abs(
      landmarks[L.SHOULDER_L].x - landmarks[L.SHOULDER_R].x,
    );
    const hipsVisible = [L.HIP_L, L.HIP_R].every((index) =>
      isVisiblePoint(landmarks[index], THRESHOLDS.minHipConfidence),
    );
    samples.push({
      hipsVisible,
      shoulderWidth: Math.abs(
        landmarks[L.SHOULDER_L].x - landmarks[L.SHOULDER_R].x,
      ),
      hipX: hipsVisible
        ? (landmarks[L.HIP_L].x + landmarks[L.HIP_R].x) / 2
        : shoulderX,
      hipY: hipsVisible
        ? (landmarks[L.HIP_L].y + landmarks[L.HIP_R].y) / 2
        : Math.min(0.99, shoulderY + shoulderWidth),
      shoulderY,
      shoulderX,
      shoulderRoll:
        (landmarks[L.SHOULDER_R].y - landmarks[L.SHOULDER_L].y) /
        Math.max(
          CAL.minShoulderWidth,
          Math.abs(landmarks[L.SHOULDER_L].x - landmarks[L.SHOULDER_R].x),
        ),
    });

    if (timestampMs - captureStartedMs >= CAL.captureMs) {
      completeCapture(timestampMs);
    }
    return status(true, timestampMs);
  }

  function completeCapture(timestampMs: number): void {
    const shoulderWidth = median(samples.map((sample) => sample.shoulderWidth));
    const hipsStable = samples.every((sample) => sample.hipsVisible);
    const movementSpread =
      Math.max(
        hipsStable ? spread(samples.map((sample) => sample.hipX)) : 0,
        hipsStable ? spread(samples.map((sample) => sample.hipY)) : 0,
        spread(samples.map((sample) => sample.shoulderX)),
        spread(samples.map((sample) => sample.shoulderY)),
      ) / shoulderWidth;
    if (
      shoulderWidth < CAL.minShoulderWidth ||
      movementSpread > CAL.maxSpread
    ) {
      // Player was still walking into position (or too far away): try again.
      phase = "capturing";
      captureStartedMs = timestampMs;
      samples = [];
    } else {
      calibration = {
        shoulderWidth,
        hipX: median(
          samples.map((sample) =>
            hipsStable ? sample.hipX : sample.shoulderX,
          ),
        ),
        hipY: median(
          samples.map((sample) =>
            hipsStable
              ? sample.hipY
              : Math.min(0.99, sample.shoulderY + sample.shoulderWidth),
          ),
        ),
        shoulderY: median(samples.map((sample) => sample.shoulderY)),
        shoulderX: median(samples.map((sample) => sample.shoulderX)),
        shoulderRoll: median(samples.map((sample) => sample.shoulderRoll)),
      };
      phase = "done";
      samples = [];
    }
  }

  return { start, update };
}

/** True once the body has been missing for lostPromptMs. Resets as soon as it is back. */
export function createLostBodyMonitor() {
  let lostSince: number | null = null;
  return {
    update(tracking: boolean, timestampMs: number): boolean {
      if (tracking) {
        lostSince = null;
        return false;
      }
      if (lostSince === null) {
        lostSince = timestampMs;
      }
      return timestampMs - lostSince >= CAL.lostPromptMs;
    },
  };
}
