/**
 * Owner: Dev 3. Decides whether a line may play: a coach, not spam.
 * Pure so it can be unit tested without audio.
 */
import type { VoiceEvent } from "./voiceLines";

export const GLOBAL_COOLDOWN_MS = 7000;
export const RECENT_MEMORY = 6;
/** Repeats of the same moment get quieter the more often they happen. */
export const EVENT_COOLDOWN_MS: Record<VoiceEvent, number> = {
  level_start: 0,
  death: 0,
  new_best: 0,
  near_miss: 15_000,
  milestone: 20_000,
  idle: 15_000,
  streak: 25_000,
  pickup: 12_000,
};
export const PRIORITY: Record<VoiceEvent, number> = {
  death: 6,
  new_best: 5,
  level_start: 4,
  near_miss: 3,
  streak: 3,
  idle: 2,
  milestone: 2,
  pickup: 1,
};
/** Only these may cut off a line that is already playing. */
const INTERRUPT_AT = 5;
/** Story beats and death ignore the global gap; they matter more than pacing. */
const IGNORES_GLOBAL_GAP: readonly VoiceEvent[] = ["death", "level_start"];

export interface VoiceState {
  speakingPriority: number | null;
  lastSpokeAt: number;
  lastByEvent: Partial<Record<VoiceEvent, number>>;
}

export type VoiceDecision = "play" | "interrupt" | "skip";

export function initialVoiceState(): VoiceState {
  return { speakingPriority: null, lastSpokeAt: -Infinity, lastByEvent: {} };
}

export function decide(
  state: Readonly<VoiceState>,
  event: VoiceEvent,
  nowMs: number,
): VoiceDecision {
  const priority = PRIORITY[event];
  if (state.speakingPriority !== null) {
    return priority >= INTERRUPT_AT && priority > state.speakingPriority
      ? "interrupt"
      : "skip";
  }
  if (
    !IGNORES_GLOBAL_GAP.includes(event) &&
    nowMs - state.lastSpokeAt < GLOBAL_COOLDOWN_MS
  ) {
    return "skip";
  }
  const last = state.lastByEvent[event] ?? -Infinity;
  return nowMs - last < EVENT_COOLDOWN_MS[event] ? "skip" : "play";
}

export function recordSpoken(
  state: VoiceState,
  event: VoiceEvent,
  nowMs: number,
): void {
  state.speakingPriority = PRIORITY[event];
  state.lastSpokeAt = nowMs;
  state.lastByEvent[event] = nowMs;
}

export function rememberLine(recent: string[], id: string): string[] {
  return [id, ...recent.filter((other) => other !== id)].slice(
    0,
    RECENT_MEMORY,
  );
}

/** Flap rhythm helpers for the idle heckle and the "on fire" streak call. */
export const IDLE_AFTER_MS = 2200;
export const STREAK_WINDOW_MS = 3000;
export const STREAK_FLAPS = 10;

export function isIdle(lastFlapMs: number, nowMs: number): boolean {
  return Number.isFinite(lastFlapMs) && nowMs - lastFlapMs >= IDLE_AFTER_MS;
}

export function flapsInWindow(
  flapTimesMs: readonly number[],
  nowMs: number,
): number {
  return flapTimesMs.filter((time) => nowMs - time < STREAK_WINDOW_MS).length;
}
