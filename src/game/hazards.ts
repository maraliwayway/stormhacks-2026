import { FLIGHT } from './flight';

export interface Box { x: number; y: number; width: number; height: number }
export interface Hazard extends Box { id: number; kind: 'pot' | 'knife' | 'pin'; passed: boolean }
export const BIRD_BOX = { width: 96, height: 72 };

/** Visual boxes shrink to 80% on each axis. Never scale collisions with bird VFX. */
export function overlaps(a: Box, b: Box, scale = 0.8): boolean {
  return Math.abs(a.x - b.x) < (a.width + b.width) * scale / 2
    && Math.abs(a.y - b.y) < (a.height + b.height) * scale / 2;
}

export function seededRandom(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const PATTERNS = [[0], [2], [0, 2], [1]];
const KINDS = ['pot', 'knife', 'pin'] as const;

export class HazardField {
  items: Hazard[] = [];
  private random: () => number;
  private nextY = 140;
  private id = 0;

  constructor(seed = 2026) { this.random = seededRandom(seed); }

  advance(cameraY: number): void {
    while (this.nextY > cameraY - 500) {
      const pattern = PATTERNS[Math.floor(this.random() * PATTERNS.length)];
      for (const lane of pattern) {
        const kind = KINDS[Math.floor(this.random() * KINDS.length)];
        this.items.push({
          id: this.id++, kind, x: FLIGHT.lanes[lane], y: this.nextY,
          width: kind === 'pin' ? 150 : 96, height: kind === 'knife' ? 36 : 62,
          passed: false,
        });
      }
      this.nextY -= 280;
    }
    this.items = this.items.filter(item => item.y < cameraY + FLIGHT.height + 180);
  }

  check(bird: Box): { hit: Hazard | undefined; misses: Hazard[] } {
    const hit = this.items.find(h => overlaps(bird, h));
    const misses: Hazard[] = [];
    for (const hazard of this.items) {
      if (!hazard.passed && bird.y < hazard.y - (hazard.height + bird.height) * 0.4) {
        hazard.passed = true;
        const clearance = Math.abs(bird.x - hazard.x) - (bird.width + hazard.width) * 0.4;
        if (clearance >= 0 && clearance < 45) misses.push(hazard);
      }
    }
    return { hit, misses };
  }
}
