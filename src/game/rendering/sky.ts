import type Phaser from "phaser";

export const SKY = 0xcfe8f4;
const CLOUD_KEY = "sky-cloud";
const CLOUD_WIDTH = 240;
const CLOUD_HEIGHT = 96;
const RES = 2;

/** One flat cloud shape, drawn on a canvas so its edges are smooth. */
export function ensureCloudArt(scene: Phaser.Scene): string {
  if (!scene.textures.exists(CLOUD_KEY)) {
    const texture = scene.textures.createCanvas(
      CLOUD_KEY,
      CLOUD_WIDTH * RES,
      CLOUD_HEIGHT * RES,
    )!;
    const context = texture.getContext();
    context.scale(RES, RES);
    context.fillStyle = "#ffffff";
    context.beginPath();
    context.arc(70, 62, 34, 0, Math.PI * 2);
    context.arc(118, 46, 44, 0, Math.PI * 2);
    context.arc(170, 60, 34, 0, Math.PI * 2);
    context.roundRect(36, 58, 168, 36, 18);
    context.fill();
    texture.refresh();
  }
  return CLOUD_KEY;
}

/** Two big, faint pigeons behind the clouds give the title sky some character. */
export function addBackdropPigeons(scene: Phaser.Scene): void {
  if (scene.textures.exists("pigeon-rest")) {
    scene.add
      .image(-40, 760, "pigeon-rest")
      .setOrigin(0, 1)
      .setDisplaySize(560, 547)
      .setFlipX(true)
      .setAlpha(0.22)
      .setDepth(-18);
  }
  if (scene.textures.exists("pigeon-hero")) {
    scene.add
      .image(1330, 790, "pigeon-hero")
      .setOrigin(1, 1)
      .setDisplaySize(590, 699)
      .setAlpha(0.22)
      .setDepth(-18);
  }
}

interface Cloud {
  image: Phaser.GameObjects.Image;
  speed: number;
}

/** A handful of clouds drifting sideways across a flat sky. */
export class DriftingClouds {
  private clouds: Cloud[];

  constructor(scene: Phaser.Scene) {
    const key = ensureCloudArt(scene);
    const layout = [
      [180, 150, 0.9, 14],
      [760, 90, 0.7, 10],
      [1120, 260, 1.1, 18],
      [420, 420, 0.8, 12],
      [980, 560, 1, 16],
      [90, 610, 0.75, 11],
    ] as const;
    this.clouds = layout.map(([x, y, scale, speed]) => ({
      image: scene.add
        .image(x, y, key)
        .setDisplaySize(CLOUD_WIDTH * scale, CLOUD_HEIGHT * scale)
        .setAlpha(scale < 0.85 ? 0.7 : 1)
        .setDepth(-15),
      speed,
    }));
  }

  update(deltaMs: number): void {
    for (const { image, speed } of this.clouds) {
      image.x -= (speed * deltaMs) / 1000;
      if (image.x < -image.displayWidth / 2) {
        image.x = 1280 + image.displayWidth / 2;
      }
    }
  }
}
