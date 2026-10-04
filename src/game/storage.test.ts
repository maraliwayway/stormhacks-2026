import { describe, expect, it } from "vitest";
import { CounterStore } from "./storage";

describe("local counters", () => {
  it("loads saved scores and rejects corrupt or non-finite values", () => {
    const data = new Map([["best", "17"]]);
    const port = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        data.set(key, value);
      },
    };
    const store = new CounterStore("best", port);
    expect(store.get()).toBe(17);
    store.set(25);
    expect(new CounterStore("best", port).get()).toBe(25);
    store.set(Infinity);
    expect(store.get()).toBe(25);
    data.set("best", "broken");
    expect(new CounterStore("best", port).get()).toBe(0);
  });

  it("works in memory when storage is blocked or full", () => {
    const port = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("full");
      },
    };
    const store = new CounterStore("best", port);
    expect(() => store.set(40)).not.toThrow();
    expect(store.get()).toBe(40);
  });
});
