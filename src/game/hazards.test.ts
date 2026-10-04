import { describe, expect, it } from "vitest";
import { FLIGHT } from "./flight";
import {
  BIRD_BOX,
  HAZARD_MIN_LEAD,
  HAZARD_REACTION_SECONDS,
  HAZARD_ROW_SPACING,
  HazardField,
  overlaps,
} from "./hazards";

describe("hazards", () => {
  it("replays seeded rows and never retains more than one obstacle", () => {
    const a = new HazardField(42);
    const b = new HazardField(42);
    a.advance(0);
    b.advance(0);
    expect(a.items).toEqual(b.items);
    for (const y of new Set(a.items.map((h) => h.y))) {
      expect(a.items.filter((h) => h.y === y).length).toBeLessThan(3);
    }
    for (let camera = 0; camera > -50000; camera -= 100) {
      a.advance(camera);
      expect(a.items.length).toBeLessThanOrEqual(1);
    }
  });

  it("spaces obstacles beyond one screen and handles camera jumps without a backlog", () => {
    const field = new HazardField(42);
    field.advance(0);
    expect(field.items[0].y).toBeLessThan(360 - HAZARD_MIN_LEAD);
    const rows = new Map<number, number>();
    for (let camera = 0; camera > -10000; camera -= 50) {
      field.advance(camera);
      expect(field.items.length).toBeLessThanOrEqual(1);
      for (const h of field.items) {
        rows.set(h.id, h.y);
      }
    }
    const positions = [...rows.values()];
    expect(positions.length).toBeGreaterThan(2);
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i - 1] - positions[i]).toBeGreaterThanOrEqual(
        HAZARD_ROW_SPACING,
      );
    }
    expect(HAZARD_ROW_SPACING).toBeGreaterThan(720 + 62);
    field.advance(-50000);
    expect(field.items).toHaveLength(1);
    expect(field.items[0].y).toBeLessThan(-50000 + 360 - HAZARD_MIN_LEAD);
  });

  it("keeps a visible obstacle during a cat and spawns no new one until it ends", () => {
    const field = new HazardField();
    field.advance(0, { birdY: 550 });
    const first = field.items[0];
    const firstId = first.id;
    field.advance(-600, { birdY: -240, suppressObstacles: true });
    // The existing obstacle never vanishes because a cat appeared.
    expect(field.items).toEqual([first]);
    // Once it scrolls away, nothing replaces it while the cat holds the map.
    const pastIt = first.y - first.height / 2 - FLIGHT.height;
    field.advance(pastIt, { birdY: pastIt + 360, suppressObstacles: true });
    expect(field.items).toHaveLength(0);
    field.advance(pastIt, { birdY: pastIt + 360 });
    // A fresh distant row can resume; consumed rows cannot return.
    expect(field.items).toHaveLength(1);
    expect(field.items[0].id).toBeGreaterThan(firstId);
    expect(
      pastIt +
        360 -
        BIRD_BOX.height / 2 -
        (field.items[0].y + field.items[0].height / 2),
    ).toBeGreaterThanOrEqual(HAZARD_MIN_LEAD);
    field.advance(-10000, { birdY: -9640 });
    expect(field.items).toHaveLength(1);
    expect(field.items[0].id).toBeGreaterThan(firstId);
    const h = field.items[0];
    expect(
      -9640 - BIRD_BOX.height / 2 - (h.y + h.height / 2),
    ).toBeGreaterThanOrEqual(HAZARD_MIN_LEAD);
  });

  it.each(["kitchen", "dessert"] as const)(
    "gives every new %s obstacle at least 2.5 seconds of lead at maximum climb speed",
    (levelId) => {
      const field = new HazardField();
      let previousId = -1;
      let spawned = 0;
      for (let frame = 0; frame < 1800; frame++) {
        const birdY = FLIGHT.startY - (frame * FLIGHT.maxRise) / 60;
        const camera = Math.min(0, birdY - 360);
        field.advance(camera, { birdY, levelId });
        const h = field.items[0];
        if (h && h.id !== previousId) {
          const gap = birdY - BIRD_BOX.height / 2 - (h.y + h.height / 2);
          expect(gap / FLIGHT.maxRise).toBeGreaterThanOrEqual(
            HAZARD_REACTION_SECONDS,
          );
          expect(
            field.check({ x: h.x, y: birdY, ...BIRD_BOX }).hit,
          ).toBeUndefined();
          previousId = h.id;
          spawned++;
        }
      }
      expect(spawned).toBeGreaterThan(5);
    },
  );

  it("forgives sprite edges and emits a near miss only once per hazard", () => {
    const a = { x: 0, y: 0, width: 100, height: 100 };
    expect(overlaps(a, { ...a, x: 85 })).toBe(false);
    expect(overlaps(a, { ...a, x: 75 })).toBe(true);
    const field = new HazardField();
    field.items = [
      {
        id: 0,
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        kind: "pot",
        passed: false,
      },
    ];
    expect(field.check({ ...a, x: 90, y: -85 }).misses).toHaveLength(1);
    expect(field.check({ ...a, x: 90, y: -90 }).misses).toHaveLength(0);
  });
});
