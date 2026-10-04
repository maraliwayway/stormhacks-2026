import { describe, expect, it } from "vitest";
import { getDifficulty, setDifficulty } from "./difficulty";
import {
  EnemyField,
  FIRST_CAT_GRACE_SECONDS,
  STRIKE_SECONDS,
  WARNING_SECONDS,
} from "./enemies";
import { FLIGHT } from "./flight";
import { BIRD_BOX, HazardField } from "./hazards";

const bird = { x: 640, y: 360, ...BIRD_BOX };
const readyField = () => {
  const field = new EnemyField();
  field.advanceGrace(FIRST_CAT_GRACE_SECONDS, 1);
  return field;
};

describe("cat ambush", () => {
  it("never spawns a new obstacle while a cat is out, and never deletes one", () => {
    const enemies = readyField();
    const hazards = new HazardField();
    let previousIds: number[] = [];
    for (let frame = 0; frame < 600; frame++) {
      const altitude = frame * 0.05 * 25;
      const camera = FLIGHT.startY - altitude * FLIGHT.pixelsPerMetre - 360;
      const currentBird = { ...bird, y: camera + 360 };
      enemies.tick(altitude, camera, 0.05, undefined, currentBird);
      hazards.advance(camera, {
        birdY: currentBird.y,
        suppressObstacles: enemies.items.length > 0,
      });
      const ids = hazards.items.map((hazard) => hazard.id);
      if (enemies.items.length > 0) {
        expect(ids.every((id) => previousIds.includes(id))).toBe(true);
      }
      previousIds = ids;
      enemies.check({ ...currentBird, x: 340 });
    }
  });
  it("waits five active seconds after the first flap, even at high altitude, and resets on retry", () => {
    for (let run = 0; run < 2; run++) {
      const field = new EnemyField();
      field.advanceGrace(10, 0);
      field.tick(1000, 0, 10, undefined, bird);
      expect(field.items).toHaveLength(0);
      field.advanceGrace(FIRST_CAT_GRACE_SECONDS - 0.01, 1);
      field.tick(1000, 0, 0, undefined, bird);
      expect(field.items).toHaveLength(0);
      field.advanceGrace(0.02, 0);
      field.tick(1000, 0, 0, undefined, bird);
      expect(field.items).toHaveLength(1);
      expect(field.items[0].age).toBe(0);
      expect(field.check(bird).hit).toBeUndefined();
    }
  });
  it("spawns more cats at higher altitudes while retaining the full warning and one cat at a time", () => {
    const countEncounters = (startAltitude: number) => {
      const field = readyField();
      let encounters = 0;
      for (let frame = 0; frame <= 480; frame++) {
        const altitude = startAltitude + frame * 0.05 * 25;
        field.tick(altitude, 0, frame === 0 ? 0 : 0.05, undefined, bird);
        expect(field.items.length).toBeLessThanOrEqual(1);
        const cat = field.items[0];
        if (cat?.age === 0) {
          encounters++;
        }
        if (cat && cat.age < WARNING_SECONDS) {
          expect(field.check(bird).hit).toBeUndefined();
        }
        field.check({ ...bird, x: 340 });
      }
      return encounters;
    };
    expect(countEncounters(1000)).toBeGreaterThan(countEncounters(20));
  });

  it("gives 2.5 seconds to dodge, then strikes the same lane even if the bird climbs", () => {
    const field = readyField();
    field.tick(20, 0, 0, undefined, bird);
    const cat = field.items[0];
    field.tick(20, -400, WARNING_SECONDS - 0.001, undefined, {
      ...bird,
      x: 340,
    });
    expect(cat.x).toBe(640);
    expect(field.check(bird).hit).toBeUndefined();
    field.tick(20, -400, 0.001);
    expect(field.check({ ...bird, y: -2000 }).hit).toBe(cat);
    expect(field.check({ ...bird, x: 340 }).hit).toBeUndefined();
  });

  it("rewards leaving the locked lane once and retires the paw without a second attack", () => {
    const field = readyField();
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

  it("does not skip a strike on a delayed frame", () => {
    const field = readyField();
    field.tick(20, 0, 0, undefined, bird);
    field.tick(20, 0, WARNING_SECONDS + STRIKE_SECONDS + 1);
    expect(field.check(bird).hit?.kind).toBe("cat-paw");
  });

  it("keeps the existing adaptive input contract bounded", () => {
    const original = getDifficulty();
    setDifficulty({
      enemyEveryMetres: 1,
      enemySpeed: 100,
      enemyMix: { static: 1, sweeper: 0, diver: 0 },
    });
    expect(getDifficulty().enemyEveryMetres).toBe(12);
    expect(getDifficulty().enemySpeed).toBe(2);
    const good = getDifficulty();
    setDifficulty({ ...good, enemyMix: { static: 0, sweeper: 0, diver: 0 } });
    expect(getDifficulty()).toEqual(good);
    setDifficulty(original);
  });
});
