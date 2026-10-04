// Owner: Dev 1. Ticket: "Webcam + MediaPipe Pose Landmarker with debug overlay".
// Runs fully in the browser. Inference is driven by requestVideoFrameCallback,
// decoupled from Phaser's render loop.

import { FilesetResolver, PoseLandmarker, type NormalizedLandmark } from "@mediapipe/tasks-vision";

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

export type LandmarkHandler = (landmarks: NormalizedLandmark[] | null, tMs: number) => void;

export class PoseTracker {
  private landmarker?: PoseLandmarker;
  private running = false;
  private lastVideoTime = -1;

  /** Rolling inference stats for the debug overlay. */
  fps = 0;
  inferenceMs = 0;
  private frameTimes: number[] = [];

  constructor(
    private video: HTMLVideoElement,
    private onLandmarks: LandmarkHandler,
  ) {}

  async init(): Promise<void> {
    const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
    this.landmarker = await PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
      runningMode: "VIDEO",
      numPoses: 1,
    });
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: "user" },
      audio: false,
    });
    this.video.srcObject = stream;
    await this.video.play();
  }

  start(): void {
    if (!this.landmarker || this.running) return;
    this.running = true;
    const step = () => {
      if (!this.running || !this.landmarker) return;
      const now = performance.now();
      if (this.video.currentTime !== this.lastVideoTime) {
        this.lastVideoTime = this.video.currentTime;
        const t0 = performance.now();
        const result = this.landmarker.detectForVideo(this.video, now);
        this.inferenceMs = performance.now() - t0;
        this.trackFps(now);
        this.onLandmarks(result.landmarks[0] ?? null, now);
      }
      this.scheduleNext(step);
    };
    this.scheduleNext(step);
  }

  stop(): void {
    this.running = false;
  }

  private scheduleNext(step: () => void): void {
    const v = this.video as HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number;
    };
    if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(step);
    else requestAnimationFrame(step);
  }

  private trackFps(now: number): void {
    this.frameTimes.push(now);
    while (this.frameTimes.length && this.frameTimes[0] < now - 1000) this.frameTimes.shift();
    this.fps = this.frameTimes.length;
  }
}
