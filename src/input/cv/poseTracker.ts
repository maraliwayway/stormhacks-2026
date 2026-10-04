import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

export interface TrackerSnapshot {
  landmarks: NormalizedLandmark[] | null;
  fps: number;
  inferenceMs: number;
  frameTs: number;
}

const latest: TrackerSnapshot = {
  landmarks: null,
  fps: 0,
  inferenceMs: 0,
  frameTs: 0,
};

let landmarker: PoseLandmarker | null = null;
let stream: MediaStream | null = null;
let running = false;
let lastTimestampMs = 0;
let frameCount = 0;
let fpsLogTick = 0;
let fpsWindowStart = performance.now();

type FrameListener = (snapshot: TrackerSnapshot) => void;
const listeners: FrameListener[] = [];

/** Called once per processed camera frame (not per render frame). Keep listeners cheap. */
export function onFrame(listener: FrameListener): () => void {
  listeners.push(listener);
  return () => {
    const index = listeners.indexOf(listener);
    if (index >= 0) {
      listeners.splice(index, 1);
    }
  };
}

export function getLatest(): TrackerSnapshot {
  return latest;
}

export async function startTracker(video: HTMLVideoElement): Promise<void> {
  if (running) {
    return;
  }
  running = true;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, frameRate: { ideal: 60, max: 60 } },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();

    const vision = await FilesetResolver.forVisionTasks("/wasm");
    landmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "/models/pose_landmarker_lite.task",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numPoses: 1,
    });
  } catch (error) {
    stopTracker(); // release the camera and allow a retry
    throw error;
  }

  const tick = (now: number) => {
    if (!running) {
      return;
    }
    if (landmarker) {
      const timestampMs = Math.max(now, lastTimestampMs + 1);
      lastTimestampMs = timestampMs;

      const inferenceStartedMs = performance.now();
      const result = landmarker.detectForVideo(video, timestampMs);
      latest.inferenceMs = performance.now() - inferenceStartedMs;
      latest.landmarks = result.landmarks[0] ?? null;
      latest.frameTs = timestampMs;
      for (const listener of listeners) {
        listener(latest);
      }

      frameCount++;
      const elapsed = performance.now() - fpsWindowStart;
      if (elapsed >= 1000) {
        latest.fps = (frameCount * 1000) / elapsed;
        if (++fpsLogTick % 5 === 0) {
          console.log(
            `[cv] ${latest.fps.toFixed(1)} fps, ${latest.inferenceMs.toFixed(1)} ms inference`,
          );
        }
        frameCount = 0;
        fpsWindowStart = performance.now();
      }
    }
    video.requestVideoFrameCallback(tick);
  };
  video.requestVideoFrameCallback(tick);
}

/** Stops the loop, releases the camera and frees the model. Safe to call twice. */
export function stopTracker(): void {
  running = false;
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
  landmarker?.close();
  landmarker = null;
  latest.landmarks = null;
}
