import { describe, expect, it } from 'vitest';
import { EnemyField, WARNING_SECONDS } from './enemies';
import { getDifficulty, setDifficulty, type Difficulty } from './difficulty';

describe('enemy behaviour', () => {
  it.each(['static', 'sweeper', 'diver'] as const)('telegraphs %s without motion or collision for at least half a second', kind => {
    const field = new EnemyField();
    const d: Difficulty = { enemyEveryMetres: 20, enemySpeed: 1, enemyMix: { static: 0, sweeper: 0, diver: 0 } };
    d.enemyMix[kind] = 1;
    field.tick(20, 0, 0, d);
    const enemy = field.items[0];
    expect(enemy.kind).toBe(kind);
    const x = enemy.x; const y = enemy.y;
    field.tick(20, 0, 0.5, d);
    expect(enemy.x).toBe(x); expect(enemy.y).toBe(y);
    expect(field.check({ ...enemy }).hit).toBeUndefined();
    field.tick(20, 0, WARNING_SECONDS, d);
    expect(enemy.y).toBeGreaterThan(y);
    expect(field.check({ ...enemy }).hit).toBe(enemy);
    if (kind === 'sweeper') expect(enemy.x).not.toBe(x);
  });

  it('keeps adaptive parameters bounded and rejects invalid weight sets', () => {
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
