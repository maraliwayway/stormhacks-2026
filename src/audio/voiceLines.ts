/** Owner: Dev 3. Pre-rendered ElevenLabs lines and the rules for choosing one. */

export type Persona = "narrator" | "chef" | "announcer";
export type WorldId = "kitchen" | "dessert" | "heaven";
export type VoiceEvent =
  | "level_start"
  | "near_miss"
  | "milestone"
  | "new_best"
  | "death"
  | "pickup"
  | "idle"
  | "streak";

/** One entry of public/voice/manifest.json, written by backend/scripts/render_voice_lines.py. */
export interface VoiceLine {
  id: string;
  persona: Persona;
  event: VoiceEvent;
  caption: string;
  file: string;
  level?: WorldId;
  loop?: boolean;
  reason?: string[];
}

export interface VoiceContext {
  level: WorldId;
  loop?: boolean;
  reason?: string;
}

export const SPEAKER_NAMES: Record<Persona, string> = {
  narrator: "The Narrator",
  chef: "Chef Gustavo",
  announcer: "The Announcer",
};

/** A line fits when every condition it names matches; unnamed conditions match anything. */
export function fits(
  line: VoiceLine,
  event: VoiceEvent,
  context: VoiceContext,
): boolean {
  return (
    line.event === event &&
    (line.level === undefined || line.level === context.level) &&
    (line.loop === undefined || line.loop === Boolean(context.loop)) &&
    (line.reason === undefined ||
      (context.reason !== undefined && line.reason.includes(context.reason)))
  );
}

export function specificity(line: VoiceLine): number {
  return (
    Number(line.level !== undefined) +
    Number(line.loop !== undefined) +
    Number(line.reason !== undefined)
  );
}

const MIN_POOL = 2;

/**
 * Prefers the most specific lines (the chef's pot line beats a generic death line),
 * widens to less specific ones when that pool is thin, and skips recently played ids.
 */
export function pickLine(
  lines: readonly VoiceLine[],
  event: VoiceEvent,
  context: VoiceContext,
  recent: readonly string[] = [],
  random: () => number = Math.random,
): VoiceLine | undefined {
  const candidates = lines.filter((line) => fits(line, event, context));
  if (candidates.length === 0) {
    return undefined;
  }
  const levels = [...new Set(candidates.map(specificity))].sort(
    (a, b) => b - a,
  );
  let pool: VoiceLine[] = [];
  for (const level of levels) {
    pool = pool.concat(
      candidates.filter(
        (line) => specificity(line) === level && !recent.includes(line.id),
      ),
    );
    if (pool.length >= MIN_POOL) {
      break;
    }
  }
  if (pool.length === 0) {
    pool = candidates;
  }
  return pool[Math.floor(random() * pool.length)];
}

export function isVoiceManifest(value: unknown): value is VoiceLine[] {
  return (
    Array.isArray(value) &&
    value.every(
      (line) =>
        typeof line?.id === "string" &&
        typeof line.file === "string" &&
        typeof line.event === "string" &&
        typeof line.persona === "string",
    )
  );
}
