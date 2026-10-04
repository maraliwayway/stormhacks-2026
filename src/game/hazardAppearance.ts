import type { Level } from "./levels";

interface HazardAppearance {
  texture: string;
  width: number;
  height: number;
}

/** Sizes follow the trimmed illustrations. Collision and visible art share one box. */
export const HAZARD_ART = {
  kitchen: {
    pot: [
      { texture: "kitchen-pot-gold", width: 96, height: 81 },
      { texture: "kitchen-pot-red", width: 96, height: 84 },
      { texture: "kitchen-pot-brown", width: 96, height: 84 },
    ],
    knife: [
      { texture: "kitchen-knives", width: 104, height: 95 },
      { texture: "kitchen-board", width: 96, height: 108 },
    ],
    pin: [
      { texture: "kitchen-spatula", width: 146, height: 54 },
      { texture: "kitchen-pan-light", width: 67, height: 120 },
      { texture: "kitchen-pan-dark", width: 60, height: 120 },
    ],
  },
  dessert: {
    pot: [
      { texture: "dessert-rock-large", width: 96, height: 89 },
      { texture: "dessert-rock-left", width: 96, height: 96 },
      { texture: "dessert-rock-right", width: 96, height: 90 },
    ],
    knife: [
      { texture: "dessert-cactus-light", width: 72, height: 129 },
      { texture: "dessert-cactus-dark", width: 72, height: 129 },
    ],
    pin: [
      { texture: "dessert-rock-left", width: 106, height: 106 },
      { texture: "dessert-rock-right", width: 106, height: 100 },
    ],
  },
  // Drawn at boot by rendering/heavenArt.ts; there is no source file for these.
  heaven: {
    pot: [{ texture: "heaven-cloud-wide", width: 150, height: 78 }],
    knife: [{ texture: "heaven-cloud-bolt", width: 110, height: 118 }],
    pin: [{ texture: "heaven-cloud-small", width: 104, height: 70 }],
  },
} as const;

/** Heaven art is generated in code, so the loader must skip it. */
export const GENERATED_HAZARD_LEVELS: ReadonlySet<string> = new Set(["heaven"]);

export const MAX_HAZARD_HEIGHT = 129;

export function hazardAppearance(
  id: number,
  kind: "pot" | "knife" | "pin",
  levelId: Level["id"],
): HazardAppearance {
  const variants = HAZARD_ART[levelId][kind];
  return variants[id % variants.length];
}
