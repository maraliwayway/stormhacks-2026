// Owner: Dev 2. Loads assets. Until PM art lands, generates placeholder textures
// so everyone can build against real texture keys today.

import Phaser from "phaser";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  preload(): void {
    // TODO(Dev 2): load real art from /assets/sprites and /assets/backgrounds when ready, e.g.
    // this.load.spritesheet("bird", "assets/sprites/bird.png", { frameWidth: 96, frameHeight: 96 });
  }

  create(): void {
    this.placeholder("bird", 64, 64, 0xffc107);
    for (const key of ["pot", "knife", "rolling_pin", "cupcake", "candy", "sprinkle_bomb"]) {
      this.placeholder(key, 120, 40, 0x5d4037);
    }
    this.placeholder("worm", 24, 24, 0xe91e63);
    this.scene.start("Menu");
  }

  private placeholder(key: string, w: number, h: number, color: number): void {
    if (this.textures.exists(key)) return;
    const g = this.add.graphics();
    g.fillStyle(color, 1).fillRoundedRect(0, 0, w, h, 8);
    g.generateTexture(key, w, h);
    g.destroy();
  }
}
