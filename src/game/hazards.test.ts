import { describe, expect, it } from 'vitest';
import { FLIGHT } from './flight';
import { HazardField, HAZARD_ROW_SPACING, HAZARD_MIN_LEAD, HAZARD_REACTION_SECONDS, BIRD_BOX, overlaps } from './hazards';

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
    expect(field.items[0].y).toBeLessThan(360 - HAZARD_MIN_LEAD);
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
    expect(field.items[0].y).toBeLessThan(-50000 + 360 - HAZARD_MIN_LEAD);
  });

  it('clears every obstacle for a cat and resumes with a fresh safe lead distance', () => {
    const field = new HazardField();
    field.advance(0, undefined, 550);
    const firstId = field.items[0].id;
    field.advance(-600, -240, -240);
    expect(field.items).toHaveLength(0);
    field.advance(-600, undefined, -240);
    // A fresh distant row can resume; consumed rows cannot return.
    expect(field.items).toHaveLength(1);
    expect(field.items[0].id).toBeGreaterThan(firstId);
    expect(-240 - BIRD_BOX.height / 2 - (field.items[0].y + field.items[0].height / 2)).toBeGreaterThanOrEqual(HAZARD_MIN_LEAD);
    field.advance(-10000, undefined, -9640);
    expect(field.items).toHaveLength(1);
    expect(field.items[0].id).toBeGreaterThan(firstId);
    const h = field.items[0];
    expect(-9640 - BIRD_BOX.height / 2 - (h.y + h.height / 2)).toBeGreaterThanOrEqual(HAZARD_MIN_LEAD);
  });

  it('gives every new obstacle at least 2.5 seconds of lead at maximum climb speed', () => {
    const field = new HazardField();
    let previousId = -1;
    let spawned = 0;
    for (let frame = 0; frame < 1800; frame++) {
      const birdY = FLIGHT.startY - frame * FLIGHT.maxRise / 60;
      const camera = Math.min(0, birdY - 360);
      field.advance(camera, undefined, birdY);
      const h = field.items[0];
      if (h && h.id !== previousId) {
        const gap = birdY - BIRD_BOX.height / 2 - (h.y + h.height / 2);
        expect(gap / FLIGHT.maxRise).toBeGreaterThanOrEqual(HAZARD_REACTION_SECONDS);
        expect(field.check({ x: h.x, y: birdY, ...BIRD_BOX }).hit).toBeUndefined();
        previousId = h.id;
        spawned++;
      }
    }
    expect(spawned).toBeGreaterThan(5);
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
