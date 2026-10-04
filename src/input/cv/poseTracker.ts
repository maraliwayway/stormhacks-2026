import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import {
  MAX_POSE_AGE_MS,
  type PoseWorkerResponse,
  TARGET_POSE_FPS,
} from "./poseWorkerTypes";

export interface TrackerSnapshot {
  landmarks: NormalizedLandmark[] | null;
  fps: number;
  inferenceMs: number;
  frameTs: number;
  latencyMs: number;
  droppedFrames: number;
  delegate: "GPU" | "CPU" | null;
  error: string | null;
}

const latest: TrackerSnapshot = {
  landmarks: null,
  fps: 0,
  inferenceMs: 0,
  frameTs: 0,
  latencyMs: 0,
  droppedFrames: 0,
  delegate: null,
  error: null,
};
let worker: Worker | null = null;
let stream: MediaStream | null = null;
let activeVideo: HTMLVideoElement | null = null;
let running = false;
let generation = 0;
let callbackId = 0;
let busy = false;
let lastCapturedMs = -Infinity;
let lastReceivedMs = 0;
let frameCount = 0;
let fpsWindowStartedMs = 0;
let watchdog: ReturnType<typeof setInterval> | null = null;
let cancelInitialization: (() => void) | null = null;

type FrameListener = (snapshot: TrackerSnapshot) => void;
const listeners = new Set<FrameListener>();

/** Delivered once per processed camera frame; consumers never await inference. */
export function onFrame(listener: FrameListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getLatest(): TrackerSnapshot {
  expirePose();
  return latest;
}

function expirePose(): void {
  if (
    running &&
    latest.landmarks &&
    performance.now() - latest.frameTs > MAX_POSE_AGE_MS
  ) {
    latest.landmarks = null;
    publish();
  }
}

function publish(): void {
  for (const listener of listeners) {
    listener(latest);
  }
}

function receivePose(
  message: Extract<PoseWorkerResponse, { type: "pose" }>,
): void {
  busy = false;
  lastReceivedMs = performance.now();
  latest.latencyMs = Math.max(0, lastReceivedMs - message.timestampMs);
  latest.landmarks =
    latest.latencyMs <= MAX_POSE_AGE_MS ? message.landmarks : null;
  latest.frameTs = message.timestampMs;
  latest.inferenceMs = message.inferenceMs;
  frameCount++;
  const elapsedMs = lastReceivedMs - fpsWindowStartedMs;
  if (elapsedMs >= 1000) {
    latest.fps = (frameCount * 1000) / elapsedMs;
    frameCount = 0;
    fpsWindowStartedMs = lastReceivedMs;
  }
  publish();
}

async function captureFrame(
  video: HTMLVideoElement,
  timestampMs: number,
  session: number,
): Promise<void> {
  busy = true;
  lastCapturedMs = timestampMs;
  try {
    const image = await createImageBitmap(video);
    if (!running || generation !== session || !worker) {
      image.close();
      return;
    }
    worker.postMessage({ type: "frame", image, timestampMs }, [image]);
  } catch (error) {
    if (generation === session) {
      busy = false;
      latest.error = String(error);
      latest.landmarks = null;
      publish();
    }
  }
}

function scheduleFrames(video: HTMLVideoElement, session: number): void {
  const tick = (timestampMs: number): void => {
    if (!running || generation !== session) {
      return;
    }
    callbackId = video.requestVideoFrameCallback(tick);
    if (busy) {
      latest.droppedFrames++;
      return;
    }
    // Allow camera timestamp jitter without skipping every other frame.
    if (timestampMs - lastCapturedMs >= (0.9 * 1000) / TARGET_POSE_FPS) {
      captureFrame(video, timestampMs, session);
    }
  };
  callbackId = video.requestVideoFrameCallback(tick);
}

export async function startTracker(video: HTMLVideoElement): Promise<void> {
  if (running) {
    return;
  }
  running = true;
  const session = ++generation;
  activeVideo = video;
  lastCapturedMs = -Infinity;
  frameCount = 0;
  fpsWindowStartedMs = performance.now();
  Object.assign(latest, {
    landmarks: null,
    fps: 0,
    inferenceMs: 0,
    frameTs: 0,
    latencyMs: 0,
    droppedFrames: 0,
    delegate: null,
    error: null,
  });
  try {
    const cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: 640,
        height: 480,
        frameRate: { ideal: TARGET_POSE_FPS, max: TARGET_POSE_FPS },
      },
      audio: false,
    });
    if (generation !== session) {
      cameraStream.getTracks().forEach((track) => track.stop());
      throw new Error("Camera startup cancelled");
    }
    stream = cameraStream;
    video.srcObject = stream;
    await video.play();
    if (generation !== session) {
      throw new Error("Camera startup cancelled");
    }

    const poseWorker = new Worker(new URL("./poseWorker.ts", import.meta.url), {
      type: "module",
    });
    worker = poseWorker;
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Camera model initialization timed out")),
        20000,
      );
      const settle = (error?: Error): void => {
        clearTimeout(timeout);
        cancelInitialization = null;
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      };
      cancelInitialization = () =>
        settle(new Error("Camera startup cancelled"));
      poseWorker.onmessage = (
        event: MessageEvent<PoseWorkerResponse>,
      ): void => {
        if (generation !== session) {
          return;
        }
        const message = event.data;
        if (message.type === "ready") {
          latest.delegate = message.delegate;
          settle();
        } else if (message.type === "pose") {
          receivePose(message);
        } else {
          latest.error = message.message;
          settle(new Error(message.message));
          stopTracker();
        }
      };
      poseWorker.onerror = (event): void => {
        if (generation !== session) {
          return;
        }
        latest.error = event.message;
        settle(new Error(event.message));
        stopTracker();
      };
      poseWorker.postMessage({
        type: "initialize",
        wasmUrl: new URL("/wasm", location.href).href,
        modelUrl: new URL("/models/pose_landmarker_lite.task", location.href)
          .href,
      });
    });
    if (generation !== session) {
      throw new Error("Camera startup cancelled");
    }
    lastReceivedMs = performance.now();
    scheduleFrames(video, session);
    watchdog = setInterval(expirePose, 50);
  } catch (error) {
    if (generation === session) {
      stopTracker();
    }
    throw error;
  }
}

/** Cancels callbacks and transfers, terminates inference, and releases the camera. */
export function stopTracker(): void {
  running = false;
  generation++;
  cancelInitialization?.();
  cancelInitialization = null;
  if (watchdog !== null) {
    clearInterval(watchdog);
    watchdog = null;
  }
  if (activeVideo && callbackId) {
    activeVideo.cancelVideoFrameCallback(callbackId);
  }
  callbackId = 0;
  worker?.terminate();
  worker = null;
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
  if (activeVideo) {
    activeVideo.srcObject = null;
  }
  activeVideo = null;
  busy = false;
  latest.landmarks = null;
  publish();
}
