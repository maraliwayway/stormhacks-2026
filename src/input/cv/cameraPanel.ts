import { createCalibrationGuide } from "./calibrationGuide";
import type { CvInput } from "./cvInput";
import { createDebugOverlay } from "./debugOverlay";
import { createHeadSteeringGuide } from "./headSteeringGuide";

export type CameraMode = "large" | "mini";

/** Panel rectangles in game coordinates (the 1280x720 Phaser canvas). */
const PANEL_BOUNDS = {
  // Title / calibration: bottom right, clear of the centred menu text.
  large: { x: 856, y: 396, w: 400, h: 300 },
  // In game: top right corner. Hazards stay left of x=1015, so this barely touches the play area.
  mini: { x: 1072, y: 12, w: 196, h: 147 },
} as const;
const GAME_WIDTH = 1280;
const PREVIEW_WIDTH = 640;

let root: HTMLDivElement | null = null;
let stage: HTMLDivElement | null = null;
let overlay: ReturnType<typeof createDebugOverlay> | null = null;
let cv: CvInput | null = null;
let requested: CameraMode = "large";
let shown: CameraMode | null = null;

/** Scenes call this; it is a safe no-op in keyboard mode, before the camera starts, or on failure. */
export const cameraPanel = {
  setMode(mode: CameraMode): void {
    requested = mode;
  },
};

/**
 * Floating camera preview with skeleton + calibration guide, laid over the game canvas.
 * - `large` while on the title screen (so the player can step into the box),
 * - `mini` in the corner during play,
 * - temporarily `large` again whenever calibration is running (e.g. body lost for 2 s).
 * It never takes pointer events, so the game stays clickable underneath.
 */
export function mountCameraPanel(
  input: CvInput,
  video: HTMLVideoElement,
  gameElement: HTMLElement,
): { destroy(): void } {
  cv = input;
  root = document.createElement("div");
  root.style.cssText = [
    "position:fixed",
    "overflow:hidden",
    "pointer-events:none",
    "z-index:10",
    "border:3px solid #fff4dc",
    "border-radius:12px",
    "background:#112d34",
    "box-shadow:0 4px 18px rgba(0,0,0,.35)",
    "transition:left .25s,top .25s,width .25s,height .25s,opacity .25s",
  ].join(";");

  stage = document.createElement("div");
  stage.style.cssText = `position:absolute;left:0;top:0;width:${PREVIEW_WIDTH}px;height:480px;transform-origin:0 0;transition:transform .25s`;
  video.style.cssText =
    "position:absolute;left:0;top:0;width:640px;height:480px;transform:scaleX(-1);object-fit:contain";
  stage.appendChild(video);
  root.appendChild(stage);
  document.body.appendChild(root);

  const steeringGuide = createHeadSteeringGuide(stage, input.getState, video);
  overlay = createDebugOverlay(stage, 640, 480, video);
  const guide = createCalibrationGuide(
    stage,
    () => cv!.getCalibration(),
    () => cv!.getPrompt(),
  );

  let animationFrameId = 0;
  const layout = () => {
    animationFrameId = requestAnimationFrame(layout);
    if (!root || !stage) {
      return;
    }
    const canvas = gameElement.querySelector("canvas");
    if (!canvas) {
      return;
    }

    const calibration = cv!.getCalibration();
    const recalibrating =
      calibration !== null &&
      calibration.phase !== "done" &&
      calibration.phase !== "idle";
    const mode: CameraMode =
      requested === "mini" && recalibrating ? "large" : requested;
    if (mode !== shown) {
      shown = mode;
      overlay!.setStats(mode === "large");
    }

    const canvasBounds = canvas.getBoundingClientRect();
    const scale = canvasBounds.width / GAME_WIDTH;
    const box = PANEL_BOUNDS[mode];
    root.style.left = `${canvasBounds.left + box.x * scale}px`;
    root.style.top = `${canvasBounds.top + box.y * scale}px`;
    root.style.width = `${box.w * scale}px`;
    root.style.height = `${box.h * scale}px`;
    root.style.opacity = mode === "mini" ? "0.8" : "1";
    stage.style.transform = `scale(${(box.w * scale) / PREVIEW_WIDTH})`;
  };
  animationFrameId = requestAnimationFrame(layout);

  return {
    destroy() {
      cancelAnimationFrame(animationFrameId);
      overlay?.destroy();
      steeringGuide.destroy();
      guide.destroy();
      root?.remove();
      root = stage = overlay = cv = null;
      shown = null;
    },
  };
}
