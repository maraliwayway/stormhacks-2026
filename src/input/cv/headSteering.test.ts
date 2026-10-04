import { describe, expect, it } from "vitest";
import { FLIGHT, Flight } from "../../game/flight";
import { EMPTY_INPUT } from "../types";
import { createGestureDetector } from "./gestureDetector";
import { L } from "./landmarks";

function pose(headX = 0.5) {
  const points = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.6,
    visibility: 1,
  }));
  for (const index of [L.NOSE, L.EYE_L, L.EYE_R, L.EAR_L, L.EAR_R]) {
    points[index] = { x: headX, y: 0.2, visibility: 1 };
  }
  points[L.SHOULDER_L] = { x: 0.375, y: 0.35, visibility: 1 };
  points[L.SHOULDER_R] = { x: 0.625, y: 0.35, visibility: 1 };
  points[L.HIP_L].x = 0.375;
  points[L.HIP_R].x = 0.625;
  points[L.WRIST_L].x = 0.35;
  points[L.WRIST_R].x = 0.65;
  return points;
}

function controls(fps = 30) {
  const detector = createGestureDetector();
  const flight = new Flight();
  let timestampMs = 1000;
  const feed = (points: ReturnType<typeof pose> | null, frames = 8) => {
    let state!: ReturnType<typeof detector.update>;
    for (let frame = 0; frame < frames; frame++) {
      timestampMs += 1000 / fps;
      state = detector.update(points, timestampMs);
      flight.update({ ...EMPTY_INPUT, ...state, calibrated: true }, 1 / fps);
    }
    return state;
  };
  feed(pose());
  return { detector, flight, feed };
}

describe("head-position steering", () => {
  it("uses the mirrored camera sides, holds one lane, and keeps the lane when recentered", () => {
    const { flight, feed } = controls();
    expect(feed(pose(0.7)).strafe).toBe(-1);
    expect(flight.x).toBe(FLIGHT.lanes[0]);
    feed(pose(0.7), 90);
    expect(flight.x).toBe(FLIGHT.lanes[0]);
    expect(feed(pose()).strafe).toBe(0);
    expect(flight.x).toBe(FLIGHT.lanes[0]);
    feed(pose(0.3));
    expect(flight.x).toBe(FLIGHT.lanes[1]);
    feed(pose());
    feed(pose(0.3));
    expect(flight.x).toBe(FLIGHT.lanes[2]);
  });

  it("ignores shoulder and hip motion when the head stays centered", () => {
    const { flight, feed } = controls();
    const points = pose();
    points[L.SHOULDER_L].y += 0.08;
    points[L.SHOULDER_R].y -= 0.08;
    points[L.HIP_L].x += 0.15;
    points[L.HIP_R].x += 0.15;
    expect(feed(points).strafe).toBe(0);
    expect(flight.x).toBe(FLIGHT.lanes[1]);
  });

  it("does not rearm while jittering at a side boundary", () => {
    const { feed } = controls();
    expect(feed(pose(0.7)).turnLeftCount).toBe(1);
    for (let frame = 0; frame < 60; frame++) {
      const state = feed(pose(0.64 + Math.sin(frame) * 0.02), 1);
      expect(state.turnLeftCount).toBe(1);
    }
    expect(feed(pose()).strafe).toBe(0);
    expect(feed(pose(0.7)).turnLeftCount).toBe(2);
  });

  it("keeps flapping tracked but does not rearm a turn across face occlusion", () => {
    const { feed } = controls();
    feed(pose(0.7));
    const hidden = pose(0.7);
    for (const index of [L.NOSE, L.EYE_L, L.EYE_R, L.EAR_L, L.EAR_R]) {
      hidden[index].visibility = 0.05;
    }
    const missing = feed(hidden);
    expect(missing.tracking).toBe(true);
    expect(missing.headPosition).toBeNull();
    expect(missing.strafe).toBe(0);
    expect(feed(pose(0.7)).turnLeftCount).toBe(1);
    feed(pose());
    expect(feed(pose(0.7)).turnLeftCount).toBe(2);
  });

  it("uses visible eyes when the nose and ears are obscured", () => {
    const { feed } = controls();
    const points = pose(0.7);
    points[L.NOSE].visibility = 0.05;
    points[L.EAR_L].visibility = 0.05;
    points[L.EAR_R].visibility = 0.05;
    points[L.EYE_L].x = 0.68;
    points[L.EYE_R].x = 0.72;
    expect(feed(points).strafe).toBe(-1);
  });

  it("does not replay a held turn across full tracking loss or a new run", () => {
    const { feed } = controls();
    const held = feed(pose(0.7));
    feed(null);
    const recovered = feed(pose(0.7));
    expect(recovered.turnLeftCount).toBe(held.turnLeftCount);
    const restarted = new Flight(held.flapCount, {
      ...EMPTY_INPUT,
      ...held,
      calibrated: true,
    });
    restarted.update({ ...EMPTY_INPUT, ...recovered, calibrated: true }, 0.2);
    expect(restarted.x).toBe(FLIGHT.lanes[1]);
    feed(pose());
    const next = feed(pose(0.7));
    restarted.update({ ...EMPTY_INPUT, ...next, calibrated: true }, 0.2);
    expect(restarted.x).toBe(FLIGHT.lanes[0]);
  });

  it.each([10, 15, 30, 60])(
    "recognizes a side within 100 ms at %i fps",
    (fps) => {
      const { feed } = controls(fps);
      const state = feed(pose(0.7), Math.max(1, Math.floor(fps / 10)));
      expect(state.strafe).toBe(-1);
      expect(state.turnLeftCount).toBe(1);
    },
  );

  it("preserves a brief turn even when the head recenters before the game reads it", () => {
    const detector = createGestureDetector();
    const flight = new Flight();
    detector.update(pose(0.7), 1000);
    let state = detector.update(pose(), 1033);
    state = detector.update(pose(), 1066);
    expect(state.strafe).toBe(0);
    flight.update({ ...EMPTY_INPUT, ...state, calibrated: true }, 0.2);
    expect(flight.x).toBe(FLIGHT.lanes[0]);
  });
});
