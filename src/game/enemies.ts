import { getDifficulty, getEncounterPacing } from './difficulty';
import { FLIGHT } from './flight';
import type { Box } from './hazards';

export const WARNING_SECONDS = 1;
export const STRIKE_SECONDS = 0.35;
export const RETREAT_SECONDS = 0.3;
export { ENCOUNTER_COOLDOWN_SECONDS } from './difficulty';

export interface Enemy extends Box {
  kind: 'cat-paw'; age: number; lane: number; faceOffset: number;
  strikeChecked: boolean; crossedStrike: boolean;
}

/** A cat locks the bird's current lane once; it never chases a dodge. */
export class EnemyField {
  items: Enemy[] = [];
  private nextAltitude = 20;
  private cooldown = 0;

  tick(altitude: number, cameraY: number, dt: number, difficulty = getDifficulty(), bird?: Box): void {
    this.cooldown = Math.max(0, this.cooldown - dt);
    for (const enemy of this.items) {
      const previousAge = enemy.age;
      enemy.age += dt;
      enemy.crossedStrike ||= previousAge < WARNING_SECONDS && enemy.age >= WARNING_SECONDS;
      enemy.y = cameraY + FLIGHT.height / 2;
    }
    // Keep a crossed strike until check() observes it, even on a delayed frame.
    this.items = this.items.filter(e => e.crossedStrike || e.age < WARNING_SECONDS + STRIKE_SECONDS + RETREAT_SECONDS);
    if (altitude < this.nextAltitude || this.items.length || this.cooldown > 0 || !bird) return;
    const lane = FLIGHT.lanes.reduce((best, x, index) =>
      Math.abs(x - bird.x) < Math.abs(FLIGHT.lanes[best] - bird.x) ? index : best, 0);
    this.items.push({ kind: 'cat-paw', lane, x: FLIGHT.lanes[lane], y: cameraY + FLIGHT.height / 2,
      width: 220, height: FLIGHT.height, faceOffset: Math.max(180, Math.min(440, bird.y - cameraY - 130)),
      age: 0, strikeChecked: false, crossedStrike: false });
    const pacing = getEncounterPacing(altitude, difficulty);
    this.nextAltitude = altitude + pacing.everyMetres;
    this.cooldown = pacing.cooldownSeconds;
  }

  check(bird: Box): { hit: Enemy | undefined; misses: Enemy[] } {
    let hit: Enemy | undefined;
    const misses: Enemy[] = [];
    for (const enemy of this.items) {
      const striking = enemy.crossedStrike ||
        (enemy.age >= WARNING_SECONDS && enemy.age < WARNING_SECONDS + STRIKE_SECONDS);
      if (!striking) continue;
      // The strike fills the warned lane: climbing cannot bypass the paw.
      const inLane = Math.abs(bird.x - enemy.x) < (bird.width + enemy.width) * 0.4;
      if (inLane) hit ??= enemy;
      else if (!enemy.strikeChecked) misses.push(enemy);
      enemy.strikeChecked = true;
      enemy.crossedStrike = false;
    }
    return { hit, misses };
  }
}
