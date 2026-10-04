import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getLatest, onFrame, startTracker, stopTracker } from "./poseTracker";
import type { PoseWorkerRequest, PoseWorkerResponse } from "./poseWorkerTypes";

class TestWorker {
  static current: TestWorker;
  onmessage: ((event: { data: PoseWorkerResponse }) => void) | null = null;
  onerror = null;
  postMessage = vi.fn<(message: PoseWorkerRequest) => void>();
  terminate = vi.fn();
  constructor() {
    TestWorker.current = this;
  }
  reply(message: PoseWorkerResponse): void {
    this.onmessage?.({ data: message });
  }
}

function camera() {
  let nextId = 0;
  const callbacks = new Map<number, (timestampMs: number) => void>();
  const track = { stop: vi.fn() };
  const stream = { getTracks: () => [track] };
  const video = {
    srcObject: null,
    play: vi.fn(() => Promise.resolve()),
    requestVideoFrameCallback: (callback: (timestampMs: number) => void) => {
      callbacks.set(++nextId, callback);
      return nextId;
    },
    cancelVideoFrameCallback: (id: number) => callbacks.delete(id),
  };
  const bitmap = { close: vi.fn() };
  vi.stubGlobal("navigator", {
    mediaDevices: { getUserMedia: vi.fn(async () => stream) },
  });
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => bitmap),
  );
  return {
    video: video as unknown as HTMLVideoElement,
    track,
    stream,
    bitmap,
    callbacks,
    async start() {
      const started = startTracker(video as unknown as HTMLVideoElement);
      await Promise.resolve();
      await Promise.resolve();
      TestWorker.current.reply({ type: "ready", delegate: "GPU" });
      await started;
      return TestWorker.current;
    },
    async frame(elapsedMs = 33) {
      await vi.advanceTimersByTimeAsync(elapsedMs);
      const [id, callback] = callbacks.entries().next().value!;
      callbacks.delete(id);
      callback(performance.now());
      await Promise.resolve();
    },
  };
}

// Only coordinates are needed for the tracker freshness contract.
const landmarks = [{ x: 0.5, y: 0.5, z: 0, visibility: 1 }];
let unsubscribe: (() => void) | null = null;

describe("camera frame pipeline", () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: [
        "setTimeout",
        "clearTimeout",
        "setInterval",
        "clearInterval",
        "performance",
      ],
    });
    vi.stubGlobal("Worker", TestWorker);
    vi.stubGlobal("location", { href: "http://localhost/" });
  });
  afterEach(() => {
    unsubscribe?.();
    unsubscribe = null;
    stopTracker();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("keeps one frame in flight, drops queued work and follows camera timestamp jitter", async () => {
    const fixture = camera();
    const worker = await fixture.start();
    await fixture.frame(33);
    await fixture.frame(33);
    expect(
      worker.postMessage.mock.calls.filter(
        ([message]) => message.type === "frame",
      ),
    ).toHaveLength(1);
    expect(getLatest().droppedFrames).toBe(1);
    worker.reply({ type: "pose", landmarks, timestampMs: 33, inferenceMs: 20 });
    await fixture.frame(31);
    worker.reply({ type: "pose", landmarks, timestampMs: 97, inferenceMs: 20 });
    await fixture.frame(31);
    expect(
      worker.postMessage.mock.calls.filter(
        ([message]) => message.type === "frame",
      ),
    ).toHaveLength(3);
  });

  it("rejects late results and expires poses from capture time rather than receipt time", async () => {
    const fixture = camera();
    const worker = await fixture.start();
    const tracking = vi.fn();
    unsubscribe = onFrame((snapshot) => tracking(snapshot.landmarks !== null));
    await fixture.frame();
    await vi.advanceTimersByTimeAsync(200);
    worker.reply({
      type: "pose",
      landmarks,
      timestampMs: 33,
      inferenceMs: 200,
    });
    expect(getLatest().landmarks).toBe(landmarks);
    await vi.advanceTimersByTimeAsync(401);
    expect(getLatest().landmarks).toBeNull();
    expect(tracking).toHaveBeenLastCalledWith(false);
    await fixture.frame();
    const capturedAt = performance.now();
    await vi.advanceTimersByTimeAsync(601);
    worker.reply({
      type: "pose",
      landmarks,
      timestampMs: capturedAt,
      inferenceMs: 601,
    });
    expect(getLatest().landmarks).toBeNull();
  });

  it("releases the camera and discards worker responses after stopping", async () => {
    const fixture = camera();
    const worker = await fixture.start();
    await fixture.frame();
    stopTracker();
    worker.reply({ type: "pose", landmarks, timestampMs: 33, inferenceMs: 10 });
    expect(getLatest().landmarks).toBeNull();
    expect(fixture.track.stop).toHaveBeenCalledOnce();
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(fixture.callbacks.size).toBe(0);
    expect(fixture.video.srcObject).toBeNull();
  });

  it("closes a bitmap captured while the tracker was being stopped", async () => {
    const fixture = camera();
    const worker = await fixture.start();
    let resolveBitmap!: (bitmap: unknown) => void;
    vi.stubGlobal(
      "createImageBitmap",
      () =>
        new Promise((resolve) => {
          resolveBitmap = resolve;
        }),
    );
    await fixture.frame();
    stopTracker();
    resolveBitmap(fixture.bitmap);
    await Promise.resolve();
    expect(fixture.bitmap.close).toHaveBeenCalledOnce();
    expect(
      worker.postMessage.mock.calls.filter(
        ([message]) => message.type === "frame",
      ),
    ).toHaveLength(0);
  });

  it("stops a camera stream whose permission request completed after cancellation", async () => {
    const fixture = camera();
    let resolveStream!: (stream: unknown) => void;
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: () =>
          new Promise((resolve) => {
            resolveStream = resolve;
          }),
      },
    });
    const started = startTracker(fixture.video);
    const rejected = expect(started).rejects.toThrow(
      "Camera startup cancelled",
    );
    stopTracker();
    resolveStream(fixture.stream);
    await rejected;
    expect(fixture.track.stop).toHaveBeenCalledOnce();
    expect(fixture.video.srcObject).toBeNull();
  });
});
