import { describe, expect, it } from 'vitest';
import { getDifficulty, getEncounterPacing } from './difficulty';

describe('altitude difficulty', () => {
  it('gradually increases encounter frequency across four map circuits, then caps it', () => {
    const base = getDifficulty();
    expect(getEncounterPacing(0, base)).toEqual({ everyMetres: 24, cooldownSeconds: 6 });
    expect(getEncounterPacing(150, base)).toEqual({ everyMetres: 21, cooldownSeconds: 5.5 });
    expect(getEncounterPacing(300, base)).toEqual({ everyMetres: 18, cooldownSeconds: 5 });
    expect(getEncounterPacing(600, base)).toEqual({ everyMetres: 12, cooldownSeconds: 4 });
    expect(getEncounterPacing(100000, base)).toEqual(getEncounterPacing(600, base));
    expect(getEncounterPacing(-1, base)).toEqual(getEncounterPacing(0, base));
  });

  it('combines producer tuning with altitude without mutating the input settings', () => {
    const base = { enemyEveryMetres: 80, enemySpeed: 1, enemyMix: { static: 1, sweeper: 0, diver: 0 } };
    expect(getEncounterPacing(600, base).everyMetres).toBe(40);
    expect(base.enemyEveryMetres).toBe(80);
  });
});
