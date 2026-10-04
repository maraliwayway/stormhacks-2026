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
    graphics.fillStyle(0xc6e4f4).fillRect(0, 0, 1280, 720);
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
  // A light wash separates moving hazards from the detailed background illustration.
  graphics.fillStyle(0xfff8e5, 0.22).fillRect(0, 0, 1280, 720);
  graphics.lineStyle(2, 0x293c33, 0.13);
  for (const x of FLIGHT.lanes) {
    for (let y = 110; y < 720; y += 40) {
      graphics.lineBetween(x, y, x, y + 18);
    }
  }
}
