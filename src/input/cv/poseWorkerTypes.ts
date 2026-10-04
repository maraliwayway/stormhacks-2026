import type { NormalizedLandmark } from "@mediapipe/tasks-vision";

export type PoseWorkerRequest =
  | { type: "initialize"; wasmUrl: string; modelUrl: string }
  | { type: "frame"; image: ImageBitmap; timestampMs: number };

export type PoseWorkerResponse =
  | { type: "ready"; delegate: "GPU" | "CPU" }
  | {
      type: "pose";
      landmarks: NormalizedLandmark[] | null;
      timestampMs: number;
      inferenceMs: number;
    }
  | { type: "error"; message: string };

/** Reject old poses instead of letting delayed gestures control the current frame. */
export const MAX_POSE_AGE_MS = 250;
export const TARGET_POSE_FPS = 30;
