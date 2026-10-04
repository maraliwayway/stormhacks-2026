import { expect, it } from "vitest";
import type { Hazard } from "./hazards";
import { WormField } from "./worms";

it("spawns near hazards once and credits a pickup only once", () => {
  const field = new WormField();
  const hazards: Hazard[] = [
    { id: 0, kind: "pot", x: 340, y: 0, width: 96, height: 62, passed: false },
  ];
  field.advance(hazards, 0);
  field.advance(hazards, 0);
  expect(field.items).toHaveLength(1);
  const worm = field.items[0];
  expect(worm.x).toBeGreaterThan(hazards[0].x + hazards[0].width / 2);
  expect(field.collect({ ...worm, width: 96, height: 72 })).toHaveLength(1);
  expect(field.collect({ ...worm, width: 96, height: 72 })).toHaveLength(0);
  field.advance(hazards, 0);
  expect(field.items).toHaveLength(0);
});
