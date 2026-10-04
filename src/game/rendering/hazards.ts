import type Phaser from "phaser";
import type { Hazard } from "../hazards";
import type { Level } from "../levels";

const DESSERT_COLORS = { pot: 0xe77b96, knife: 0x8c5c49, pin: 0xeab75c };
const KITCHEN_COLORS = { pot: 0x517783, knife: 0x7893a0, pin: 0xb17148 };

/** Draw offscreen lane previews and the obstacle art using world coordinates. */
export function drawHazards(
  graphics: Phaser.GameObjects.Graphics,
  hazards: readonly Hazard[],
  cameraY: number,
  levelId: Level["id"],
): void {
  graphics.clear();
  for (const hazard of hazards) {
    if (hazard.y + hazard.height / 2 < cameraY) {
      // At full climb speed, the screen alone is too short for a fair warning.
      const y = cameraY + 145;
      graphics
        .fillStyle(0xffd46b, 0.4)
        .fillRoundedRect(hazard.x - 80, y - 20, 160, 60, 12);
      graphics
        .lineStyle(3, 0xb7782e)
        .strokeRoundedRect(hazard.x - 80, y - 20, 160, 60, 12);
      graphics
        .fillStyle(0xb7782e)
        .fillTriangle(
          hazard.x - 15,
          y + 18,
          hazard.x + 15,
          y + 18,
          hazard.x,
          y - 5,
        );
      continue;
    }
    if (levelId === "dessert") {
      graphics
        .fillStyle(DESSERT_COLORS[hazard.kind])
        .fillRoundedRect(
          hazard.x - hazard.width / 2,
          hazard.y - hazard.height / 2,
          hazard.width,
          hazard.height,
          14,
        );
      graphics
        .lineStyle(4, 0x173e47)
        .strokeRoundedRect(
          hazard.x - hazard.width / 2,
          hazard.y - hazard.height / 2,
          hazard.width,
          hazard.height,
          14,
        );
      graphics.fillStyle(0xfff2d6);
      for (
        let x = hazard.x - hazard.width / 2 + 12;
        x < hazard.x + hazard.width / 2;
        x += 28
      ) {
        graphics.fillCircle(x, hazard.y - 5, 5);
      }
      continue;
    }
    const left = hazard.x - hazard.width / 2;
    const top = hazard.y - hazard.height / 2;
    graphics.fillStyle(KITCHEN_COLORS[hazard.kind]);
    graphics.fillRoundedRect(
      left,
      top,
      hazard.width,
      hazard.height,
      hazard.kind === "knife" ? 4 : 14,
    );
    graphics
      .lineStyle(4, 0x173e47)
      .strokeRoundedRect(left, top, hazard.width, hazard.height, 8);
    if (hazard.kind === "pot") {
      graphics.strokeRect(left - 10, top + 18, 10, 15);
      graphics.strokeRect(left + hazard.width, top + 18, 10, 15);
      graphics.lineBetween(left - 5, top, left + hazard.width + 5, top);
    } else if (hazard.kind === "knife") {
      graphics
        .fillStyle(0x173e47)
        .fillRect(left, top, hazard.width * 0.3, hazard.height);
    } else {
      graphics.fillStyle(0x825738).fillRect(left - 18, hazard.y - 8, 18, 16);
      graphics.fillRect(left + hazard.width, hazard.y - 8, 18, 16);
    }
  }
}
