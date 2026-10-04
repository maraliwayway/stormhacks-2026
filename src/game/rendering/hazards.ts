import type Phaser from "phaser";
import { hazardAppearance } from "../hazardAppearance";
import type { Hazard } from "../hazards";
import type { Level } from "../levels";

/** One sprite per active obstacle; previews give offscreen obstacles a visible lane. */
export class HazardRenderer {
  private images = new Map<number, Phaser.GameObjects.Image>();

  constructor(
    private scene: Phaser.Scene,
    private graphics: Phaser.GameObjects.Graphics,
  ) {}

  draw(
    hazards: readonly Hazard[],
    cameraY: number,
    levelId: Level["id"],
  ): void {
    this.graphics.clear();
    const activeIds = new Set(hazards.map((hazard) => hazard.id));
    for (const [id, image] of this.images) {
      if (!activeIds.has(id)) {
        image.destroy();
        this.images.delete(id);
      }
    }
    for (const hazard of hazards) {
      const key =
        hazard.art ?? hazardAppearance(hazard.id, hazard.kind, levelId).texture;
      let image = this.images.get(hazard.id);
      if (!image) {
        image = this.scene.add.image(hazard.x, hazard.y, key).setDepth(5);
        this.images.set(hazard.id, image);
      }
      const offscreen = hazard.y + hazard.height / 2 < cameraY + 110;
      image
        .setVisible(!offscreen)
        .setPosition(hazard.x, hazard.y)
        .setDisplaySize(hazard.width, hazard.height);
      if (offscreen && !hazard.passed) {
        this.drawPreview(hazard.x, cameraY + 136);
      } else {
        this.graphics
          .fillStyle(0x293c33, 0.16)
          .fillEllipse(
            hazard.x,
            hazard.y + hazard.height / 2 + 5,
            hazard.width * 0.85,
            10,
          );
      }
    }
  }

  private drawPreview(x: number, y: number): void {
    this.graphics
      .fillStyle(0xffefc6, 0.96)
      .fillRoundedRect(x - 45, y - 23, 90, 46, 13);
    this.graphics
      .lineStyle(2, 0xa57938)
      .strokeRoundedRect(x - 45, y - 23, 90, 46, 13);
    this.graphics
      .lineStyle(3, 0x88652e)
      .beginPath()
      .moveTo(x - 9, y + 3)
      .lineTo(x, y - 7)
      .lineTo(x + 9, y + 3)
      .strokePath();
    this.graphics.lineStyle(2, 0xa57938, 0.5).lineBetween(x, y + 30, x, y + 65);
  }

  clear(): void {
    this.images.forEach((image) => image.destroy());
    this.images.clear();
    this.graphics.clear();
  }
}
