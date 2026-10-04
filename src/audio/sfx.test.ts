import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { sfxForLevel } from "./sfx";

it("plays a chime for new worlds but not for the first kitchen of a run", () => {
  expect(sfxForLevel("kitchen", 0)).toBeNull();
  expect(sfxForLevel("dessert", 60)).toBe("level_up");
  expect(sfxForLevel("kitchen", 150)).toBe("level_up");
  expect(sfxForLevel("heaven", 120)).toBe("heaven");
});

it("ships every sound effect the game triggers", () => {
  const manifest = JSON.parse(
    readFileSync(new URL("../../public/sfx/manifest.json", import.meta.url), {
      encoding: "utf8",
    }),
  );
  for (const id of [
    "flap",
    "death",
    "near_miss",
    "new_best",
    "level_up",
    "heaven",
  ]) {
    expect(manifest[id]).toBe(`${id}.mp3`);
    expect(
      readFileSync(new URL(`../../public/sfx/${id}.mp3`, import.meta.url))
        .length,
    ).toBeGreaterThan(2000);
  }
});
