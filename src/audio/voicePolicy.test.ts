import { expect, it } from "vitest";
import type { VoiceEvent } from "./voiceLines";
import {
  GLOBAL_COOLDOWN_MS,
  IDLE_AFTER_MS,
  RECENT_MEMORY,
  STREAK_WINDOW_MS,
  decide,
  flapsInWindow,
  initialVoiceState,
  isIdle,
  recordSpoken,
  rememberLine,
} from "./voicePolicy";

it("keeps a global gap between lines but lets story beats and death through", () => {
  const state = initialVoiceState();
  recordSpoken(state, "milestone", 0);
  state.speakingPriority = null;
  expect(decide(state, "near_miss", GLOBAL_COOLDOWN_MS - 1)).toBe("skip");
  expect(decide(state, "near_miss", GLOBAL_COOLDOWN_MS)).toBe("play");
  expect(decide(state, "level_start", 100)).toBe("play");
  expect(decide(state, "death", 100)).toBe("play");
});

it("cools the same moment down for longer than the global gap", () => {
  const state = initialVoiceState();
  recordSpoken(state, "near_miss", 0);
  state.speakingPriority = null;
  expect(decide(state, "near_miss", 12_000)).toBe("skip");
  expect(decide(state, "near_miss", 15_000)).toBe("play");
  expect(decide(state, "milestone", 12_000)).toBe("play");
});

it("never overlaps: only death and records interrupt lower-priority speech", () => {
  const state = initialVoiceState();
  recordSpoken(state, "near_miss", 0);
  expect(decide(state, "milestone", 10_000)).toBe("skip");
  expect(decide(state, "level_start", 10_000)).toBe("skip");
  expect(decide(state, "new_best", 10)).toBe("interrupt");
  expect(decide(state, "death", 10)).toBe("interrupt");
  recordSpoken(state, "death", 20);
  expect(decide(state, "death", 30)).toBe("skip");
});

it("remembers recent ids without duplicates", () => {
  let recent: string[] = [];
  for (const id of ["a", "b", "a", "c", "d", "e", "f", "g"]) {
    recent = rememberLine(recent, id);
  }
  expect(recent).toHaveLength(RECENT_MEMORY);
  expect(recent[0]).toBe("g");
  expect(new Set(recent).size).toBe(recent.length);
});

it("detects idle wings and flap streaks", () => {
  expect(isIdle(Number.NaN, 10_000)).toBe(false);
  expect(isIdle(0, IDLE_AFTER_MS - 1)).toBe(false);
  expect(isIdle(0, IDLE_AFTER_MS)).toBe(true);
  const flaps = [0, 500, 1000, 2900, 2950];
  expect(flapsInWindow(flaps, STREAK_WINDOW_MS)).toBe(4);
});

it("paces a realistic 60 second run to a handful of lines with no overlap", () => {
  const LINE_MS = 2600;
  const timeline: [number, VoiceEvent][] = [
    [0, "level_start"],
    [4000, "near_miss"],
    [6000, "near_miss"],
    [9000, "idle"],
    [12_000, "milestone"],
    [15_000, "near_miss"],
    [19_000, "streak"],
    [24_000, "milestone"],
    [26_000, "near_miss"],
    [31_000, "level_start"],
    [33_000, "new_best"],
    [36_000, "milestone"],
    [38_000, "near_miss"],
    [44_000, "idle"],
    [48_000, "milestone"],
    [52_000, "near_miss"],
    [60_000, "death"],
  ];
  const state = initialVoiceState();
  const spoken: [number, VoiceEvent][] = [];
  let endsAt = 0;
  for (const [time, event] of timeline) {
    if (time >= endsAt) {
      state.speakingPriority = null;
    }
    const decision = decide(state, event, time);
    if (decision !== "skip") {
      recordSpoken(state, event, time);
      spoken.push([time, event]);
      endsAt = time + LINE_MS;
    }
  }
  const events = spoken.map(([, event]) => event);
  expect(spoken.length).toBeGreaterThanOrEqual(5);
  expect(spoken.length).toBeLessThanOrEqual(9);
  expect(events[0]).toBe("level_start");
  expect(events.at(-1)).toBe("death");
  expect(events).toContain("new_best");
  for (let i = 1; i < spoken.length; i++) {
    const gap = spoken[i][0] - spoken[i - 1][0];
    const story = ["level_start", "death", "new_best"].includes(spoken[i][1]);
    expect(gap >= GLOBAL_COOLDOWN_MS || story).toBe(true);
  }
});
