export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function browserStorage(): StoragePort | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/** A disabled or full localStorage must never interrupt a run. */
export class CounterStore {
  private value = 0;
  constructor(
    private key: string,
    private storage: StoragePort | undefined = browserStorage(),
  ) {
    try {
      const stored = Number(storage?.getItem(key));
      if (Number.isFinite(stored) && stored >= 0) {
        this.value = stored;
      }
    } catch {
      /* Use the session value when browser storage is unavailable. */
    }
  }
  get(): number {
    return this.value;
  }
  set(value: number): void {
    if (!Number.isFinite(value) || value < 0) {
      return;
    }
    this.value = value;
    try {
      this.storage?.setItem(this.key, String(value));
    } catch {
      /* Keep the in-memory value. */
    }
  }
}

// Keys keep the original project name so existing best scores survive the rename.
export const bestScore = new CounterStore("flappy-arms.best-altitude");
