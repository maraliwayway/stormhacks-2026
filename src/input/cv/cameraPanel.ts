import type { CvInput } from './cvInput';
import { createDebugOverlay } from './debugOverlay';
import { createCalibrationGuide } from './calibrationGuide';

export type CameraMode = 'large' | 'mini';

/** Panel rectangles in game coordinates (the 1280x720 Phaser canvas). */
const RECT = {
  // Title / calibration: bottom right, clear of the centred menu text.
  large: { x: 856, y: 396, w: 400, h: 300 },
  // In game: top right corner. Hazards stay left of x=1015, so this barely touches the play area.
  mini: { x: 1072, y: 12, w: 196, h: 147 },
} as const;
const GAME_W = 1280;
const STAGE_W = 640;

let root: HTMLDivElement | null = null;
let stage: HTMLDivElement | null = null;
let overlay: ReturnType<typeof createDebugOverlay> | null = null;
let cv: CvInput | null = null;
let requested: CameraMode = 'large';
let shown: CameraMode | null = null;

/** Scenes call this; it is a safe no-op in keyboard mode, before the camera starts, or on failure. */
export const cameraPanel = {
  setMode(mode: CameraMode): void { requested = mode; },
};

/**
 * Floating camera preview with skeleton + calibration guide, laid over the game canvas.
 * - `large` while on the title screen (so the player can step into the box),
 * - `mini` in the corner during play,
 * - temporarily `large` again whenever calibration is running (e.g. body lost for 2 s).
 * It never takes pointer events, so the game stays clickable underneath.
 */
export function mountCameraPanel(input: CvInput, video: HTMLVideoElement, gameEl: HTMLElement): { destroy(): void } {
  cv = input;
  root = document.createElement('div');
  root.style.cssText = [
    'position:fixed', 'overflow:hidden', 'pointer-events:none', 'z-index:10',
    'border:3px solid #fff4dc', 'border-radius:12px', 'background:#112d34',
    'box-shadow:0 4px 18px rgba(0,0,0,.35)',
    'transition:left .25s,top .25s,width .25s,height .25s,opacity .25s',
  ].join(';');

  stage = document.createElement('div');
  stage.style.cssText = `position:absolute;left:0;top:0;width:${STAGE_W}px;height:480px;transform-origin:0 0;transition:transform .25s`;
  video.style.cssText = 'position:absolute;left:0;top:0;width:640px;height:480px;transform:scaleX(-1);object-fit:cover';
  stage.appendChild(video);
  root.appendChild(stage);
  document.body.appendChild(root);

  overlay = createDebugOverlay(stage);
  const guide = createCalibrationGuide(stage, () => cv!.getCalibration(), () => cv!.getPrompt());

  let raf = 0;
  const layout = () => {
    raf = requestAnimationFrame(layout);
    if (!root || !stage) return;
    const canvas = gameEl.querySelector('canvas');
    if (!canvas) return;

    const cal = cv!.getCalibration();
    const recalibrating = cal !== null && cal.phase !== 'done' && cal.phase !== 'idle';
    const mode: CameraMode = requested === 'mini' && recalibrating ? 'large' : requested;
    if (mode !== shown) {
      shown = mode;
      overlay!.setStats(mode === 'large');
    }

    const r = canvas.getBoundingClientRect();
    const scale = r.width / GAME_W;
    const box = RECT[mode];
    root.style.left = `${r.left + box.x * scale}px`;
    root.style.top = `${r.top + box.y * scale}px`;
    root.style.width = `${box.w * scale}px`;
    root.style.height = `${box.h * scale}px`;
    root.style.opacity = mode === 'mini' ? '0.8' : '1';
    stage.style.transform = `scale(${(box.w * scale) / STAGE_W})`;
  };
  raf = requestAnimationFrame(layout);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      overlay?.destroy();
      guide.destroy();
      root?.remove();
      root = stage = overlay = cv = null;
      shown = null;
    },
  };
}
