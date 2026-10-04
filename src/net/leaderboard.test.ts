import { afterEach, expect, it, vi } from "vitest";
import { gameEvents } from "../game/events";
import { backendLink, parseEnvelope, socketUrl } from "./backendLink";
import {
  MIN_SUBMIT_METRES,
  NAME_MAX,
  cleanName,
  installLeaderboard,
  leaderboard,
  randomCallSign,
} from "./leaderboard";
import { formatMetres, rankCopy } from "./resultsPanel";
import { installScoreSync } from "./scoreSync";

const PLACEMENT = {
  id: 7,
  rank: 2,
  entries: [
    { id: 3, name: "Ace", altitude: 90 },
    { id: 7, name: "Sir Coos", altitude: 41.5 },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  backendLink.start(null, false)();
  leaderboard.clear();
});

it("parses only well-formed envelopes and derives the socket url", () => {
  expect(
    parseEnvelope('{"type":"roast","ts":1,"payload":{"text":"hi"}}')?.type,
  ).toBe("roast");
  expect(parseEnvelope("not json")).toBeNull();
  expect(parseEnvelope('{"type":"x"}')).toBeNull();
  expect(parseEnvelope(42)).toBeNull();
  expect(socketUrl("https://api.flappyarms.tech")).toBe(
    "wss://api.flappyarms.tech/ws",
  );
  expect(socketUrl("http://localhost:8000")).toBe("ws://localhost:8000/ws");
});

it("cleans call signs the same way as the backend", () => {
  expect(cleanName("  Sky   Queen!! <b>")).toBe("Sky Queen!!");
  expect(cleanName("<<>>")).toBe("");
  expect(cleanName("a".repeat(40))).toHaveLength(NAME_MAX);
  expect(randomCallSign(() => 0)).toBe("Sir Coos");
});

it("does nothing offline: no backend url means no requests", async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  backendLink.start(null, false);
  await leaderboard.submit(50, 30);
  expect(await leaderboard.top()).toBeNull();
  expect(fetchMock).not.toHaveBeenCalled();
  expect(leaderboard.latest).toBeNull();
});

it("submits finished runs through the team score sink and announces the rank", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify(PLACEMENT), { status: 200 }),
    );
  vi.stubGlobal("fetch", fetchMock);
  backendLink.start("http://api.test", false);
  const removeSink = installLeaderboard();
  const removeSync = installScoreSync();
  const seen = vi.fn();
  const unsubscribe = leaderboard.subscribe(seen);

  gameEvents.emit("run_end", { altitude: 41.5, duration: 30 });
  await vi.waitFor(() => expect(seen).toHaveBeenCalledWith(PLACEMENT));
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("http://api.test/score");
  expect(JSON.parse(init.body)).toMatchObject({ altitude: 41.5, duration: 30 });

  fetchMock.mockClear();
  gameEvents.emit("run_end", { altitude: MIN_SUBMIT_METRES / 2, duration: 1 });
  await Promise.resolve();
  expect(fetchMock).not.toHaveBeenCalled();

  unsubscribe();
  removeSync();
  removeSink();
});

it("renames the latest run with PATCH", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(new Response(JSON.stringify(PLACEMENT)))
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ...PLACEMENT,
          entries: [{ id: 7, name: "Legend", altitude: 41.5 }],
        }),
      ),
    );
  vi.stubGlobal("fetch", fetchMock);
  backendLink.start("http://api.test", false);
  await leaderboard.submit(41.5, 30);
  expect(await leaderboard.rename("  Legend ")).toBe(true);
  const [url, init] = fetchMock.mock.calls[1];
  expect(url).toBe("http://api.test/score/7");
  expect(init.method).toBe("PATCH");
  expect(leaderboard.callSign).toBe("Legend");
  expect(await leaderboard.rename("<>")).toBe(false);
});

it("gives up on a hung backend instead of waiting", async () => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) =>
          init.signal?.addEventListener("abort", () =>
            reject(new Error("aborted")),
          ),
        ),
    ),
  );
  backendLink.start("http://api.test", false);
  const pending = leaderboard.top();
  await vi.advanceTimersByTimeAsync(3000);
  expect(await pending).toBeNull();
});

it("words the rank for the results card", () => {
  expect(rankCopy(1)).toBe("Top of the flock!");
  expect(rankCopy(3)).toBe("On the podium.");
  expect(rankCopy(8)).toBe("In the top ten.");
  expect(rankCopy(40)).toBe("on the flyers board.");
  expect(formatMetres(41.9)).toBe("41 m");
});
