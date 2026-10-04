import { createBirdAvatar } from "./birdAvatar";
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
  // The video only feeds the avatar's face; the player sees a pigeon, not the raw feed.
  video.style.cssText =
    "position:absolute;inset:0;width:640px;height:480px;object-fit:contain;opacity:0";
  stage.appendChild(video);
  root.appendChild(stage);
  gameElement.appendChild(root);
  const avatar = createBirdAvatar(stage, video);
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
    // The last visible slot wins, so the "come back into view" slot replaces the HUD preview.
    const slot = Array.from(
      ui?.querySelectorAll<HTMLElement>("[data-camera-preview]") ?? [],
    )
      .filter((element) => element.getClientRects().length > 0)
      .pop();
    const hidden =
      requested === "hidden" ||
      ui?.dataset.view === "paused" ||
      ui?.dataset.view === "warmup" ||
      ui?.dataset.view === "results";
    if (!slot || hidden) {
      root.dataset.mode = "hidden";
      return;
    }
    const bounds = slot.getBoundingClientRect();
    // Fit the 4:3 stage inside the slot and centre it.
    const width = Math.min(bounds.width, bounds.height / 0.75);
    const height = width * 0.75;
    root.dataset.mode = slot.dataset.cameraPreview || requested;
    root.style.left = `${bounds.left + (bounds.width - width) / 2}px`;
    root.style.top = `${bounds.top + (bounds.height - height) / 2}px`;
    root.style.width = `${width}px`;
    root.style.height = `${height}px`;
    stage.style.transform = `scale(${width / PREVIEW_WIDTH})`;
  };
  animationFrameId = requestAnimationFrame(layout);

  return {
    destroy() {
      cancelAnimationFrame(animationFrameId);
      avatar.destroy();
      overlay.destroy();
      steeringGuide.destroy();
      guide.destroy();
      root.remove();
    },
  };
}
