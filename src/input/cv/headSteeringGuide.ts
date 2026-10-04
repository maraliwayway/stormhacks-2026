import type { InputState } from "../types";
import { HAND_FONT } from "./calibrationGuide";
import { HEAD_STEERING } from "./headSteering";
import { previewBounds } from "./previewBounds";

/** Show the same mirrored side zones that generate turns, including the inert centre. */
export function createHeadSteeringGuide(
  host: HTMLElement,
  getState: () => Readonly<InputState>,
  video: HTMLVideoElement,
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
    const state = getState();
    if (!state.calibrated || state.steeringMode !== "head") {
      return;
    }
    const frame = previewBounds(video, width, height);
    const leftEdge = frame.x + frame.width * HEAD_STEERING.leftEnter;
    const rightEdge = frame.x + frame.width * HEAD_STEERING.rightEnter;
    for (const side of [-1, 1]) {
      const active = state.tracking && state.strafe === side;
      const x = side === -1 ? frame.x : rightEdge;
      const zoneWidth = frame.width * HEAD_STEERING.leftEnter;
      context.fillStyle = active
        ? "rgba(255,209,102,0.35)"
        : "rgba(36,50,58,0.05)";
      context.fillRect(x, frame.y, zoneWidth, frame.height);
      context.strokeStyle = "#24323a";
      context.globalAlpha = 0.35;
      context.lineWidth = 2;
      context.setLineDash([8, 8]);
      context.beginPath();
      const edge = side === -1 ? leftEdge : rightEdge;
      context.moveTo(edge, frame.y);
      context.lineTo(edge, frame.y + frame.height);
      context.stroke();
      context.setLineDash([]);
      context.globalAlpha = 1;
    }

    const labelY = frame.y + 34;
    context.font = `34px ${HAND_FONT}`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    const labels = [
      ["LEFT", 0.175, -1],
      ["STAY", 0.5, 0],
      ["RIGHT", 0.825, 1],
    ] as const;
    for (const [label, position, side] of labels) {
      const active = state.tracking && state.strafe === side;
      context.fillStyle = active ? "#24323a" : "rgba(36,50,58,0.45)";
      context.fillText(label, frame.x + frame.width * position, labelY);
    }
    if (state.tracking && state.headPosition != null) {
      const headX = frame.x + state.headPosition * frame.width;
      context.fillStyle = "#ffd166";
      context.strokeStyle = "#24323a";
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(headX, labelY + 22);
      context.lineTo(headX - 11, labelY + 40);
      context.lineTo(headX + 11, labelY + 40);
      context.closePath();
      context.fill();
      context.stroke();
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
