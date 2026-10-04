import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MenuConfirm } from "../../game/menuConfirm";
import { createCvInput } from "./cvInput";
import { L } from "./landmarks";
import type { TrackerSnapshot } from "./poseTracker";

const camera = vi.hoisted(() => ({
  listener: null as ((snapshot: TrackerSnapshot) => void) | null,
  latest: { error: null } as TrackerSnapshot,
}));
vi.mock("./poseTracker", () => ({
  startTracker: () => Promise.resolve(),
  stopTracker: vi.fn(),
  getLatest: () => camera.latest,
  onFrame: (listener: (snapshot: TrackerSnapshot) => void) => {
    camera.listener = listener;
    return () => {
      camera.listener = null;
    };
  },
}));

function standingPose(): NormalizedLandmark[] {
  const points = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.6,
    z: 0,
    visibility: 1,
  }));
  points[L.SHOULDER_L] = { ...points[0], x: 0.375, y: 0.35 };
  points[L.SHOULDER_R] = { ...points[0], x: 0.625, y: 0.35 };
  points[L.HIP_L].x = 0.375;
  points[L.HIP_R].x = 0.625;
  points[L.WRIST_L].x = 0.35;
  points[L.WRIST_R].x = 0.65;
  return points;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("camera input integration", () => {
  it("calibrates, selects only with prayer contacts, and maps sensitive flight gestures", async () => {
    vi.stubGlobal("window", {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    const input = createCvInput({} as HTMLVideoElement);
    await input.start();
    let timestampMs = 1000;
    const feed = (points: NormalizedLandmark[] | null) => {
      timestampMs += 33;
      camera.latest = {
        landmarks: points,
        frameTs: timestampMs,
        error: null,
        fps: 30,
        inferenceMs: 10,
        latencyMs: 10,
        droppedFrames: 0,
        delegate: "GPU",
      };
      camera.listener?.(camera.latest);
      return input.getState();
    };
    for (let frame = 0; frame < 70; frame++) {
      feed(standingPose());
    }
    expect(input.getState().calibrated).toBe(true);
    expect(input.getState().menuConfirmMode).toBe("clap");
    const confirm = new MenuConfirm(input.getState());
    for (const direction of [-1, 1]) {
      for (let frame = 0; frame < 12; frame++) {
        feed(standingPose());
      }
      for (let frame = 0; frame <= 12; frame++) {
        const points = standingPose();
        points[L.WRIST_R] = {
          ...points[0],
          x: 0.5 + direction * (0.15 - frame * 0.025),
          y: 0.35,
        };
        feed(points);
      }
      expect(confirm.read(input.getState())).toBe(false);
    }
    expect(input.getState().swipeLeftCount).toBe(1);
    expect(input.getState().swipeRightCount).toBe(1);
    for (let frame = 0; frame < 6; frame++) {
      const points = standingPose();
      points[L.WRIST_L] = { ...points[0], x: 0.49, y: 0.43 };
      points[L.WRIST_R] = { ...points[0], x: 0.51, y: 0.43 };
      feed(points);
    }
    expect(confirm.read(input.getState())).toBe(true);
    expect(confirm.read(input.getState())).toBe(false);
    for (const armY of [0.2, 0.2, 0.2, 0.2, 0.35, 0.45, 0.6]) {
      const points = standingPose();
      points[L.WRIST_L].y = armY;
      points[L.WRIST_R].y = armY;
      feed(points);
    }
    expect(input.getState().flapCount).toBe(1);
    expect(confirm.read(input.getState())).toBe(false);
    const hiddenWrist = standingPose();
    hiddenWrist[L.WRIST_R].visibility = 0.1;
    expect(feed(hiddenWrist).tracking).toBe(true);
    expect(confirm.read(input.getState())).toBe(false);
    input.recalibrate();
    expect(input.getState().calibrated).toBe(false);
    input.stop();
    expect(input.getState().tracking).toBe(false);
    expect(camera.listener).toBeNull();
  });
});
