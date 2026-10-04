import { describe, expect, it } from "vitest";
import { MenuConfirm } from "../../game/menuConfirm";
import { EMPTY_INPUT } from "../types";
import { DEFAULT_CALIBRATION, createGestureDetector } from "./gestureDetector";
import { L } from "./landmarks";

function pose(leftY: number, rightY: number) {
  const landmarks = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.6 }));
  landmarks[L.SHOULDER_L] = { x: 0.375, y: 0.35 };
  landmarks[L.SHOULDER_R] = { x: 0.625, y: 0.35 };
  landmarks[L.HIP_L] = { x: 0.375, y: 0.6 };
  landmarks[L.HIP_R] = { x: 0.625, y: 0.6 };
  landmarks[L.WRIST_L] = { x: 0.4, y: leftY };
  landmarks[L.WRIST_R] = { x: 0.6, y: rightY };
  return landmarks;
}

describe("camera motion regressions", () => {
  it("does not let jumping select a camera menu configured for prayer contacts", () => {
    const ready = {
      ...EMPTY_INPUT,
      tracking: true,
      calibrated: true,
      menuConfirmMode: "clap" as const,
      selectCount: 0,
    };
    const confirm = new MenuConfirm(ready);
    expect(confirm.read({ ...ready, jump: true })).toBe(false);
    expect(confirm.read({ ...ready, select: true })).toBe(false);
    expect(confirm.read({ ...ready, selectCount: 1 })).toBe(true);
  });

  it("does not combine separate one-arm strokes into a two-arm flap", () => {
    const detector = createGestureDetector();
    let timestampMs = 1000;
    const feed = (leftY: number, rightY: number, frames: number) => {
      let state = detector.update(
        pose(leftY, rightY),
        timestampMs,
        DEFAULT_CALIBRATION,
      );
      for (let frame = 0; frame < frames; frame++) {
        timestampMs += 33;
        state = detector.update(
          pose(leftY, rightY),
          timestampMs,
          DEFAULT_CALIBRATION,
        );
      }
      return state;
    };
    feed(0.6, 0.6, 5);
    feed(0.1, 0.6, 3);
    feed(0.6, 0.6, 3);
    feed(0.6, 0.1, 3);
    expect(feed(0.6, 0.6, 3).flapCount).toBe(0);
  });

  it("rejects invisible wrists instead of counting their inferred movement", () => {
    const detector = createGestureDetector();
    const landmarks = pose(0.1, 0.1).map((point) => ({
      ...point,
      visibility: 1,
    }));
    landmarks[L.WRIST_L].visibility = 0.1;
    expect(detector.update(landmarks, 1000).tracking).toBe(true);
    landmarks[L.WRIST_L].y = 0.6;
    expect(detector.update(landmarks, 1033).flapCount).toBe(0);
  });

  it.each([15, 30, 60])(
    "counts comfortable flaps at %i camera frames per second",
    (fps) => {
      const detector = createGestureDetector();
      const frameMs = 1000 / fps;
      let state = detector.update(pose(0.6, 0.6), 1000);
      for (let frame = 1; frame <= fps * 4; frame++) {
        // Two flaps per second, with a moderate half-shoulder-width arm excursion.
        const armY = 0.35 - Math.cos((frame * frameMs * Math.PI) / 250) * 0.125;
        state = detector.update(pose(armY, armY), 1000 + frame * frameMs);
      }
      expect(state.flapCount).toBe(8);
      expect(state.swipeRightCount).toBe(0);
    },
  );

  it("does not mistake whole-body bobbing for arm motion", () => {
    const detector = createGestureDetector();
    for (let frame = 0; frame < 90; frame++) {
      const offset = Math.sin(frame / 3) * 0.1;
      const landmarks = pose(0.3, 0.3).map((point) => ({
        ...point,
        y: point.y + offset,
      }));
      const state = detector.update(landmarks, 1000 + frame * 33);
      expect(state.flapCount).toBe(0);
      expect(state.swipeRightCount).toBe(0);
    }
  });

  it("responds to shoulder tilt with planted hips and removes calibrated resting tilt", () => {
    const detector = createGestureDetector();
    for (const direction of [-1, 1]) {
      let state = detector.update(pose(0.6, 0.6), 1000);
      detector.reset();
      for (let frame = 0; frame < 4; frame++) {
        const landmarks = pose(0.6, 0.6);
        landmarks[L.SHOULDER_L].y += direction * 0.025;
        landmarks[L.SHOULDER_R].y -= direction * 0.025;
        state = detector.update(
          landmarks,
          2000 + (direction + 1) * 500 + frame * 33,
        );
      }
      expect(Math.sign(state.strafe)).toBe(-direction);
      expect(Math.abs(state.strafe)).toBeGreaterThan(0.2);
    }
    const resting = pose(0.6, 0.6);
    resting[L.SHOULDER_L].y += 0.025;
    resting[L.SHOULDER_R].y -= 0.025;
    detector.reset();
    expect(
      detector.update(resting, 5000, {
        ...DEFAULT_CALIBRATION,
        shoulderRoll: -0.2,
      }).strafe,
    ).toBeCloseTo(0);
  });

  it("cannot finish a flap across a delayed camera frame", () => {
    const detector = createGestureDetector();
    detector.update(pose(0.2, 0.2), 1000);
    expect(detector.update(pose(0.6, 0.6), 1700).flapCount).toBe(0);
    expect(detector.update(pose(0.6, 0.6), 1733).flapCount).toBe(0);
  });
});
