// INTEGRATION CONTRACT. Tell the team before changing this file.
// Mirrored in docs/event-schema.md.

export type LevelId = "kitchen" | "dessert";

export interface RunStats {
  level: LevelId;
  altitude: number;
  best: number;
  durationS: number;
  peakFlapRate: number;
  nearMisses: number;
  causeOfDeath: string;
}

export type GameEvent =
  | { type: "run_start"; level: LevelId }
  | { type: "flap" }
  | { type: "near_miss" }
  | { type: "milestone"; altitude: number }
  | { type: "new_best"; altitude: number }
  | { type: "flap_rate_dropped"; flapRate: number }
  | { type: "death"; stats: RunStats };

export type GameEventType = GameEvent["type"];
