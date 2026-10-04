import type Phaser from "phaser";
import { FLIGHT_FRAMES } from "./assets";

/** All frames share an anchor at the body, so a wing stroke never moves the hitbox. */
export function ensureBirdAnimation(scene: Phaser.Scene): void {
  if (!scene.anims.exists("pigeon-flap")) {
    scene.anims.create({
      key: "pigeon-flap",
      frames: FLIGHT_FRAMES.map((frame) => ({ key: `pigeon-flight-${frame}` })),
      frameRate: 20,
      repeat: 0,
    });
  }
}
