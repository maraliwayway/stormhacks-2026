import { describe, expect, it } from "vitest";
import { EMPTY_INPUT } from "../input/types";
import { FLIGHT, Flight } from "./flight";

const active = () => ({ ...EMPTY_INPUT, tracking: true, calibrated: true });

describe("flight physics", () => {
  it("head steering ignores swipes and turns even while arms are moving", () => {
    const flight = new Flight();
    const input = {
      ...active(),
      steeringMode: "head" as const,
      strafe: -1,
      swipeLeftCount: 1,
      swipeInProgress: true,
      turnLeftCount: 0,
      turnRightCount: 0,
    };
    flight.update(input, 0.2);
    expect(flight.x).toBe(FLIGHT.lanes[1]);
    input.turnLeftCount++;
    flight.update(input, 0.2);
    expect(flight.x).toBe(FLIGHT.lanes[0]);
    input.strafe = 0;
    flight.update(input, 0.2);
    expect(flight.x).toBe(FLIGHT.lanes[0]);
    input.turnRightCount++;
    input.tracking = false;
    flight.update(input, 0.2);
    input.tracking = true;
    flight.update(input, 0.2);
    expect(flight.x).toBe(FLIGHT.lanes[0]);
  });
  it("directional swipes move one lane without repeats or replaying the menu swipe", () => {
    const input = { ...active(), swipeLeftCount: 0, swipeRightCount: 2 };
    const flight = new Flight(0, input);
    flight.update(input, 0.2);
    expect(flight.x).toBe(FLIGHT.lanes[1]);
    input.swipeLeftCount++;
    flight.update(input, 0.2);
    expect(flight.x).toBe(FLIGHT.lanes[0]);
    for (let frame = 0; frame < 30; frame++) {
      flight.update(input, 1 / 60);
    }
    expect(flight.x).toBe(FLIGHT.lanes[0]);
    input.swipeRightCount++;
    input.strafe = 1;
    flight.update(input, 0.2);
    flight.update(input, 0.2);
    expect(flight.x).toBe(FLIGHT.lanes[1]);
    input.tracking = false;
    input.swipeRightCount++;
    flight.update(input, 0.2);
    input.tracking = true;
    flight.update(input, 0.2);
    expect(flight.x).toBe(FLIGHT.lanes[1]);
    input.swipeRightCount = 0;
    flight.update(input, 0.2);
    expect(flight.x).toBe(FLIGHT.lanes[1]);
  });

  it("a small tilt moves exactly one lane, settles quickly, and does not repeat while held", () => {
    const flight = new Flight();
    const input = { ...active(), strafe: -0.25 };
    for (let i = 0; i < 12; i++) {
      flight.update(input, 1 / 60);
    }
    expect(flight.x).toBe(FLIGHT.lanes[0]);
    for (let i = 0; i < 120; i++) {
      flight.update(input, 1 / 60);
    }
    expect(flight.x).toBe(FLIGHT.lanes[0]);
    input.strafe = 0.25;
    for (let i = 0; i < 12; i++) {
      flight.update(input, 1 / 60);
    }
    expect(flight.x).toBe(FLIGHT.lanes[1]);
    for (let i = 0; i < 120; i++) {
      flight.update(input, 1 / 60);
    }
    expect(flight.x).toBe(FLIGHT.lanes[1]);
    input.strafe = 0;
    flight.update(input, 1 / 60);
    input.strafe = 0.25;
    for (let i = 0; i < 12; i++) {
      flight.update(input, 1 / 60);
    }
    expect(flight.x).toBe(FLIGHT.lanes[2]);
  });

  it("gives one flap over seven metres of lift from rest and caps repeated impulses", () => {
    const flight = new Flight();
    flight.velocity = 0;
    const input = { ...active(), flapCount: 1 };
    flight.update(input, 1 / 120);
    while (flight.velocity < 0) {
      flight.update(input, 1 / 120);
    }
    // Previously a 400 px/s impulse lifted only 2.5 metres from rest.
    expect(flight.altitude).toBeGreaterThan(7);
    input.flapCount += 4;
    flight.update(input, 0);
    expect(flight.velocity).toBe(-FLIGHT.maxRise);
  });

  it("flapping faster climbs higher, and without flapping the bird only sinks slowly", () => {
    const climb = (rate: number) => {
      const flight = new Flight();
      const input = active();
      for (let frame = 0; frame < 600; frame++) {
        if (rate > 0 && frame % Math.round(60 / rate) === 0) {
          input.flapCount++;
        }
        flight.update(input, 1 / 60);
      }
      return flight;
    };
    const none = climb(0);
    expect(none.y).toBeGreaterThan(FLIGHT.startY);
    expect(none.velocity).toBe(FLIGHT.maxFall);
    expect(FLIGHT.maxFall).toBeLessThanOrEqual(200);
    const heights = [1, 2, 3, 4].map((rate) => climb(rate).altitude);
    expect(heights[2]).toBeGreaterThan(50);
    for (let i = 1; i < heights.length; i++) {
      expect(heights[i]).toBeGreaterThan(heights[i - 1]);
    }
  });

  it("caps fall speed, preserves max score and never follows downward", () => {
    const flight = new Flight();
    const input = active();
    input.flapCount = 4;
    flight.update(input, 0.1);
    flight.y = -500;
    flight.update(input, 0.1);
    const camera = flight.cameraY;
    const score = flight.altitude;
    for (let i = 0; i < 600; i++) {
      flight.update(input, 1 / 60);
    }
    expect(flight.velocity).toBe(FLIGHT.maxFall);
    expect(flight.cameraY).toBeLessThanOrEqual(camera);
    expect(flight.altitude).toBeGreaterThanOrEqual(score);
    expect(flight.offscreen).toBe(true);
  });

  it("ignores jitter, finishes a short key press, and clamps moves at the outer lanes", () => {
    const flight = new Flight();
    const input = { ...active(), strafe: 0.15 };
    for (let i = 0; i < 60; i++) {
      flight.update(input, 1 / 60);
    }
    expect(flight.x).toBe(FLIGHT.lanes[1]);
    input.strafe = 1;
    flight.update(input, 1 / 60);
    input.strafe = 0;
    for (let i = 0; i < 12; i++) {
      flight.update(input, 1 / 60);
    }
    expect(flight.x).toBe(FLIGHT.lanes[2]);
    for (let i = 0; i < 5; i++) {
      input.strafe = 1;
      flight.update(input, 0.2);
      input.strafe = 0;
      flight.update(input, 0.2);
      expect(flight.x).toBe(FLIGHT.lanes[2]);
    }
    for (let i = 0; i < 5; i++) {
      input.strafe = -1;
      flight.update(input, 0.2);
      input.strafe = 0;
      flight.update(input, 0.2);
    }
    expect(flight.x).toBe(FLIGHT.lanes[0]);
  });

  it("pauses without tracking and rebases a reset input counter", () => {
    const flight = new Flight(20);
    const input = active();
    input.strafe = -1;
    expect(flight.update(input, 1 / 60)).toBe(0);
    flight.update(input, 1 / 60);
    expect(flight.x).toBeLessThan(640);
    input.flapCount = 1;
    expect(flight.update(input, 1 / 60)).toBe(1);
    input.tracking = false;
    const y = flight.y;
    flight.update(input, 1);
    expect(flight.y).toBe(y);
  });
});
