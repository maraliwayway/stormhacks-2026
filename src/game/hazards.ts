import { FLIGHT } from "./flight";
import { MAX_HAZARD_HEIGHT, hazardAppearance } from "./hazardAppearance";
import type { Level } from "./levels";

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface Hazard extends Box {
  id: number;
  kind: "pot" | "knife" | "pin";
  art?: string;
  passed: boolean;
}
export const COLLISION_SCALE = 0.8;
export const BIRD_BOX = { width: 96, height: 72 };

/** Visual boxes shrink to 80% on each axis. Never scale collisions with bird VFX. */
export function overlaps(a: Box, b: Box, scale = COLLISION_SCALE): boolean {
  return (
    Math.abs(a.x - b.x) < ((a.width + b.width) * scale) / 2 &&
    Math.abs(a.y - b.y) < ((a.height + b.height) * scale) / 2
  );
}

/** Mulberry32: repeatable unsigned 32-bit mixing; arithmetic order is intentional. */
export function seededRandom(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let mixed = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

const LANE_ORDER = [0, 2, 1];
const NEAR_MISS_DISTANCE = 45;
export const HAZARD_ROW_SPACING = 900;
export const HAZARD_REACTION_SECONDS = 2.5;
export const HAZARD_MIN_LEAD = FLIGHT.maxRise * HAZARD_REACTION_SECONDS;
const KINDS = ["pot", "knife", "pin"] as const;

export interface HazardAdvanceOptions {
  /** The authored artwork determines the matching visible and collision dimensions. */
  levelId?: Level["id"];
  /** Bird centre in world pixels; defaults to the middle of the viewport. */
  birdY?: number;
  /** Consume rows without spawning while a cat or Heaven reserves the map. */
  suppressObstacles?: boolean;
}

export class HazardField {
  items: Hazard[] = [];
  private random: () => number;
  private nextRowY = -100;
  private nextId = 0;

  constructor(seed = 2026) {
    this.random = seededRandom(seed);
  }

  advance(cameraY: number, options: HazardAdvanceOptions = {}): void {
    const {
      birdY = cameraY + FLIGHT.height / 2,
      suppressObstacles = false,
      levelId = "kitchen",
    } = options;
    if (suppressObstacles) {
      this.items = [];
    } else {
      this.items = this.items
        .filter(
          (hazard) => hazard.y - hazard.height / 2 < cameraY + FLIGHT.height,
        )
        .slice(0, 1);
    }

    // Look past the reaction gap to find a safe row even after a camera jump.
    const highestSafeEdge = birdY - BIRD_BOX.height / 2 - HAZARD_MIN_LEAD;
    const horizon =
      highestSafeEdge - HAZARD_ROW_SPACING - MAX_HAZARD_HEIGHT / 2;
    while (
      this.nextRowY > horizon ||
      (!suppressObstacles && this.items.length === 0)
    ) {
      const hazard = this.createNextHazard(levelId);
      const hasSafeLead = hazard.y + hazard.height / 2 <= highestSafeEdge;
      if (!suppressObstacles && this.items.length === 0 && hasSafeLead) {
        this.items.push(hazard);
      }
      // Skipped rows still consume their seed and ID; they never reappear later.
      this.nextRowY -= HAZARD_ROW_SPACING;
    }
  }

  private createNextHazard(levelId: Level["id"]): Hazard {
    const lane = LANE_ORDER[Math.floor(this.random() * LANE_ORDER.length)];
    const kind = KINDS[Math.floor(this.random() * KINDS.length)];
    const appearance = hazardAppearance(this.nextId, kind, levelId);
    return {
      id: this.nextId++,
      kind,
      x: FLIGHT.lanes[lane],
      y: this.nextRowY,
      art: appearance.texture,
      width: appearance.width,
      height: appearance.height,
      passed: false,
    };
  }

  check(bird: Box): { hit: Hazard | undefined; misses: Hazard[] } {
    const hit = this.items.find((hazard) => overlaps(bird, hazard));
    const misses: Hazard[] = [];
    for (const hazard of this.items) {
      if (
        !hazard.passed &&
        bird.y <
          hazard.y - (hazard.height + bird.height) * (COLLISION_SCALE / 2)
      ) {
        hazard.passed = true;
        const clearance =
          Math.abs(bird.x - hazard.x) -
          (bird.width + hazard.width) * (COLLISION_SCALE / 2);
        if (clearance >= 0 && clearance < NEAR_MISS_DISTANCE) {
          misses.push(hazard);
        }
      }
    }
    return { hit, misses };
  }
}
