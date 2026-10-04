export interface Difficulty {
  enemyEveryMetres: number;
  enemySpeed: number;
  enemyMix: { static: number; sweeper: number; diver: number };
}

let current: Difficulty = {
  enemyEveryMetres: 20,
  enemySpeed: 1,
  enemyMix: { static: 0.5, sweeper: 0.3, diver: 0.2 },
};

/** Dev 1 can push local adaptive parameters. No network work belongs here. */
export function setDifficulty(next: Difficulty): void {
  const weights = Object.values(next.enemyMix);
  if (
    !Number.isFinite(next.enemyEveryMetres) ||
    !Number.isFinite(next.enemySpeed) ||
    weights.some((w) => !Number.isFinite(w) || w < 0) ||
    weights.reduce((a, b) => a + b, 0) <= 0
  ) {
    return;
  }
  current = {
    enemyEveryMetres: Math.max(12, Math.min(80, next.enemyEveryMetres)),
    enemySpeed: Math.max(0.5, Math.min(2, next.enemySpeed)),
    enemyMix: { ...next.enemyMix },
  };
}

export function getDifficulty(): Difficulty {
  return { ...current, enemyMix: { ...current.enemyMix } };
}

export const ENCOUNTER_COOLDOWN_SECONDS = 6;
export const ALTITUDE_RAMP_METRES = 600;

/** Total run altitude keeps the ramp climbing when the map loops to Kitchen. */
export function getEncounterPacing(
  altitude: number,
  difficulty = getDifficulty(),
) {
  const progress = Math.max(0, Math.min(1, altitude / ALTITUDE_RAMP_METRES));
  return {
    everyMetres: Math.max(
      12,
      Math.max(24, difficulty.enemyEveryMetres) * (1 - progress * 0.5),
    ),
    // Frequency increases while preserving the full warning and a breather between cats.
    cooldownSeconds: ENCOUNTER_COOLDOWN_SECONDS - progress * 2,
  };
}
