import type { InputState } from "../types";
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
        ? "rgba(255,212,107,0.24)"
        : "rgba(105,240,174,0.08)";
      context.fillRect(x, frame.y, zoneWidth, frame.height);
      context.strokeStyle = active ? "#ffd46b" : "#b7dbd7";
      context.lineWidth = 3;
      context.beginPath();
      const edge = side === -1 ? leftEdge : rightEdge;
      context.moveTo(edge, frame.y);
      context.lineTo(edge, frame.y + frame.height);
      context.stroke();
    }

    const labelY = frame.y + frame.height - 36;
    context.fillStyle = "rgba(17,45,52,0.8)";
    context.fillRect(frame.x, labelY - 42, frame.width, 70);
    context.font = "bold 40px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#fff4dc";
    context.fillText("LEFT", frame.x + frame.width * 0.175, labelY);
    context.fillText("STAY", frame.x + frame.width * 0.5, labelY);
    context.fillText("RIGHT", frame.x + frame.width * 0.825, labelY);
    if (state.tracking && state.headPosition != null) {
      const headX = frame.x + state.headPosition * frame.width;
      context.fillStyle = state.strafe === 0 ? "#69f0ae" : "#ffd46b";
      context.beginPath();
      context.arc(headX, labelY - 30, 9, 0, Math.PI * 2);
      context.fill();
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
