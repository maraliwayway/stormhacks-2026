import type Phaser from "phaser";
import { HAZARD_ART } from "../hazardAppearance";

export const ART_PATH = "assets/art/";
export const FLIGHT_FRAMES = [1, 2, 3, 4, 5, 3, 1];

/** Only the optimized copies enter the texture cache. Source PNGs stay editable. */
export function loadGameArt(scene: Phaser.Scene): void {
  const keys = new Set([
    "map-kitchen",
    "map-dessert",
    ...[1, 2, 3, 4, 5].map((frame) => `pigeon-flight-${frame}`),
    ...Object.values(HAZARD_ART).flatMap((level) =>
      Object.values(level)
        .flat()
        .map((art) => art.texture),
    ),
  ]);
  for (const key of keys) {
    if (!scene.textures.exists(key)) {
      scene.load.image(key, `${ART_PATH}${key}.webp`);
    }
  }
}
