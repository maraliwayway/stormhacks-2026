/** Non-blocking integration seam for Dev 3's voice director and backend. */
export interface GameEvents {
  flap: { x: number; y: number; count: number };
  death: {
    altitude: number;
    duration: number;
    flapCount: number;
    flapRate: number;
    reason: string;
  };
  near_miss: { altitude: number; x: number; y: number };
  new_best: { altitude: number; previousBest: number };
  milestone: { altitude: number };
  run_end: { altitude: number; duration: number };
  level_start: { level: "kitchen" | "dessert" | "heaven"; altitude: number };
  /** Retained for voice integration compatibility; endless runs do not emit win. */
  win: { altitude: number; duration: number };
  pickup: { x: number; y: number; total: number };
}

type Listener<K extends keyof GameEvents> = (event: GameEvents[K]) => void;
const listeners = new Map<keyof GameEvents, Set<(event: never) => void>>();

export const gameEvents = {
  on<K extends keyof GameEvents>(type: K, listener: Listener<K>): () => void {
    const group = listeners.get(type) ?? new Set();
    group.add(listener as (event: never) => void);
    listeners.set(type, group);
    return () => {
      group.delete(listener as (event: never) => void);
    };
  },
  emit<K extends keyof GameEvents>(type: K, event: GameEvents[K]): void {
    for (const listener of [...(listeners.get(type) ?? [])]) {
      try {
        listener(event as never);
      } catch (error) {
        console.warn(`Game event listener failed: ${type}`, error);
      }
    }
  },
};
