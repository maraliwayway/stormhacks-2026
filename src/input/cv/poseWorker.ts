import { PoseLandmarker } from "@mediapipe/tasks-vision";
import {
  POSE_CONFIDENCE,
  type PoseWorkerRequest,
  type PoseWorkerResponse,
} from "./poseWorkerTypes";

// A narrow worker interface avoids mixing DOM and WebWorker globals in tsconfig.
const scope = self as unknown as {
  onmessage: (event: MessageEvent<PoseWorkerRequest>) => void;
  postMessage(message: PoseWorkerResponse): void;
};
let landmarker: PoseLandmarker | null = null;

async function initialize(wasmUrl: string, modelUrl: string): Promise<void> {
  // The module loader exposes ModuleFactory in an ES module worker.
  const fileset = {
    wasmLoaderPath: `${wasmUrl}/vision_wasm_module_internal.js`,
    wasmBinaryPath: `${wasmUrl}/vision_wasm_module_internal.wasm`,
  };
  for (const delegate of ["GPU", "CPU"] as const) {
    try {
      landmarker = await PoseLandmarker.createFromOptions(fileset, {
        canvas: new OffscreenCanvas(640, 480),
        baseOptions: { modelAssetPath: modelUrl, delegate },
        runningMode: "VIDEO",
        numPoses: 1,
        minPoseDetectionConfidence: POSE_CONFIDENCE.detection,
        minPosePresenceConfidence: POSE_CONFIDENCE.presence,
        minTrackingConfidence: POSE_CONFIDENCE.tracking,
        outputSegmentationMasks: false,
      });
      scope.postMessage({ type: "ready", delegate });
      return;
    } catch (error) {
      if (delegate === "CPU") {
        throw error;
      }
      console.warn("Camera GPU initialization failed; retrying on CPU", error);
    }
  }
}

function detectFrame(image: ImageBitmap, timestampMs: number): void {
  try {
    if (!landmarker) {
      throw new Error("Pose tracker has not initialized");
    }
    const startedMs = performance.now();
    const result = landmarker.detectForVideo(image, timestampMs);
    scope.postMessage({
      type: "pose",
      landmarks: result.landmarks[0] ?? null,
      timestampMs,
      inferenceMs: performance.now() - startedMs,
    });
  } catch (error) {
    scope.postMessage({ type: "error", message: String(error) });
  } finally {
    image.close();
  }
}

scope.onmessage = (event): void => {
  const message = event.data;
  if (message.type === "frame") {
    detectFrame(message.image, message.timestampMs);
    return;
  }
  initialize(message.wasmUrl, message.modelUrl).catch((error) => {
    scope.postMessage({ type: "error", message: String(error) });
  });
};
