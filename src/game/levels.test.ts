import { describe, it, expect } from 'vitest';
import { levelAt, LOOP_METRES } from './levels';

describe('endless level circuit', () => {
  it('plays Heaven for 30 metres before returning to Kitchen', () => {
    expect(levelAt(59.99).id).toBe('kitchen');
    expect(levelAt(60).id).toBe('dessert');
    expect(levelAt(119.99).id).toBe('dessert');
    expect(levelAt(120)).toMatchObject({ id: 'heaven', start: 120, end: 150 });
    expect(levelAt(149.99).id).toBe('heaven');
    expect(levelAt(150)).toMatchObject({ id: 'kitchen', start: 150, end: 210 });
  });

  it('repeats every boundary while retaining absolute altitude bounds', () => {
    for (const lap of [0, 1, 2, 100, 10000]) {
      const offset = lap * LOOP_METRES;
      expect(levelAt(offset)).toMatchObject({ id: 'kitchen', start: offset, end: offset + 60 });
      expect(levelAt(offset + 60)).toMatchObject({ id: 'dessert', start: offset + 60, end: offset + 120 });
      expect(levelAt(offset + 120)).toMatchObject({ id: 'heaven', start: offset + 120, end: offset + 150 });
      expect(levelAt(offset + 149.99).id).toBe('heaven');
    }
  });
});
