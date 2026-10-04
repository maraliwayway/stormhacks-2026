import { PoseLandmarker } from "@mediapipe/tasks-vision";
import { getLatest } from "./poseTracker";
import { previewBounds } from "./previewBounds";

/**
 * Canvas overlay: skeleton, FPS, inference time and pose latency. Shown only with `?debug`.
 * Plain canvas, so it works over the test page's <video> or on top of Phaser.
 * Landmarks are drawn mirrored (x flipped) to match a mirrored video.
 */
export function createDebugOverlay(
  host: HTMLElement,
  width = 640,
  height = 480,
  video?: HTMLVideoElement,
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.style.cssText = "position:absolute;left:0;top:0;pointer-events:none;";
  host.appendChild(canvas);
  const context = canvas.getContext("2d")!;

  let visible = true;
  let stats = true;
  let animationFrameId = 0;

  const draw = () => {
    animationFrameId = requestAnimationFrame(draw);
    context.clearRect(0, 0, width, height);
    if (!visible) {
      return;
    }

    const snapshot = getLatest();
    const landmarks = snapshot.landmarks;
    const frame = previewBounds(video, width, height);

    if (landmarks) {
      context.strokeStyle = "#00e5ff";
      context.lineWidth = 3;
      for (const { start, end } of PoseLandmarker.POSE_CONNECTIONS) {
        const startPoint = landmarks[start];
        const endPoint = landmarks[end];
        context.beginPath();
        context.moveTo(
          frame.x + (1 - startPoint.x) * frame.width,
          frame.y + startPoint.y * frame.height,
        );
        context.lineTo(
          frame.x + (1 - endPoint.x) * frame.width,
          frame.y + endPoint.y * frame.height,
        );
        context.stroke();
      }
      context.fillStyle = "#ff4081";
      for (const point of landmarks) {
        context.beginPath();
        context.arc(
          frame.x + (1 - point.x) * frame.width,
          frame.y + point.y * frame.height,
          4,
          0,
          Math.PI * 2,
        );
        context.fill();
      }
    }

    if (!stats) {
      return;
    }
    context.font = "16px monospace";
    context.fillStyle = "rgba(0,0,0,0.6)";
    context.fillRect(0, 0, 370, 68);
    context.fillStyle = snapshot.fps >= 25 ? "#69f0ae" : "#ff5252";
    context.fillText(
      `FPS ${snapshot.fps.toFixed(1)}  ${snapshot.delegate ?? "loading"}`,
      8,
      20,
    );
    context.fillStyle = "#fff";
    context.fillText(
      `inference ${snapshot.inferenceMs.toFixed(1)} ms${landmarks ? "" : "  (no body)"}`,
      8,
      40,
    );
    context.fillText(
      `latency ${snapshot.latencyMs.toFixed(1)} ms  skipped ${snapshot.droppedFrames}`,
      8,
      60,
    );
  };

  animationFrameId = requestAnimationFrame(draw);

  return {
    setVisible(value: boolean) {
      visible = value;
    },
    /** FPS / inference text. Off for the small in-game preview, where it would be unreadable. */
    setStats(value: boolean) {
      stats = value;
    },
    destroy() {
      cancelAnimationFrame(animationFrameId);
      canvas.remove();
    },
  };
}
