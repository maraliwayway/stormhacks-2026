import { describe, expect, it } from 'vitest';
import { HazardField, HAZARD_ROW_SPACING, overlaps } from './hazards';

describe('hazards', () => {
  it('replays seeded rows and never retains more than one obstacle', () => {
    const a = new HazardField(42);
    const b = new HazardField(42);
    a.advance(0); b.advance(0);
    expect(a.items).toEqual(b.items);
    for (const y of new Set(a.items.map(h => h.y))) {
      expect(a.items.filter(h => h.y === y).length).toBeLessThan(3);
    }
    for (let camera = 0; camera > -50000; camera -= 100) {
      a.advance(camera);
      expect(a.items.length).toBeLessThanOrEqual(1);
    }
  });

  it('spaces obstacles beyond one screen and handles camera jumps without a backlog', () => {
    const field = new HazardField(42);
    field.advance(0);
    expect(field.items[0].y).toBe(-100);
    const rows = new Map<number, number>();
    for (let camera = 0; camera > -10000; camera -= 50) {
      field.advance(camera);
      expect(field.items.length).toBeLessThanOrEqual(1);
      for (const h of field.items) rows.set(h.id, h.y);
    }
    const positions = [...rows.values()];
    expect(positions.length).toBeGreaterThan(2);
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i - 1] - positions[i]).toBeGreaterThanOrEqual(HAZARD_ROW_SPACING);
    }
    expect(HAZARD_ROW_SPACING).toBeGreaterThan(720 + 62);
    field.advance(-50000);
    expect(field.items).toHaveLength(1);
    expect(field.items[0].y).toBeLessThan(-50000 + 720 + 31);
  });

  it('clears every obstacle for a cat beat without respawning skipped rows', () => {
    const field = new HazardField();
    field.advance(-600, -240);
    expect(field.items).toHaveLength(0);
    const reservedIds = new Set(field.items.map(h => h.id));
    field.advance(-600);
    expect(new Set(field.items.map(h => h.id))).toEqual(reservedIds);
    field.advance(-10000);
    expect(field.items.length).toBeGreaterThan(0);
  });

  it('forgives sprite edges and emits a near miss only once per hazard', () => {
    const a = { x: 0, y: 0, width: 100, height: 100 };
    expect(overlaps(a, { ...a, x: 85 })).toBe(false);
    expect(overlaps(a, { ...a, x: 75 })).toBe(true);
    const field = new HazardField();
    field.items = [{ id: 0, x: 0, y: 0, width: 100, height: 100, kind: 'pot', passed: false }];
    expect(field.check({ ...a, x: 90, y: -85 }).misses).toHaveLength(1);
    expect(field.check({ ...a, x: 90, y: -90 }).misses).toHaveLength(0);
  });
});
