import type Phaser from "phaser";
import { FLIGHT } from "../flight";
import type { Level } from "../levels";

const MAP_SCROLL_FACTOR = 0.85;

/** Two images scroll the tall authored maps without oversized power-of-two textures. */
export class IllustratedBackdrop {
  private images: Phaser.GameObjects.Image[];
  private levelId: Level["id"] | null = null;
  private startCameraY = 0;

  constructor(scene: Phaser.Scene) {
    this.images = [0, 1].map(() =>
      scene.add
        .image(0, 720, "map-kitchen")
        .setOrigin(0, 1)
        .setScrollFactor(0)
        .setDepth(-20),
    );
  }

  update(cameraY: number, levelId: Level["id"]): void {
    if (levelId !== this.levelId) {
      this.levelId = levelId;
      this.startCameraY = cameraY;
      for (const image of this.images) {
        image.setVisible(levelId !== "heaven");
        if (levelId !== "heaven") {
          image.setTexture(`map-${levelId}`);
          const source = image.texture.getSourceImage();
          image.setDisplaySize(1280, (source.height / source.width) * 1280);
        }
      }
    }
    const height = this.images[0].displayHeight;
    const travel = ((this.startCameraY - cameraY) * MAP_SCROLL_FACTOR) % height;
    this.images[0].setY(720 + travel);
    this.images[1].setY(720 + travel - height);
  }
}

/** Parallax art uses screen coordinates; cameraY controls only the scrolling offsets. */
export function drawBackdrop(
  graphics: Phaser.GameObjects.Graphics,
  cameraY: number,
  levelId: Level["id"],
): void {
  graphics.clear();
  if (levelId === "heaven") {
    // Flat sky and two layers of plain white clouds keep Heaven clean and readable.
    graphics.fillStyle(0xcfe8f4).fillRect(0, 0, 1280, 720);
    for (let layer = 0; layer < 2; layer++) {
      const offset = (((-cameraY * (0.2 + layer * 0.15)) % 260) + 260) % 260;
      const color = layer === 0 ? 0xe6f3fa : 0xffffff;
      for (let row = -1; row < 4; row++) {
        const y = row * 260 + offset + layer * 65;
        for (let column = 0; column < 3; column++) {
          const x = 220 + column * 370 + (row % 2) * 60 + layer * 90;
          graphics
            .fillStyle(color)
            .fillRoundedRect(x - 85, y - 6, 170, 34, 17)
            .fillCircle(x - 40, y, 30)
            .fillCircle(x + 8, y - 14, 40)
            .fillCircle(x + 52, y + 2, 28);
        }
      }
    }
    graphics.lineStyle(5, 0xe7bd67).strokeEllipse(1010, 150, 140, 40);
    return;
  }
  // A light wash separates moving hazards from the detailed background illustration.
  graphics.fillStyle(0xfff8e5, 0.22).fillRect(0, 0, 1280, 720);
  graphics.lineStyle(2, 0x293c33, 0.13);
  for (const x of FLIGHT.lanes) {
    for (let y = 110; y < 720; y += 40) {
      graphics.lineBetween(x, y, x, y + 18);
    }
  }
}
