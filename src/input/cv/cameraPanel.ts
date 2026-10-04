import { createCalibrationGuide } from "./calibrationGuide";
import type { CvInput } from "./cvInput";
import { createDebugOverlay } from "./debugOverlay";
import { createHeadSteeringGuide } from "./headSteeringGuide";

export type CameraMode = "large" | "mini" | "hidden";
const PREVIEW_WIDTH = 640;
let requested: CameraMode = "large";

/** Scenes select a mode; the responsive UI supplies the preview's actual bounds. */
export const cameraPanel = {
  setMode(mode: CameraMode): void {
    requested = mode;
  },
};

export function mountCameraPanel(
  input: CvInput,
  video: HTMLVideoElement,
  gameElement: HTMLElement,
): { destroy(): void } {
  const root = document.createElement("div");
  root.className = "camera-panel";
  root.setAttribute("aria-hidden", "true");
  const stage = document.createElement("div");
  stage.style.cssText =
    "position:absolute;inset:0;width:640px;height:480px;transform-origin:0 0";
  video.style.cssText =
    "position:absolute;inset:0;width:640px;height:480px;transform:scaleX(-1);object-fit:contain";
  stage.appendChild(video);
  root.appendChild(stage);
  gameElement.appendChild(root);
  const steeringGuide = createHeadSteeringGuide(stage, input.getState, video);
  const overlay = createDebugOverlay(stage, 640, 480, video);
  const debug = new URLSearchParams(location.search).has("debug");
  overlay.setStats(debug);
  overlay.setVisible(debug);
  const guide = createCalibrationGuide(
    stage,
    () => input.getCalibration(),
    () => input.getPrompt(),
  );
  let animationFrameId = 0;

  const layout = () => {
    animationFrameId = requestAnimationFrame(layout);
    const ui = gameElement.querySelector<HTMLElement>("#game-ui");
    const slot = ui?.querySelector<HTMLElement>("[data-camera-preview]");
    const hidden =
      requested === "hidden" ||
      ui?.dataset.view === "paused" ||
      ui?.dataset.view === "results";
    if (!slot || hidden) {
      root.dataset.mode = "hidden";
      return;
    }
    const calibration = input.getCalibration();
    const recalibrating =
      calibration !== null &&
      calibration.phase !== "done" &&
      calibration.phase !== "idle";
    const mode = requested === "mini" && recalibrating ? "large" : requested;
    const bounds = slot.getBoundingClientRect();
    let width = bounds.width;
    let left = bounds.left;
    let top = bounds.top;
    if (mode === "large" && requested === "mini") {
      width = Math.min(330, window.innerWidth - 40);
      left = window.innerWidth - width - 20;
      top = Math.min(bounds.top + 45, window.innerHeight - width * 0.75 - 25);
    }
    root.dataset.mode = mode;
    root.style.left = `${left}px`;
    root.style.top = `${top}px`;
    root.style.width = `${width}px`;
    root.style.height = `${width * 0.75}px`;
    stage.style.transform = `scale(${width / PREVIEW_WIDTH})`;
  };
  animationFrameId = requestAnimationFrame(layout);

  return {
    destroy() {
      cancelAnimationFrame(animationFrameId);
      overlay.destroy();
      steeringGuide.destroy();
      guide.destroy();
      root.remove();
    },
  };
}
