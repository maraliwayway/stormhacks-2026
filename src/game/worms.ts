import { type Box, type Hazard, overlaps } from "./hazards";
import { CounterStore } from "./storage";

export interface Worm extends Box {
  id: number;
}
export const wormBalance = new CounterStore("flappy-arms.worms");

export class WormField {
  items: Worm[] = [];
  private lastId = -1;

  advance(hazards: readonly Hazard[], cameraY: number): void {
    for (const hazard of hazards) {
      if (hazard.id <= this.lastId) {
        continue;
      }
      this.lastId = hazard.id;
      let direction = hazard.id % 2 ? -1 : 1;
      if (hazard.x > 640) {
        direction = -1;
      } else if (hazard.x < 640) {
        direction = 1;
      }
      this.items.push({
        id: hazard.id,
        x: hazard.x + direction * (hazard.width / 2 + 65),
        y: hazard.y + 90,
        width: 42,
        height: 30,
      });
    }
    this.items = this.items.filter((worm) => worm.y < cameraY + 900);
  }

  collect(bird: Box): Worm[] {
    const collected = this.items.filter((worm) => overlaps(bird, worm, 1));
    const ids = new Set(collected.map((worm) => worm.id));
    this.items = this.items.filter((worm) => !ids.has(worm.id));
    return collected;
  }
}
