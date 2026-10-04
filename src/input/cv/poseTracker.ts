import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

export interface TrackerSnapshot {
  landmarks: NormalizedLandmark[] | null;
  fps: number;
  inferenceMs: number;
  frameTs: number;
}

const latest: TrackerSnapshot = { landmarks: null, fps: 0, inferenceMs: 0, frameTs: 0 };

let landmarker: PoseLandmarker | null = null;
let lastTs = 0;
let frameCount = 0;
let fpsLogTick = 0;
let fpsWindowStart = performance.now();

type FrameListener = (snap: TrackerSnapshot) => void;
const listeners: FrameListener[] = [];

/** Called once per processed camera frame (not per render frame). Keep listeners cheap. */
export function onFrame(cb: FrameListener) {
  listeners.push(cb);
}

export function getLatest(): TrackerSnapshot {
  return latest;
}

export async function startTracker(videoEl: HTMLVideoElement): Promise<void> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480 },
    audio: false,
  });
  videoEl.srcObject = stream;
  await videoEl.play();

  const vision = await FilesetResolver.forVisionTasks('/wasm');
  landmarker = await PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: '/models/pose_landmarker_lite.task', delegate: 'GPU' },
    runningMode: 'VIDEO',
    numPoses: 1,
  });

  const onFrame = (now: number) => {
    if (landmarker) {
      const ts = Math.max(now, lastTs + 1);
      lastTs = ts;

      const t0 = performance.now();
      const result = landmarker.detectForVideo(videoEl, ts);
      latest.inferenceMs = performance.now() - t0;
      latest.landmarks = result.landmarks[0] ?? null;
      latest.frameTs = ts;
      for (const cb of listeners) cb(latest);

      frameCount++;
      const elapsed = performance.now() - fpsWindowStart;
      if (elapsed >= 1000) {
        latest.fps = (frameCount * 1000) / elapsed;
        if (++fpsLogTick % 5 === 0) {
          console.log(`[cv] ${latest.fps.toFixed(1)} fps, ${latest.inferenceMs.toFixed(1)} ms inference`);
        }
        frameCount = 0;
        fpsWindowStart = performance.now();
      }
    }
    videoEl.requestVideoFrameCallback(onFrame);
  };
  videoEl.requestVideoFrameCallback(onFrame);
}
