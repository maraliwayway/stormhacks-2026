import { describe, expect, it } from 'vitest';
import { HazardField, HAZARD_ROW_SPACING, overlaps } from './hazards';

describe('hazards', () => {
  it('replays seeded rows, keeps a safe lane and bounds generated objects', () => {
    const a = new HazardField(42);
    const b = new HazardField(42);
    a.advance(0); b.advance(0);
    expect(a.items).toEqual(b.items);
    for (const y of new Set(a.items.map(h => h.y))) {
      expect(a.items.filter(h => h.y === y).length).toBeLessThan(3);
    }
    for (let camera = 0; camera > -50000; camera -= 100) a.advance(camera);
    expect(a.items.length).toBeLessThan(15);
  });

  it('gives two safe lanes, more than double row spacing and a gentle opening', () => {
    const field = new HazardField(42);
    field.advance(0);
    expect(field.items.every(h => h.y <= -100)).toBe(true);
    field.advance(-5000);
    const rows = field.items.map(h => h.y).sort((a, b) => b - a);
    expect(new Set(rows).size).toBe(rows.length);
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1] - rows[i]).toBe(HAZARD_ROW_SPACING);
    expect(HAZARD_ROW_SPACING).toBeGreaterThan(2 * 280);
  });

  it('reserves a clear corridor for a cat beat without respawning removed rows', () => {
    const field = new HazardField();
    field.advance(-600, -240);
    expect(field.items.every(h => h.y < -940 || h.y > 0)).toBe(true);
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
