// Local best scores. localStorage can be unavailable (private windows), so never let it throw.

import type { LevelId } from "../shared/events";

export function loadBest(level: LevelId): number {
  try {
    return Number(localStorage.getItem(`flappy-arms:best:${level}`) ?? 0) || 0;
  } catch {
    return 0;
  }
}

export function saveBest(level: LevelId, value: number): void {
  try {
    localStorage.setItem(`flappy-arms:best:${level}`, String(value));
  } catch {
    /* ignore */
  }
}
