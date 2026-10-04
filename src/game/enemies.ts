import { getDifficulty, getEncounterPacing } from "./difficulty";
import { FLIGHT, nearestLane } from "./flight";
import { type Box, COLLISION_SCALE } from "./hazards";

export const WARNING_SECONDS = 2.5;
export const STRIKE_SECONDS = 0.35;
export const RETREAT_SECONDS = 0.3;
export const FIRST_CAT_GRACE_SECONDS = 5;
export { ENCOUNTER_COOLDOWN_SECONDS } from "./difficulty";

export interface Enemy extends Box {
  kind: "cat-paw";
  age: number;
  lane: number;
  faceOffset: number;
  strikeChecked: boolean;
  crossedStrike: boolean;
}

/** A cat locks the bird's current lane once; it never chases a dodge. */
export class EnemyField {
  items: Enemy[] = [];
  private nextEncounterAltitude = 20;
  private cooldownRemainingSeconds = 0;
  private graceRemainingSeconds = FIRST_CAT_GRACE_SECONDS;
  private hasFlapped = false;

  /** Called only during tracked gameplay, including Heaven, so pauses do not eat the grace period. */
  advanceGrace(elapsedSeconds: number, flaps: number): void {
    this.hasFlapped ||= flaps > 0;
    if (this.hasFlapped) {
      this.graceRemainingSeconds = Math.max(
        0,
        this.graceRemainingSeconds - elapsedSeconds,
      );
    }
  }

  tick(
    altitude: number,
    cameraY: number,
    elapsedSeconds: number,
    difficulty = getDifficulty(),
    bird?: Box,
  ): void {
    this.cooldownRemainingSeconds = Math.max(
      0,
      this.cooldownRemainingSeconds - elapsedSeconds,
    );
    for (const enemy of this.items) {
      const previousAge = enemy.age;
      enemy.age += elapsedSeconds;
      enemy.crossedStrike ||=
        previousAge < WARNING_SECONDS && enemy.age >= WARNING_SECONDS;
      enemy.y = cameraY + FLIGHT.height / 2;
    }
    // Keep a crossed strike until check() observes it, even on a delayed frame.
    this.items = this.items.filter(
      (enemy) =>
        enemy.crossedStrike ||
        enemy.age < WARNING_SECONDS + STRIKE_SECONDS + RETREAT_SECONDS,
    );
    if (
      this.graceRemainingSeconds > 0 ||
      altitude < this.nextEncounterAltitude ||
      this.items.length ||
      this.cooldownRemainingSeconds > 0 ||
      !bird
    ) {
      return;
    }
    const lane = nearestLane(bird.x);
    this.items.push({
      kind: "cat-paw",
      lane,
      x: FLIGHT.lanes[lane],
      y: cameraY + FLIGHT.height / 2,
      width: 220,
      height: FLIGHT.height,
      faceOffset: Math.max(180, Math.min(440, bird.y - cameraY - 130)),
      age: 0,
      strikeChecked: false,
      crossedStrike: false,
    });
    const pacing = getEncounterPacing(altitude, difficulty);
    this.nextEncounterAltitude = altitude + pacing.everyMetres;
    this.cooldownRemainingSeconds = pacing.cooldownSeconds;
  }

  check(bird: Box): { hit: Enemy | undefined; misses: Enemy[] } {
    let hit: Enemy | undefined;
    const misses: Enemy[] = [];
    for (const enemy of this.items) {
      const striking =
        enemy.crossedStrike ||
        (enemy.age >= WARNING_SECONDS &&
          enemy.age < WARNING_SECONDS + STRIKE_SECONDS);
      if (!striking) {
        continue;
      }
      // The strike fills the warned lane: climbing cannot bypass the paw.
      const inLane =
        Math.abs(bird.x - enemy.x) <
        (bird.width + enemy.width) * (COLLISION_SCALE / 2);
      if (inLane) {
        hit ??= enemy;
      } else if (!enemy.strikeChecked) {
        misses.push(enemy);
      }
      enemy.strikeChecked = true;
      enemy.crossedStrike = false;
    }
    return { hit, misses };
  }
}
