import type Phaser from "phaser";

export function ensureBirdTexture(scene: Phaser.Scene): void {
  if (!scene.textures.exists("bird")) {
    const graphics = scene.make.graphics({ x: 0, y: 0 });
    graphics.fillStyle(0x143d48).fillEllipse(48, 39, 82, 62);
    graphics.fillStyle(0x69c8c1).fillEllipse(46, 34, 74, 55);
    graphics.fillStyle(0xfff2d6).fillEllipse(53, 42, 44, 36);
    graphics.fillStyle(0xeeb856).fillTriangle(78, 26, 96, 36, 78, 45);
    graphics.fillStyle(0x153d46).fillCircle(66, 25, 5);
    graphics.fillStyle(0x3a9299).fillEllipse(29, 37, 34, 20);
    graphics.generateTexture("bird", 96, 72);
    graphics.destroy();
  }
}
