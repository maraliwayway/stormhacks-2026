import { EMPTY_INPUT, type InputSource, type InputState } from '../types';
import { createCalibrator, createLostBodyMonitor, type CalibrationStatus } from './calibration';
import { createGestureDetector } from './gestureDetector';
import { onFrame, startTracker, stopTracker } from './poseTracker';

export interface CvInput extends InputSource {
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
  const state: InputState = { ...EMPTY_INPUT };
  const calibrator = createCalibrator();
  const lostMonitor = createLostBodyMonitor();
  const detector = createGestureDetector();
  let calStatus: CalibrationStatus | null = null;
  let prompt: string | null = null;
  let unsubscribe: (() => void) | null = null;

  const recalibrate = () => {
    prompt = null;
    calibrator.start();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'c' || e.key === 'C') recalibrate();
  };

  return {
    getState: () => state,
    getCalibration: () => calStatus,
    getPrompt: () => prompt,
    recalibrate,

    async start() {
      await startTracker(video);
      unsubscribe = onFrame((snap) => {
        calStatus = calibrator.update(snap.landmarks, snap.frameTs);

        // Body gone for 2 s after calibrating: ask to recalibrate.
        if (lostMonitor.update(snap.landmarks !== null, snap.frameTs) && calStatus.phase === 'done') {
          calibrator.start();
          prompt = 'Body lost - step back in the box';
        }
        if (calStatus.phase === 'done') prompt = null;

        const g = detector.update(snap.landmarks, snap.frameTs, calStatus.calibration ?? undefined);
        state.tracking = g.tracking;
        state.flapping = g.flapping;
        state.flapVelocity = g.flapVelocity;
        state.flapCount = g.flapCount;
        state.flapRate = g.flapRate;
        state.selectCount = g.swipeCount; // a right-arm swipe confirms menus (game reads selectCount)
        state.strafe = g.strafe;
        state.strafeLeft = g.strafeLeft;
        state.strafeRight = g.strafeRight;
        state.jump = g.jump;
        state.squat = g.squat;
        state.calibrated = calStatus.phase === 'done';
      });
      calibrator.start();
      window.addEventListener('keydown', onKey);
    },

    stop() {
      unsubscribe?.();
      unsubscribe = null;
      window.removeEventListener('keydown', onKey);
      stopTracker();
      detector.reset();
      Object.assign(state, EMPTY_INPUT);
      calStatus = null;
      prompt = null;
    },
  };
}
