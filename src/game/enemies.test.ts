import { describe, expect, it } from 'vitest';
import { EnemyField, WARNING_SECONDS, STRIKE_SECONDS } from './enemies';
import { BIRD_BOX } from './hazards';
import { getDifficulty, setDifficulty } from './difficulty';

const bird = { x: 640, y: 360, ...BIRD_BOX };
describe('cat ambush', () => {
  it('warns for a full second, then strikes the same lane even if the bird climbs', () => {
    const field = new EnemyField();
    field.tick(20, 0, 0, undefined, bird);
    const cat = field.items[0];
    field.tick(20, -400, WARNING_SECONDS - 0.001, undefined, { ...bird, x: 340 });
    expect(cat.x).toBe(640);
    expect(field.check(bird).hit).toBeUndefined();
    field.tick(20, -400, 0.001);
    expect(field.check({ ...bird, y: -2000 }).hit).toBe(cat);
    expect(field.check({ ...bird, x: 340 }).hit).toBeUndefined();
  });

  it('rewards leaving the locked lane once and retires the paw without a second attack', () => {
    const field = new EnemyField();
    field.tick(20, 0, 0, undefined, bird);
    field.tick(20, 0, WARNING_SECONDS);
    expect(field.check({ ...bird, x: 940 }).misses).toHaveLength(1);
    expect(field.check({ ...bird, x: 940 }).misses).toHaveLength(0);
    field.tick(20, 0, STRIKE_SECONDS + 0.01);
    expect(field.check(bird).hit).toBeUndefined();
    field.tick(100, 0, 0.4, undefined, bird);
    expect(field.items).toHaveLength(0);
    field.tick(100, 0, 6, undefined, bird);
    expect(field.items).toHaveLength(1);
    expect(field.items[0].age).toBe(0);
  });

  it('does not skip a strike on a delayed frame', () => {
    const field = new EnemyField();
    field.tick(20, 0, 0, undefined, bird);
    field.tick(20, 0, 2);
    expect(field.check(bird).hit?.kind).toBe('cat-paw');
  });

  it('keeps the existing adaptive input contract bounded', () => {
    const original = getDifficulty();
    setDifficulty({ enemyEveryMetres: 1, enemySpeed: 100, enemyMix: { static: 1, sweeper: 0, diver: 0 } });
    expect(getDifficulty().enemyEveryMetres).toBe(12);
    expect(getDifficulty().enemySpeed).toBe(2);
    const good = getDifficulty();
    setDifficulty({ ...good, enemyMix: { static: 0, sweeper: 0, diver: 0 } });
    expect(getDifficulty()).toEqual(good);
    setDifficulty(original);
  });
});
