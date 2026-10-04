/**
 * Owner: Dev 3. Ticket: "Leaderboard + score persistence".
 * Every finished run is saved under the player's call sign through the team's score sink.
 * Players can rename the run from the results screen. Offline, nothing is shown.
 */
import { browserStorage } from "../game/storage";
import { backendLink } from "./backendLink";
import { setScoreSink } from "./scoreSync";

export interface LeaderboardEntry {
  id: number;
  name: string;
  altitude: number;
}

export interface RunPlacement {
  id: number;
  rank: number;
  entries: LeaderboardEntry[];
}

export const NAME_MAX = 12;
const NAME_KEY = "flappy-arms.call-sign";
/** Below this the run is a false start and is not worth a leaderboard row. */
export const MIN_SUBMIT_METRES = 1;

const CALL_SIGNS = [
  "Sir Coos",
  "Captain Crumb",
  "Feather Fury",
  "Beaky Blinder",
  "Wing Commander",
  "Pidge Royale",
  "Coo Coo Cachoo",
  "Breadwinner",
  "Sky Biscuit",
  "Flapjack",
];

export function cleanName(name: string): string {
  return name
    .replace(/[^A-Za-z0-9 _.\-!?']/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, NAME_MAX)
    .trim();
}

export function randomCallSign(random: () => number = Math.random): string {
  return CALL_SIGNS[Math.floor(random() * CALL_SIGNS.length)];
}

type Listener = (placement: RunPlacement | null) => void;

class Leaderboard {
  private placement: RunPlacement | null = null;
  private listeners = new Set<Listener>();
  private name = "";

  get callSign(): string {
    if (!this.name) {
      let stored: string | null = null;
      try {
        stored = browserStorage()?.getItem(NAME_KEY) ?? null;
      } catch {
        /* Storage is optional. */
      }
      this.name = cleanName(stored ?? "") || randomCallSign();
    }
    return this.name;
  }

  get latest(): RunPlacement | null {
    return this.placement;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Called on run start so the results screen never shows the previous run's rank. */
  clear(): void {
    this.setPlacement(null);
  }

  async submit(altitude: number, duration: number): Promise<void> {
    if (!backendLink.configured || altitude < MIN_SUBMIT_METRES) {
      return;
    }
    const placement = await backendLink.request<RunPlacement>("/score", {
      method: "POST",
      body: JSON.stringify({ name: this.callSign, altitude, duration }),
    });
    if (placement) {
      this.setPlacement(placement);
    }
  }

  async rename(next: string): Promise<boolean> {
    const name = cleanName(next);
    if (!name) {
      return false;
    }
    this.name = name;
    try {
      browserStorage()?.setItem(NAME_KEY, name);
    } catch {
      /* Keep the in-memory name. */
    }
    const current = this.placement;
    if (!current) {
      return true;
    }
    const updated = await backendLink.request<RunPlacement>(
      `/score/${current.id}`,
      { method: "PATCH", body: JSON.stringify({ name }) },
    );
    if (updated) {
      this.setPlacement(updated);
    }
    return updated !== null;
  }

  async top(): Promise<LeaderboardEntry[] | null> {
    const board = await backendLink.request<{ entries: LeaderboardEntry[] }>(
      "/leaderboard",
    );
    return board?.entries ?? null;
  }

  private setPlacement(placement: RunPlacement | null): void {
    this.placement = placement;
    for (const listener of [...this.listeners]) {
      listener(placement);
    }
  }
}

export const leaderboard = new Leaderboard();

/** Registers the backend as the team's score sink. */
export function installLeaderboard(): () => void {
  setScoreSink((run) => leaderboard.submit(run.altitude, run.duration));
  return () => setScoreSink(undefined);
}
