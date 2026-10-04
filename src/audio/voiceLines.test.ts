import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import {
  type VoiceLine,
  type WorldId,
  fits,
  isVoiceManifest,
  pickLine,
  specificity,
} from "./voiceLines";

const manifest: unknown = JSON.parse(
  readFileSync(new URL("../../public/voice/manifest.json", import.meta.url), {
    encoding: "utf8",
  }),
);
const LINES = manifest as VoiceLine[];
const WORLDS: WorldId[] = ["kitchen", "dessert", "heaven"];
/** Every reason GameScene.finishRun can report: hazard kinds, the cat, and falling. */
const REASONS = ["pot", "knife", "pin", "cat-paw", "fall"];

it("ships a valid manifest whose files all exist", () => {
  expect(isVoiceManifest(manifest)).toBe(true);
  for (const line of LINES) {
    expect(() =>
      readFileSync(new URL(`../../public/voice/${line.file}`, import.meta.url)),
    ).not.toThrow();
    expect(line.caption).not.toMatch(/\[|\]/);
  }
});

it("has a line for every death in every world, and a story beat for every world", () => {
  for (const level of WORLDS) {
    for (const reason of REASONS) {
      expect(
        pickLine(LINES, "death", { level, reason }),
        `${level} ${reason}`,
      ).toBeDefined();
    }
    expect(pickLine(LINES, "level_start", { level })).toBeDefined();
    for (const event of [
      "near_miss",
      "milestone",
      "new_best",
      "idle",
    ] as const) {
      expect(
        pickLine(LINES, event, { level }),
        `${level} ${event}`,
      ).toBeDefined();
    }
  }
  expect(
    pickLine(LINES, "level_start", { level: "kitchen", loop: true })?.id,
  ).toMatch(/loop/);
  expect(
    pickLine(LINES, "level_start", { level: "kitchen", loop: false })?.id,
  ).toMatch(/start/);
});

it("lets the chef own kitchen deaths and the narrator tell the rest", () => {
  for (let i = 0; i < 20; i++) {
    expect(
      pickLine(LINES, "death", { level: "kitchen", reason: "pot" })?.persona,
    ).toBe("chef");
    expect(
      pickLine(LINES, "death", { level: "dessert", reason: "knife" })?.id,
    ).toMatch(/cactus/);
    expect(
      pickLine(LINES, "death", { level: "heaven", reason: "fall" })?.persona,
    ).toBe("narrator");
  }
});

const line = (id: string, extra: Partial<VoiceLine> = {}): VoiceLine => ({
  id,
  persona: "announcer",
  event: "near_miss",
  caption: id,
  file: `${id}.mp3`,
  ...extra,
});

it("matches only the conditions a line names", () => {
  expect(fits(line("a"), "near_miss", { level: "dessert" })).toBe(true);
  expect(
    fits(line("b", { level: "kitchen" }), "near_miss", { level: "dessert" }),
  ).toBe(false);
  expect(
    fits(line("c", { reason: ["pot"] }), "near_miss", { level: "kitchen" }),
  ).toBe(false);
  expect(
    fits(line("d", { loop: false }), "near_miss", { level: "kitchen" }),
  ).toBe(true);
  expect(specificity(line("e", { level: "kitchen", reason: ["pot"] }))).toBe(2);
});

it("prefers specific lines, widens thin pools and avoids recent repeats", () => {
  const lines = [
    line("generic1"),
    line("generic2"),
    line("kitchen1", { level: "kitchen" }),
  ];
  const seen = new Set<string>();
  for (let i = 0; i < 50; i++) {
    seen.add(pickLine(lines, "near_miss", { level: "kitchen" })!.id);
  }
  // One specific line is a thin pool, so the generic lines join it.
  expect(seen).toEqual(new Set(["generic1", "generic2", "kitchen1"]));
  expect(
    pickLine(
      lines,
      "near_miss",
      { level: "kitchen" },
      ["kitchen1", "generic1"],
      () => 0,
    )!.id,
  ).toBe("generic2");
  // Everything recent: still say something rather than nothing.
  expect(
    pickLine(lines, "near_miss", { level: "dessert" }, [
      "generic1",
      "generic2",
    ]),
  ).toBeDefined();
  expect(pickLine(lines, "death", { level: "kitchen" })).toBeUndefined();
});
