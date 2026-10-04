import type Phaser from "phaser";
import {
  type Enemy,
  RETREAT_SECONDS,
  STRIKE_SECONDS,
  WARNING_SECONDS,
} from "../enemies";
import { FLIGHT } from "../flight";

const INK = "#24323a";
const FUR = "#f2a65a";
const FUR_DARK = "#d9843f";
const FUR_LIGHT = "#fde6cf";
const PINK = "#f4a6b5";
const WARN = 0xe4572e;
/** Textures are drawn at twice their display size so they stay sharp in fullscreen. */
const RES = 2;
const FACE = { key: "cat-face", width: 210, height: 180 };
const PAW = { key: "cat-paw", width: 170, height: 860 };
const PEEK_SECONDS = 0.35;
const SLAM_SECONDS = 0.1;

function canvasTexture(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (context: CanvasRenderingContext2D) => void,
): void {
  if (scene.textures.exists(key)) {
    return;
  }
  const texture = scene.textures.createCanvas(key, width * RES, height * RES)!;
  const context = texture.getContext();
  context.scale(RES, RES);
  context.lineJoin = "round";
  context.lineCap = "round";
  draw(context);
  texture.refresh();
}

function shape(
  context: CanvasRenderingContext2D,
  fill: string,
  path: () => void,
  line = 4,
): void {
  context.beginPath();
  path();
  context.fillStyle = fill;
  context.fill();
  if (line > 0) {
    context.lineWidth = line;
    context.strokeStyle = INK;
    context.stroke();
  }
}

/** A flat ginger cat that peeks in from the top of the screen. */
function drawFace(context: CanvasRenderingContext2D): void {
  const cx = FACE.width / 2;
  const cy = 104;
  for (const side of [-1, 1]) {
    shape(context, FUR, () => {
      context.moveTo(cx + side * 78, cy - 20);
      context.quadraticCurveTo(
        cx + side * 86,
        cy - 92,
        cx + side * 66,
        cy - 98,
      );
      context.quadraticCurveTo(
        cx + side * 40,
        cy - 80,
        cx + side * 26,
        cy - 58,
      );
      context.closePath();
    });
    shape(
      context,
      PINK,
      () => {
        context.moveTo(cx + side * 66, cy - 40);
        context.quadraticCurveTo(
          cx + side * 70,
          cy - 80,
          cx + side * 62,
          cy - 82,
        );
        context.quadraticCurveTo(
          cx + side * 48,
          cy - 70,
          cx + side * 40,
          cy - 56,
        );
        context.closePath();
      },
      0,
    );
  }
  shape(context, FUR, () => context.ellipse(cx, cy, 92, 70, 0, 0, Math.PI * 2));
  context.fillStyle = FUR_DARK;
  for (const offset of [-18, 0, 18]) {
    context.beginPath();
    context.roundRect(cx + offset - 4, cy - 68, 8, offset === 0 ? 24 : 18, 4);
    context.fill();
  }
  shape(
    context,
    FUR_LIGHT,
    () => context.ellipse(cx, cy + 30, 46, 30, 0, 0, Math.PI * 2),
    0,
  );
  for (const side of [-1, 1]) {
    shape(
      context,
      INK,
      () => context.ellipse(cx + side * 34, cy - 6, 11, 15, 0, 0, Math.PI * 2),
      0,
    );
    shape(
      context,
      "#ffffff",
      () => context.arc(cx + side * 34 + 4, cy - 12, 4, 0, Math.PI * 2),
      0,
    );
  }
  shape(
    context,
    PINK,
    () => {
      context.moveTo(cx - 9, cy + 16);
      context.lineTo(cx + 9, cy + 16);
      context.lineTo(cx, cy + 25);
      context.closePath();
    },
    2.5,
  );
  context.lineWidth = 3;
  context.strokeStyle = INK;
  context.beginPath();
  context.moveTo(cx, cy + 25);
  context.quadraticCurveTo(cx - 6, cy + 36, cx - 15, cy + 31);
  context.moveTo(cx, cy + 25);
  context.quadraticCurveTo(cx + 6, cy + 36, cx + 15, cy + 31);
  context.stroke();
  context.lineWidth = 2;
  for (const side of [-1, 1]) {
    for (const lift of [-6, 4]) {
      context.beginPath();
      context.moveTo(cx + side * 48, cy + 22 + lift / 2);
      context.lineTo(cx + side * 100, cy + 16 + lift * 1.5);
      context.stroke();
    }
  }
}

/** Foreleg with a round paw and pink toe beans; the bottom is the strike point. */
function drawPaw(context: CanvasRenderingContext2D): void {
  const cx = PAW.width / 2;
  const padY = PAW.height - 78;
  shape(context, FUR, () => context.roundRect(cx - 46, -10, 92, padY + 10, 30));
  context.fillStyle = FUR_DARK;
  for (let y = 60; y < padY - 80; y += 110) {
    context.beginPath();
    context.roundRect(cx - 44, y, 88, 14, 7);
    context.fill();
  }
  shape(context, FUR, () =>
    context.ellipse(cx, padY, 80, 66, 0, 0, Math.PI * 2),
  );
  shape(
    context,
    PINK,
    () => context.ellipse(cx, padY + 18, 34, 26, 0, 0, Math.PI * 2),
    0,
  );
  for (const [dx, dy] of [
    [-48, -14],
    [-18, -36],
    [18, -36],
    [48, -14],
  ]) {
    shape(
      context,
      PINK,
      () => context.ellipse(cx + dx, padY + dy, 13, 16, 0, 0, Math.PI * 2),
      0,
    );
  }
  for (const dx of [-42, -14, 14, 42]) {
    shape(
      context,
      "#ffffff",
      () => {
        context.moveTo(cx + dx - 6, padY + 56);
        context.lineTo(cx + dx, padY + 74);
        context.lineTo(cx + dx + 6, padY + 56);
        context.closePath();
      },
      2.5,
    );
  }
}

export function ensureCatArt(scene: Phaser.Scene): void {
  canvasTexture(scene, FACE.key, FACE.width, FACE.height, drawFace);
  canvasTexture(scene, PAW.key, PAW.width, PAW.height, drawPaw);
}

const easeOut = (t: number): number => 1 - (1 - t) ** 3;

/**
 * Pose comes from the encounter age alone, so pausing or losing tracking freezes
 * the cat exactly where it is.
 */
export class CatRenderer {
  private face: Phaser.GameObjects.Image;
  private paw: Phaser.GameObjects.Image;

  constructor(
    scene: Phaser.Scene,
    private lane: Phaser.GameObjects.Graphics,
  ) {
    ensureCatArt(scene);
    this.face = scene.add
      .image(0, 0, FACE.key)
      .setDisplaySize(FACE.width, FACE.height)
      .setDepth(7)
      .setVisible(false);
    this.paw = scene.add
      .image(0, 0, PAW.key)
      .setOrigin(0.5, 1)
      .setDisplaySize(PAW.width, PAW.height)
      .setDepth(11)
      .setVisible(false);
  }

  draw(enemies: readonly Enemy[], cameraY: number): void {
    this.lane.clear();
    const enemy = enemies[0];
    this.face.setVisible(false);
    this.paw.setVisible(false);
    if (!enemy) {
      return;
    }
    const top = cameraY;
    const impactY = Math.max(
      top + 220,
      Math.min(top + 640, top + enemy.faceOffset + 130),
    );
    const warning = Math.min(1, enemy.age / WARNING_SECONDS);
    const striking = enemy.age >= WARNING_SECONDS;
    // A plain tinted lane and a landing shadow show where the paw will hit.
    this.lane
      .fillStyle(WARN, striking ? 0.22 : 0.06 + warning * 0.12)
      .fillRect(enemy.x - 130, top, 260, FLIGHT.height);
    if (!striking) {
      const peek = easeOut(Math.min(1, enemy.age / PEEK_SECONDS));
      const nervous =
        enemy.age > WARNING_SECONDS - 0.6 ? Math.sin(enemy.age * 60) * 3 : 0;
      this.face
        .setVisible(true)
        .setAlpha(1)
        .setPosition(enemy.x + nervous, top - 100 + peek * 180);
      this.lane
        .fillStyle(WARN, 0.18 + warning * 0.2)
        .fillEllipse(
          enemy.x,
          impactY + 60,
          60 + warning * 110,
          14 + warning * 18,
        );
      return;
    }
    const strikeAge = enemy.age - WARNING_SECONDS;
    let reach: number;
    let alpha = 1;
    if (strikeAge < STRIKE_SECONDS) {
      reach = easeOut(Math.min(1, strikeAge / SLAM_SECONDS));
    } else {
      const back = Math.min(1, (strikeAge - STRIKE_SECONDS) / RETREAT_SECONDS);
      reach = 1 - back;
      alpha = 1 - back * 0.6;
    }
    const bottom = top - 20 + (impactY + 80 - (top - 20)) * reach;
    this.paw.setVisible(true).setAlpha(alpha).setPosition(enemy.x, bottom);
  }

  clear(): void {
    this.lane.clear();
    this.face.setVisible(false);
    this.paw.setVisible(false);
  }
}
