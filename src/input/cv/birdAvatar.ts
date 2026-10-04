import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { L, isVisiblePoint } from "./landmarks";
import { getLatest } from "./poseTracker";
import { previewBounds } from "./previewBounds";

interface Vec {
  x: number;
  y: number;
}

const INK = "#24323a";
const SKY = "#e3f1f8";
const BODY = "#8ea0b4";
const BELLY = "#d7e0e8";
const WING = "#71849a";
const WING_TIP = "#3f4d5c";
const NECK_GREEN = "#5f9e86";
const NECK_PURPLE = "#8a6aa8";
const FEET = "#e98a5b";
const MIN_CONFIDENCE = 0.3;

const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
const scale = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k });
const mid = (a: Vec, b: Vec): Vec => scale(add(a, b), 0.5);
const length = (a: Vec): number => Math.hypot(a.x, a.y);
const unit = (a: Vec): Vec => scale(a, 1 / (length(a) || 1));

/**
 * Draws the player as a pigeon: the pose drives the body and wings, and the live
 * camera image fills only the head, so the player's own face becomes the bird's head.
 * Everything else from the camera stays hidden.
 */
export function createBirdAvatar(
  host: HTMLElement,
  video: HTMLVideoElement,
  width = 640,
  height = 480,
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.className = "bird-avatar";
  canvas.style.cssText = "position:absolute;left:0;top:0;pointer-events:none;";
  host.appendChild(canvas);
  const context = canvas.getContext("2d")!;
  let animationFrameId = 0;

  const draw = () => {
    animationFrameId = requestAnimationFrame(draw);
    drawPaper(context, width, height);
    const frame = previewBounds(video, width, height);
    const landmarks = getLatest().landmarks;
    const point = (index: number): Vec | null => {
      const landmark: NormalizedLandmark | undefined = landmarks?.[index];
      if (!isVisiblePoint(landmark, MIN_CONFIDENCE)) {
        return null;
      }
      // Mirror horizontally so the bird moves like a reflection.
      return {
        x: frame.x + (1 - landmark.x) * frame.width,
        y: frame.y + landmark.y * frame.height,
      };
    };
    const shoulderA = point(L.SHOULDER_L);
    const shoulderB = point(L.SHOULDER_R);
    if (!shoulderA || !shoulderB) {
      drawGhost(context, width, height);
      return;
    }
    const shoulderWidth = Math.max(30, length(sub(shoulderA, shoulderB)));
    const neck = mid(shoulderA, shoulderB);
    const hipA = point(L.HIP_L);
    const hipB = point(L.HIP_R);
    const hips =
      hipA && hipB
        ? mid(hipA, hipB)
        : add(neck, { x: 0, y: shoulderWidth * 1.25 });
    const head = headCircle(point, neck, shoulderWidth);

    drawTail(context, neck, hips, shoulderWidth);
    drawBody(context, neck, hips, shoulderWidth);
    for (const [shoulder, elbowIndex, wristIndex] of [
      [shoulderA, L.ELBOW_L, L.WRIST_L],
      [shoulderB, L.ELBOW_R, L.WRIST_R],
    ] as const) {
      const outward = Math.sign(shoulder.x - neck.x) || 1;
      drawWing(
        context,
        shoulder,
        point(elbowIndex),
        point(wristIndex),
        outward,
        shoulderWidth,
      );
    }
    drawNeck(context, neck, shoulderWidth);
    drawHead(context, video, frame, head);
  };
  animationFrameId = requestAnimationFrame(draw);

  return {
    destroy() {
      cancelAnimationFrame(animationFrameId);
      canvas.remove();
    },
  };
}

function drawPaper(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  context.fillStyle = SKY;
  context.fillRect(0, 0, width, height);
}

/** A dashed outline shows where to stand before the body is found. */
function drawGhost(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const x = width / 2;
  const y = height * 0.5;
  context.save();
  context.setLineDash([10, 9]);
  context.lineWidth = 4;
  context.strokeStyle = "#a9b5bf";
  context.beginPath();
  context.arc(x, y - 105, 58, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.ellipse(x, y + 60, 95, 110, 0, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

function headCircle(
  point: (index: number) => Vec | null,
  neck: Vec,
  shoulderWidth: number,
): { centre: Vec; radius: number } {
  const earA = point(L.EAR_L);
  const earB = point(L.EAR_R);
  const eyeA = point(L.EYE_L);
  const eyeB = point(L.EYE_R);
  const nose = point(L.NOSE);
  const earWidth = earA && earB ? length(sub(earA, earB)) : 0;
  const radius = Math.max(
    shoulderWidth * 0.3,
    Math.min(shoulderWidth * 0.62, earWidth * 0.95),
  );
  let centre =
    eyeA && eyeB && nose
      ? mid(mid(eyeA, eyeB), nose)
      : (nose ?? (earA && earB ? mid(earA, earB) : null));
  centre ??= add(neck, { x: 0, y: -shoulderWidth * 0.75 });
  // Leave room for the chin inside the circle.
  return { centre: add(centre, { x: 0, y: radius * 0.12 }), radius };
}

function inked(
  context: CanvasRenderingContext2D,
  fill: string,
  path: () => void,
  lineWidth = 4,
): void {
  context.beginPath();
  path();
  context.fillStyle = fill;
  context.fill();
  context.lineWidth = lineWidth;
  context.strokeStyle = INK;
  context.stroke();
}

function drawBody(
  context: CanvasRenderingContext2D,
  neck: Vec,
  hips: Vec,
  shoulderWidth: number,
): void {
  const spine = sub(hips, neck);
  const angle = Math.atan2(spine.y, spine.x) - Math.PI / 2;
  const centre = add(neck, scale(spine, 0.5));
  const radiusY = Math.max(shoulderWidth * 0.7, length(spine) * 0.62);
  inked(context, BODY, () =>
    context.ellipse(
      centre.x,
      centre.y,
      shoulderWidth * 0.62,
      radiusY,
      angle,
      0,
      Math.PI * 2,
    ),
  );
  context.beginPath();
  context.ellipse(
    centre.x,
    centre.y + radiusY * 0.12,
    shoulderWidth * 0.38,
    radiusY * 0.7,
    angle,
    0,
    Math.PI * 2,
  );
  context.fillStyle = BELLY;
  context.fill();
  // Two little feet poke out below the body.
  const feetY = centre.y + radiusY * 0.98;
  context.strokeStyle = FEET;
  context.lineWidth = 6;
  context.lineCap = "round";
  for (const side of [-1, 1]) {
    const footX = centre.x + side * shoulderWidth * 0.2;
    context.beginPath();
    context.moveTo(footX, feetY - 6);
    context.lineTo(footX, feetY + 16);
    context.moveTo(footX - 10, feetY + 18);
    context.lineTo(footX + 10, feetY + 18);
    context.stroke();
  }
}

function drawTail(
  context: CanvasRenderingContext2D,
  neck: Vec,
  hips: Vec,
  shoulderWidth: number,
): void {
  const down = unit(sub(hips, neck));
  const across = { x: -down.y, y: down.x };
  const base = add(hips, scale(down, shoulderWidth * 0.2));
  for (const side of [-1, 0, 1]) {
    const tip = add(
      add(base, scale(down, shoulderWidth * 0.65)),
      scale(across, side * shoulderWidth * 0.28),
    );
    inked(context, WING_TIP, () => {
      context.moveTo(base.x - across.x * 12, base.y - across.y * 12);
      context.lineTo(tip.x, tip.y);
      context.lineTo(base.x + across.x * 12, base.y + across.y * 12);
      context.closePath();
    });
  }
}

function drawWing(
  context: CanvasRenderingContext2D,
  shoulder: Vec,
  elbow: Vec | null,
  wrist: Vec | null,
  outward: number,
  shoulderWidth: number,
): void {
  // Hidden arms fold against the body instead of disappearing.
  const restingWrist = add(shoulder, {
    x: outward * shoulderWidth * 0.25,
    y: shoulderWidth * 0.95,
  });
  const tip = wrist ?? restingWrist;
  const joint = elbow ?? mid(shoulder, tip);
  const along = unit(sub(tip, shoulder));
  let trailing = { x: -along.y, y: along.x };
  // Feathers hang below the arm, or outward when the arm is vertical.
  if (
    trailing.y < 0 ||
    (Math.abs(trailing.y) < 0.2 && trailing.x * outward < 0)
  ) {
    trailing = scale(trailing, -1);
  }
  const featherLength = shoulderWidth * 0.5;
  const feathers = 6;
  for (let index = feathers - 1; index >= 0; index--) {
    const t = (index + 1) / feathers;
    const root =
      t < 0.5
        ? add(shoulder, scale(sub(joint, shoulder), t * 2))
        : add(joint, scale(sub(tip, joint), (t - 0.5) * 2));
    // Outer primaries are longer and sweep toward the wingtip.
    const reach = featherLength * (0.55 + t * 0.65);
    const direction = unit(add(trailing, scale(along, 0.25 + t * 0.6)));
    const end = add(root, scale(direction, reach));
    const angle = Math.atan2(direction.y, direction.x);
    const centre = mid(root, end);
    inked(
      context,
      t > 0.6 ? WING_TIP : WING,
      () =>
        context.ellipse(
          centre.x,
          centre.y,
          reach / 2,
          shoulderWidth * 0.09,
          angle,
          0,
          Math.PI * 2,
        ),
      3,
    );
  }
  // The arm itself is the wing's leading edge.
  context.lineCap = "round";
  context.lineJoin = "round";
  for (const [color, widthScale] of [
    [INK, 0.3],
    [WING, 0.3 - 8 / shoulderWidth],
  ] as const) {
    context.strokeStyle = color;
    context.lineWidth = Math.max(4, shoulderWidth * widthScale);
    context.beginPath();
    context.moveTo(shoulder.x, shoulder.y);
    context.lineTo(joint.x, joint.y);
    context.lineTo(tip.x, tip.y);
    context.stroke();
  }
}

function drawNeck(
  context: CanvasRenderingContext2D,
  neck: Vec,
  shoulderWidth: number,
): void {
  const radiusX = shoulderWidth * 0.36;
  const radiusY = shoulderWidth * 0.2;
  inked(context, NECK_GREEN, () =>
    context.ellipse(neck.x, neck.y, radiusX, radiusY, 0, 0, Math.PI * 2),
  );
  context.beginPath();
  context.ellipse(neck.x, neck.y, radiusX - 2, radiusY - 2, 0, 0, Math.PI);
  context.fillStyle = NECK_PURPLE;
  context.fill();
}

function drawHead(
  context: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  frame: ReturnType<typeof previewBounds>,
  head: { centre: Vec; radius: number },
): void {
  const { centre, radius } = head;
  // A crest of three feathers sits on top of the head.
  for (const offset of [-0.35, 0, 0.35]) {
    const base = add(centre, {
      x: Math.sin(offset) * radius,
      y: -Math.cos(offset) * radius,
    });
    inked(
      context,
      BODY,
      () =>
        context.ellipse(
          base.x + Math.sin(offset) * 12,
          base.y - 12,
          9,
          20,
          offset,
          0,
          Math.PI * 2,
        ),
      3,
    );
  }
  inked(
    context,
    BODY,
    () => context.arc(centre.x, centre.y, radius + 9, 0, Math.PI * 2),
    5,
  );
  context.save();
  context.beginPath();
  context.arc(centre.x, centre.y, radius, 0, Math.PI * 2);
  context.clip();
  if (video.readyState >= 2) {
    context.translate(frame.x + frame.width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, frame.y, frame.width, frame.height);
  } else {
    context.fillStyle = BELLY;
    context.fill();
  }
  context.restore();
  context.beginPath();
  context.arc(centre.x, centre.y, radius, 0, Math.PI * 2);
  context.lineWidth = 3;
  context.strokeStyle = INK;
  context.stroke();
}
