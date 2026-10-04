import { describe, expect, it } from "vitest";
import { FLIGHT, Flight } from "../../game/flight";
import { EMPTY_INPUT } from "../types";
import { createCalibrator } from "./calibration";
import { createGestureDetector } from "./gestureDetector";
import { L } from "./landmarks";

function pose() {
  const points = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.6,
    visibility: 1,
  }));
  points[L.SHOULDER_L] = { x: 0.375, y: 0.35, visibility: 1 };
  points[L.SHOULDER_R] = { x: 0.625, y: 0.35, visibility: 1 };
  points[L.HIP_L].x = 0.375;
  points[L.HIP_R].x = 0.625;
  points[L.WRIST_L].x = 0.35;
  points[L.WRIST_R].x = 0.65;
  return points;
}

describe("sensitive camera controls", () => {
  it("keeps head steering when a wrist is obscured", () => {
    const detector = createGestureDetector();
    const flight = new Flight();
    for (let frame = 0; frame < 12; frame++) {
      const points = pose();
      for (const index of [L.NOSE, L.EYE_L, L.EYE_R, L.EAR_L, L.EAR_R]) {
        points[index].x = 0.7;
      }
      points[L.WRIST_L].visibility = 0.05;
      const state = detector.update(points, 1000 + frame * 33);
      expect(state.tracking).toBe(true);
      flight.update({ ...EMPTY_INPUT, ...state, calibrated: true }, 0.033);
    }
    expect(flight.x).toBe(FLIGHT.lanes[0]);
  });

  it("counts small two-arm flaps without requiring the hands to cross shoulder height", () => {
    const detector = createGestureDetector();
    let state = detector.update(pose(), 1000);
    for (let frame = 1; frame <= 120; frame++) {
      const points = pose();
      const armY = 0.48 - Math.cos((frame * Math.PI) / 7.5) * 0.035;
      points[L.WRIST_L].y = armY;
      points[L.WRIST_R].y = armY;
      state = detector.update(points, 1000 + (frame * 1000) / 30);
    }
    expect(state.flapCount).toBe(8);
  });

  it("can calibrate with the upper body visible when hips and feet are outside the frame", () => {
    const calibrator = createCalibrator();
    calibrator.start();
    const points = pose();
    for (const index of [
      L.HIP_L,
      L.HIP_R,
      L.KNEE_L,
      L.KNEE_R,
      L.ANKLE_L,
      L.ANKLE_R,
    ]) {
      points[index].y = 1.1;
      points[index].visibility = 0.05;
    }
    let status = calibrator.update(points, 1000);
    for (let frame = 1; frame <= 70; frame++) {
      status = calibrator.update(points, 1000 + frame * 33);
    }
    expect(status.phase).toBe("done");
  });

  it("selects once with a prayer pose and requires separation before selecting again", () => {
    const detector = createGestureDetector();
    let timestampMs = 1000;
    const feed = (together: boolean, frames: number) => {
      let state!: ReturnType<typeof detector.update>;
      for (let frame = 0; frame < frames; frame++) {
        const points = pose();
        points[L.WRIST_L] = {
          x: together ? 0.49 : 0.35,
          y: 0.43,
          visibility: 0.35,
        };
        points[L.WRIST_R] = {
          x: together ? 0.51 : 0.65,
          y: 0.43,
          visibility: 0.35,
        };
        timestampMs += 33;
        state = detector.update(points, timestampMs);
      }
      return state;
    };
    expect(feed(true, 40).prayerCount).toBe(1);
    feed(false, 1);
    expect(feed(true, 10).prayerCount).toBe(1);
    detector.update(null, timestampMs + 1);
    expect(feed(true, 40).prayerCount).toBe(1);
    feed(false, 6);
    expect(feed(true, 6).prayerCount).toBe(2);
  });

  it("calibrates despite intermittent lower-body visibility", () => {
    const calibrator = createCalibrator();
    calibrator.start();
    let status = calibrator.update(pose(), 1000);
    for (let frame = 1; frame <= 70; frame++) {
      const points = pose();
      if (frame % 2 === 0) {
        points[L.HIP_L].visibility = 0.2;
        points[L.HIP_R].visibility = 0.2;
      } else {
        points[L.HIP_L].y = 0.9;
        points[L.HIP_R].y = 0.9;
      }
      status = calibrator.update(points, 1000 + frame * 33);
    }
    expect(status.phase).toBe("done");
    expect(status.calibration?.shoulderY).toBe(0.35);
  });

  it("recognizes touching palms from finger landmarks when wrists are occluded", () => {
    const detector = createGestureDetector();
    const points = pose();
    points[L.WRIST_L].visibility = 0.05;
    points[L.WRIST_R].visibility = 0.05;
    for (const index of [L.INDEX_L, L.PINKY_L]) {
      points[index] = { x: 0.49, y: 0.43, visibility: 0.8 };
    }
    for (const index of [L.INDEX_R, L.PINKY_R]) {
      points[index] = { x: 0.51, y: 0.43, visibility: 0.8 };
    }
    let state = detector.update(points, 1000);
    for (let frame = 1; frame < 6; frame++) {
      state = detector.update(points, 1000 + frame * 33);
    }
    expect(state.tracking).toBe(true);
    expect(state.prayerCount).toBe(1);
    expect(state.flapCount).toBe(0);
  });

  it.each([10, 15, 30, 60])(
    "counts small flaps with moderate wrist confidence at %i fps",
    (fps) => {
      const detector = createGestureDetector();
      let state = detector.update(pose(), 1000);
      for (let frame = 1; frame <= fps * 4; frame++) {
        const points = pose();
        const armY = 0.48 - Math.cos((frame * Math.PI * 4) / fps) * 0.035;
        points[L.WRIST_L] = { x: 0.35, y: armY, visibility: 0.2 };
        points[L.WRIST_R] = { x: 0.65, y: armY, visibility: 0.2 };
        state = detector.update(points, 1000 + (frame * 1000) / fps);
      }
      expect(state.flapCount).toBe(8);
      expect(state.prayerCount).toBe(0);
    },
  );
});
