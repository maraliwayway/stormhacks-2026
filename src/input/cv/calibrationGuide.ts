import type { CalibrationStatus } from "./calibration";

/**
 * Upper-body guide: a silhouette box that turns green when the shoulders are in
 * frame, plus a progress bar while capturing. Plain canvas so it can sit over the test
 * video or over Phaser. `getStatus` returns null to hide it.
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

    const color = status.bodyInFrame ? "#00e676" : "#ff5252";
    const boxWidth = width * 0.65;
    const boxHeight = height * 0.75;
    const x = (width - boxWidth) / 2;
    const y = (height - boxHeight) / 2;

    context.lineWidth = 4;
    context.strokeStyle = color;
    context.setLineDash([14, 10]);
    context.strokeRect(x, y, boxWidth, boxHeight);
    context.setLineDash([]);

    // simple head + body silhouette hint
    context.globalAlpha = 0.25;
    context.fillStyle = color;
    context.beginPath();
    context.arc(
      width / 2,
      y + boxHeight * 0.12,
      boxHeight * 0.06,
      0,
      Math.PI * 2,
    );
    context.fill();
    context.fillRect(
      width / 2 - boxWidth * 0.3,
      y + boxHeight * 0.2,
      boxWidth * 0.6,
      boxHeight * 0.45,
    );
    context.globalAlpha = 1;

    context.font = "bold 22px sans-serif";
    context.textAlign = "center";
    context.fillStyle = "#fff";
    context.strokeStyle = "#000";
    context.lineWidth = 4;
    const message =
      status.phase === "capturing"
        ? "Hold still..."
        : (getPrompt() ?? "Keep your upper body in view");
    context.strokeText(message, width / 2, height - 36);
    context.fillText(message, width / 2, height - 36);

    if (status.phase === "capturing") {
      context.fillStyle = "rgba(0,0,0,0.5)";
      context.fillRect(x, height - 24, boxWidth, 10);
      context.fillStyle = color;
      context.fillRect(x, height - 24, boxWidth * status.progress, 10);
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
