// INTEGRATION CONTRACT. Tell the team before changing this file.
// Typed pub/sub for game events. Listeners must be fast and never block.

import type { GameEvent, GameEventType } from "./events";

type Handler<T extends GameEventType> = (event: Extract<GameEvent, { type: T }>) => void;

class EventBusImpl {
  private handlers = new Map<GameEventType, Set<(e: GameEvent) => void>>();

  on<T extends GameEventType>(type: T, handler: Handler<T>): () => void {
    const set = this.handlers.get(type) ?? new Set();
    set.add(handler as (e: GameEvent) => void);
    this.handlers.set(type, set);
    return () => set.delete(handler as (e: GameEvent) => void);
  }

  emit(event: GameEvent): void {
    this.handlers.get(event.type)?.forEach((h) => {
      try {
        h(event);
      } catch (err) {
        console.error(`EventBus handler for ${event.type} failed`, err);
      }
    });
  }
}

export const EventBus = new EventBusImpl();
