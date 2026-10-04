import { CounterStore } from './storage';
import { overlaps, type Box, type Hazard } from './hazards';

export interface Worm extends Box { id: number }
export const wormBalance = new CounterStore('flappy-arms.worms');

export class WormField {
  items: Worm[] = [];
  private lastId = -1;

  advance(hazards: readonly Hazard[], cameraY: number): void {
    for (const hazard of hazards) {
      if (hazard.id <= this.lastId) continue;
      this.lastId = hazard.id;
      const direction = hazard.x > 640 ? -1 : hazard.x < 640 ? 1 : hazard.id % 2 ? -1 : 1;
      this.items.push({ id: hazard.id,
        x: hazard.x + direction * (hazard.width / 2 + 65), y: hazard.y + 90,
        width: 42, height: 30,
      });
    }
    this.items = this.items.filter(w => w.y < cameraY + 900);
  }

  collect(bird: Box): Worm[] {
    const collected = this.items.filter(w => overlaps(bird, w, 1));
    const ids = new Set(collected.map(w => w.id));
    this.items = this.items.filter(w => !ids.has(w.id));
    return collected;
  }
}
