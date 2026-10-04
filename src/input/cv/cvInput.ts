import { EMPTY_INPUT, type InputSource, type InputState } from "../types";
import {
  type CalibrationStatus,
  createCalibrator,
  createLostBodyMonitor,
} from "./calibration";
import { createGestureDetector } from "./gestureDetector";
import { getLatest, onFrame, startTracker, stopTracker } from "./poseTracker";

export interface CvInput extends InputSource {
  start(): Promise<void>;
  stop(): void;
  /** Calibration progress, for drawing the "stand in the box" guide. */
  getCalibration(): CalibrationStatus | null;
  /** Non-null while recalibrating because the body was lost; show it instead of the default prompt. */
  getPrompt(): string | null;
  recalibrate(): void;
}

/**
 * Camera-driven InputSource: tracker -> calibration -> gesture detector -> InputState.
 * All work happens once per camera frame inside the tracker callback; getState() just
 * returns the latest result, so the game never waits on CV.
 *
 * `calibrated` is true only while a baseline is captured and no recalibration is running,
 * so the game can pause / show the calibrate screen whenever it goes false.
 */
export function createCvInput(video: HTMLVideoElement): CvInput {
  const state: InputState = {
    ...EMPTY_INPUT,
    menuConfirmMode: "clap",
    steeringMode: "head",
    headPosition: null,
    turnLeftCount: 0,
    turnRightCount: 0,
    lastTurnDirection: 0,
  };
  const calibrator = createCalibrator();
  const lostBodyMonitor = createLostBodyMonitor();
  const detector = createGestureDetector();
  let calibrationStatus: CalibrationStatus | null = null;
  let prompt: string | null = null;
  let unsubscribe: (() => void) | null = null;

  const recalibrate = () => {
    prompt = null;
    state.calibrated = false;
    detector.reset();
    calibrator.start();
  };

  const onCalibrationKey = (event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }
    if (event.key === "c" || event.key === "C") {
      recalibrate();
    }
  };

  return {
    getState: () => {
      // Expire the last pose before the next game tick, even after a stalled tab.
      getLatest();
      return state;
    },
    getCalibration: () => calibrationStatus,
    getPrompt: () => getLatest().error ?? prompt,
    recalibrate,

    async start() {
      await startTracker(video);
      unsubscribe = onFrame((frame) => {
        calibrationStatus = calibrator.update(frame.landmarks, frame.frameTs);

        // Body gone for 2 s after calibrating: ask to recalibrate.
        if (
          lostBodyMonitor.update(frame.landmarks !== null, performance.now()) &&
          calibrationStatus.phase === "done"
        ) {
          calibrator.start();
          prompt = "Bring your upper body back into view";
        }
        if (calibrationStatus.phase === "done") {
          prompt = null;
        }

        const gestures = detector.update(
          frame.landmarks,
          frame.frameTs,
          calibrationStatus.calibration ?? undefined,
        );
        state.tracking = gestures.tracking;
        state.flapping = gestures.flapping;
        state.flapVelocity = gestures.flapVelocity;
        state.flapCount = gestures.flapCount;
        state.flapRate = gestures.flapRate;
        state.selectCount = gestures.prayerCount;
        state.swipeLeftCount = gestures.swipeLeftCount;
        state.swipeRightCount = gestures.swipeRightCount;
        state.lastSwipeDirection = gestures.lastSwipeDirection;
        state.swipeInProgress = gestures.swipeInProgress;
        state.strafe = gestures.strafe;
        state.strafeLeft = gestures.strafeLeft;
        state.strafeRight = gestures.strafeRight;
        state.headPosition = gestures.headPosition;
        state.turnLeftCount = gestures.turnLeftCount;
        state.turnRightCount = gestures.turnRightCount;
        state.lastTurnDirection = gestures.lastTurnDirection;
        state.jump = gestures.jump;
        state.squat = gestures.squat;
        state.calibrated = calibrationStatus.phase === "done";
      });
      calibrator.start();
      window.addEventListener("keydown", onCalibrationKey);
    },

    stop() {
      unsubscribe?.();
      unsubscribe = null;
      window.removeEventListener("keydown", onCalibrationKey);
      stopTracker();
      detector.reset();
      Object.assign(state, EMPTY_INPUT);
      state.headPosition = null;
      calibrationStatus = null;
      prompt = null;
    },
  };
}
