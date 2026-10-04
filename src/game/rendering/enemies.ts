import type Phaser from "phaser";
import {
  type Enemy,
  RETREAT_SECONDS,
  STRIKE_SECONDS,
  WARNING_SECONDS,
} from "../enemies";
import { FLIGHT } from "../flight";

/** The lane marker stays fixed while the face gives way to the striking paw. */
export function drawEnemies(
  graphics: Phaser.GameObjects.Graphics,
  enemies: readonly Enemy[],
  cameraY: number,
): void {
  graphics.clear();
  for (const enemy of enemies) {
    const warning = enemy.age < WARNING_SECONDS;
    const strike = enemy.age < WARNING_SECONDS + STRIKE_SECONDS;
    const top = cameraY;
    const x = enemy.x;
    const y = top + enemy.faceOffset;
    const alpha =
      warning || strike
        ? 1
        : Math.max(
            0,
            1 -
              (enemy.age - WARNING_SECONDS - STRIKE_SECONDS) / RETREAT_SECONDS,
          );
    graphics
      .fillStyle(warning ? 0xffd46b : 0xe77b66, warning ? 0.18 : 0.28 * alpha)
      .fillRect(x - 130, top, 260, FLIGHT.height);
    graphics.lineStyle(4, warning ? 0xb7782e : 0xba5a55, alpha);
    graphics.lineBetween(x - 130, top, x - 130, top + FLIGHT.height);
    graphics.lineBetween(x + 130, top, x + 130, top + FLIGHT.height);
    if (warning) {
      drawCatFace(graphics, x, y, enemy.age);
    } else {
      drawCatPaw(graphics, x, y, top, enemy.faceOffset, alpha);
    }
  }
}

function drawCatFace(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  ageSeconds: number,
): void {
  // Face and ears disappear completely when the paw arrives.
  graphics
    .fillStyle(0xd79b61)
    .fillTriangle(x - 70, y - 20, x - 68, y - 95, x - 20, y - 48)
    .fillTriangle(x + 70, y - 20, x + 68, y - 95, x + 20, y - 48);
  graphics.fillEllipse(x, y, 150, 120);
  graphics.lineStyle(4, 0x173e47).strokeEllipse(x, y, 150, 120);
  graphics
    .fillStyle(0xf8d3ba)
    .fillTriangle(x - 58, y - 47, x - 58, y - 77, x - 34, y - 49)
    .fillTriangle(x + 58, y - 47, x + 58, y - 77, x + 34, y - 49);
  graphics
    .fillStyle(0xfff3db)
    .fillEllipse(x - 27, y - 12, 30, 36)
    .fillEllipse(x + 27, y - 12, 30, 36);
  graphics
    .fillStyle(0x173e47)
    .fillEllipse(x - 27, y - 12, 8, 26)
    .fillEllipse(x + 27, y - 12, 8, 26);
  graphics
    .fillStyle(0xba5a55)
    .fillTriangle(x - 9, y + 12, x + 9, y + 12, x, y + 23);
  graphics.lineStyle(3, 0x173e47).lineBetween(x, y + 23, x, y + 32);
  for (const side of [-1, 1]) {
    graphics.lineBetween(x + side * 35, y + 18, x + side * 85, y + 8);
    graphics.lineBetween(x + side * 35, y + 29, x + side * 85, y + 35);
  }
  // The ring fills during the full warning period.
  graphics
    .lineStyle(6, 0xb7782e)
    .beginPath()
    .arc(
      x,
      y,
      90,
      -Math.PI / 2,
      -Math.PI / 2 + Math.PI * 2 * Math.min(1, ageSeconds / WARNING_SECONDS),
      false,
    )
    .strokePath();
}

function drawCatPaw(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  top: number,
  faceOffset: number,
  alpha: number,
): void {
  graphics
    .fillStyle(0xd79b61, alpha)
    .fillRoundedRect(x - 48, top - 40, 96, faceOffset + 40, 25);
  graphics.fillEllipse(x, y + 12, 172, 140);
  for (const dx of [-60, -20, 20, 60]) {
    graphics.fillEllipse(x + dx, y - 48, 45, 60);
  }
  graphics.lineStyle(4, 0x173e47, alpha).strokeEllipse(x, y + 12, 172, 140);
  graphics.fillStyle(0xe6a6a0, alpha).fillEllipse(x, y + 26, 80, 60);
  for (const dx of [-60, -20, 20, 60]) {
    graphics.fillEllipse(x + dx, y - 45, 22, 28);
  }
}
