// Owner: Dev 1. Ticket: "Adaptive difficulty (rule-based, client-side)".
// Deterministic, instant, bounded. No LLM in this loop.

import { EventBus } from "../../shared/EventBus";
import { InputState } from "../../shared/InputState";

export interface DifficultyParams {
  spawnIntervalMs: number;
  hazardSpeed: number;
  gapWidth: number;
}

const EASY: DifficultyParams = { spawnIntervalMs: 1400, hazardSpeed: 120, gapWidth: 2 };
const HARD: DifficultyParams = { spawnIntervalMs: 550, hazardSpeed: 320, gapWidth: 1 };

export class Difficulty {
  /** 0 = easiest, 1 = hardest. Smoothed with an EMA so it never jumps. */
  skill = 0;
  private avgFlapRate = 0;
  private lastDropWarnAt = -Infinity;

  /**
   * Call once per frame.
   * TODO(Dev 1): feed near-miss rate and dodge success into the skill target.
   */
  update(elapsedS: number, nowMs: number): DifficultyParams {
    const timeTarget = Math.min(1, elapsedS / 75); // ramps over a ~75 s run
    const tired = this.isTired(nowMs);
    const target = tired ? timeTarget * 0.7 : timeTarget;
    this.skill += (target - this.skill) * 0.02;
    return lerpParams(EASY, HARD, this.skill);
  }

  reset(): void {
    this.skill = 0;
    this.avgFlapRate = 0;
  }

  // Ease off when the player is visibly tiring, so runs end on a mistake, not exhaustion.
  private isTired(nowMs: number): boolean {
    const rate = InputState.flapRate;
    this.avgFlapRate += (rate - this.avgFlapRate) * 0.01;
    const dropped = this.avgFlapRate > 1 && rate < this.avgFlapRate * 0.7;
    if (dropped && nowMs - this.lastDropWarnAt > 10_000) {
      this.lastDropWarnAt = nowMs;
      EventBus.emit({ type: "flap_rate_dropped", flapRate: rate });
    }
    return dropped;
  }
}

function lerpParams(a: DifficultyParams, b: DifficultyParams, t: number): DifficultyParams {
  const l = (x: number, y: number) => x + (y - x) * t;
  return {
    spawnIntervalMs: l(a.spawnIntervalMs, b.spawnIntervalMs),
    hazardSpeed: l(a.hazardSpeed, b.hazardSpeed),
    gapWidth: Math.round(l(a.gapWidth, b.gapWidth)),
  };
}
