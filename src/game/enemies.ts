import { getDifficulty, type Difficulty } from './difficulty';
import { FLIGHT } from './flight';
import { seededRandom, overlaps, type Box } from './hazards';

export type EnemyKind = keyof Difficulty['enemyMix'];
export interface Enemy extends Box {
  kind: EnemyKind; age: number; originX: number; passed: boolean;
}
export const WARNING_SECONDS = 0.65;

export class EnemyField {
  items: Enemy[] = [];
  private nextAltitude = 20;
  private random: () => number;

  constructor(seed = 2761) { this.random = seededRandom(seed); }

  tick(altitude: number, cameraY: number, dt: number, difficulty = getDifficulty()): void {
    if (altitude >= this.nextAltitude && this.items.length < 4) {
      this.nextAltitude = altitude + difficulty.enemyEveryMetres;
      const total = Object.values(difficulty.enemyMix).reduce((a, b) => a + b, 0);
      let roll = this.random() * total;
      let kind: EnemyKind = 'static';
      for (const candidate of ['static', 'sweeper', 'diver'] as const) {
        roll -= difficulty.enemyMix[candidate];
        if (roll < 0) { kind = candidate; break; }
      }
      const x = FLIGHT.lanes[Math.floor(this.random() * 3)];
      this.items.push({ kind, x, originX: x, y: cameraY + 40, width: 88, height: 64, age: 0, passed: false });
    }
    for (const enemy of this.items) {
      const previousAge = enemy.age;
      enemy.age += dt;
      const activeDt = Math.max(0, enemy.age - WARNING_SECONDS) - Math.max(0, previousAge - WARNING_SECONDS);
      if (activeDt === 0) continue;
      const age = enemy.age - WARNING_SECONDS;
      if (enemy.kind === 'sweeper') {
        const amplitude = Math.min(300, enemy.originX - 180, 1100 - enemy.originX);
        enemy.x = enemy.originX + Math.sin(age * 2.2 * difficulty.enemySpeed) * amplitude;
        enemy.y += 70 * activeDt * difficulty.enemySpeed;
      } else {
        enemy.y += (enemy.kind === 'diver' ? 380 : 110) * activeDt * difficulty.enemySpeed;
      }
    }
    this.items = this.items.filter(e => e.y > cameraY - 600 && e.y < cameraY + 880);
  }

  check(bird: Box): { hit: Enemy | undefined; misses: Enemy[] } {
    const active = this.items.filter(e => e.age >= WARNING_SECONDS);
    const hit = active.find(e => overlaps(bird, e));
    const misses: Enemy[] = [];
    for (const enemy of active) {
      if (!enemy.passed && bird.y < enemy.y - (enemy.height + bird.height) * 0.4) {
        enemy.passed = true;
        const clearance = Math.abs(bird.x - enemy.x) - (bird.width + enemy.width) * 0.4;
        if (clearance >= 0 && clearance < 45) misses.push(enemy);
      }
    }
    return { hit, misses };
  }
}
