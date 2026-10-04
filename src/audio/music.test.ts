import { describe, expect, it } from "vitest";
import { TRACKS } from "./music";

describe("music tracks", () => {
  it("gives every world a four-bar loop with sixteen-step melodies", () => {
    expect(Object.keys(TRACKS).sort()).toEqual([
      "dessert",
      "heaven",
      "kitchen",
      "title",
    ]);
    for (const track of Object.values(TRACKS)) {
      expect(track.chords).toHaveLength(4);
      expect(track.roots).toHaveLength(4);
      for (const bar of track.melody) {
        expect(bar).toHaveLength(16);
      }
      for (const steps of [
        track.bassSteps,
        track.kick,
        track.clap,
        track.hat,
        track.shaker,
        track.woodblock,
      ]) {
        for (const step of steps ?? []) {
          expect(step).toBeGreaterThanOrEqual(0);
          expect(step).toBeLessThan(16);
        }
      }
    }
  });
});
