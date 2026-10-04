import type { CalibrationStatus } from "./calibration";

const INK = "#24323a";
const PAPER = "#fbf8ef";
const GO = "#7cb46b";
export const HAND_FONT = '"Patrick Hand", "Comic Sans MS", sans-serif';

/**
 * Calibration prompt: one line of handwritten text and a fill bar while capturing.
 * Plain canvas so it can sit over the test video or the bird avatar. `getStatus`
 * returns null to hide it.
 */
export function createCalibrationGuide(
  host: HTMLElement,
  getStatus: () => CalibrationStatus | null,
  getPrompt: () => string | null = () => null,
  width = 640,
  height = 480,
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.style.cssText = "position:absolute;left:0;top:0;pointer-events:none;";
  host.appendChild(canvas);
  const context = canvas.getContext("2d")!;
  let animationFrameId = 0;

  const draw = () => {
    animationFrameId = requestAnimationFrame(draw);
    context.clearRect(0, 0, width, height);
    const status = getStatus();
    if (!status || status.phase === "idle" || status.phase === "done") {
      return;
    }
    const message =
      status.phase === "capturing"
        ? "Hold still..."
        : (getPrompt() ??
          (status.bodyInFrame
            ? "Hold still..."
            : "Step back so your shoulders fit"));
    context.font = `30px ${HAND_FONT}`;
    const textWidth = context.measureText(message).width;
    const pillWidth = Math.max(260, textWidth + 48);
    const pillX = (width - pillWidth) / 2;
    const pillY = height - 78;
    context.fillStyle = PAPER;
    context.strokeStyle = INK;
    context.lineWidth = 3;
    context.beginPath();
    context.roundRect(pillX, pillY, pillWidth, 58, 12);
    context.fill();
    context.stroke();
    context.fillStyle = INK;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(message, width / 2, pillY + 25);
    if (status.phase === "capturing") {
      const barX = pillX + 18;
      const barWidth = pillWidth - 36;
      context.fillStyle = "#e3e8ec";
      context.fillRect(barX, pillY + 44, barWidth, 6);
      context.fillStyle = GO;
      context.fillRect(barX, pillY + 44, barWidth * status.progress, 6);
    }
  };
  animationFrameId = requestAnimationFrame(draw);

  return {
    destroy() {
      cancelAnimationFrame(animationFrameId);
      canvas.remove();
    },
  };
}
