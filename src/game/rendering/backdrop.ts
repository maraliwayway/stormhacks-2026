import type Phaser from "phaser";
import { FLIGHT } from "../flight";
import type { Level } from "../levels";

/** Parallax art uses screen coordinates; cameraY controls only the scrolling offsets. */
export function drawBackdrop(
  graphics: Phaser.GameObjects.Graphics,
  cameraY: number,
  levelId: Level["id"],
): void {
  graphics.clear();
  if (levelId === "heaven") {
    graphics.fillStyle(0xc6e4f4).fillRect(70, 0, 1140, 720);
    // A golden halo and layered clouds make Heaven a playable sky map.
    graphics.fillStyle(0xfff3c9, 0.65).fillCircle(1010, 160, 100);
    graphics.lineStyle(5, 0xe7bd67, 0.8).strokeEllipse(1010, 160, 140, 46);
    for (let layer = 0; layer < 2; layer++) {
      const offset = (((-cameraY * (0.2 + layer * 0.15)) % 260) + 260) % 260;
      for (let row = -1; row < 4; row++) {
        const y = row * 260 + offset;
        for (let column = 0; column < 3; column++) {
          const x = 220 + column * 370 + (row % 2) * 60;
          graphics
            .fillStyle(0xffffff, layer === 0 ? 0.45 : 0.9)
            .fillEllipse(x, y + layer * 65, 210, 52)
            .fillCircle(x - 45, y + layer * 65 - 18, 34)
            .fillCircle(x + 10, y + layer * 65 - 30, 46)
            .fillCircle(x + 65, y + layer * 65 - 12, 30);
        }
      }
    }
    graphics.lineStyle(2, 0xe7bd67, 0.7);
    for (let i = 0; i < 9; i++) {
      const x = 150 + i * 120;
      const y = ((((i * 83 - cameraY * 0.1) % 650) + 650) % 650) + 30;
      graphics.lineBetween(x - 5, y, x + 5, y).lineBetween(x, y - 5, x, y + 5);
    }
    return;
  }
  graphics
    .fillStyle(levelId === "dessert" ? 0xf7c4d5 : 0xe7c99b)
    .fillRect(70, 0, 1140, 720);
  graphics.lineStyle(2, levelId === "dessert" ? 0xda86a5 : 0xdbc08f, 0.6);
  for (let x = 100; x < 1280; x += 120) {
    graphics.lineBetween(x, 0, x, 720);
  }
  const offset = (((-cameraY * 0.5) % 240) + 240) % 240;
  for (let y = offset - 240; y < 720; y += 240) {
    graphics.lineBetween(70, y, 1210, y);
    graphics
      .fillStyle(levelId === "dessert" ? 0xb97596 : 0xc29664)
      .fillRoundedRect(100, y + 150, 1080, 18, 6);
  }
  graphics.fillStyle(0x183e46, 0.06);
  for (const x of FLIGHT.lanes) {
    graphics.fillRect(x - 2, 0, 4, 720);
  }
}
