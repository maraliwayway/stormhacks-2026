import { describe, expect, it } from 'vitest';
import { EMPTY_INPUT } from '../input/types';
import { Flight, FLIGHT } from './flight';

const active = () => ({ ...EMPTY_INPUT, tracking: true, calibrated: true });

describe('flight physics', () => {
  it('flapping faster climbs higher, and without flapping the bird only sinks slowly', () => {
    const climb = (rate: number) => {
      const flight = new Flight();
      const input = active();
      for (let frame = 0; frame < 600; frame++) {
        if (rate > 0 && frame % Math.round(60 / rate) === 0) input.flapCount++;
        flight.update(input, 1 / 60);
      }
      return flight;
    };
    const none = climb(0);
    expect(none.y).toBeGreaterThan(FLIGHT.startY);
    expect(none.velocity).toBe(FLIGHT.maxFall);
    expect(FLIGHT.maxFall).toBeLessThanOrEqual(200);
    const heights = [1, 2, 3, 4].map(rate => climb(rate).altitude);
    expect(heights[2]).toBeGreaterThan(50);
    for (let i = 1; i < heights.length; i++) expect(heights[i]).toBeGreaterThan(heights[i - 1]);
  });

  it('caps fall speed, preserves max score and never follows downward', () => {
    const flight = new Flight();
    const input = active();
    input.flapCount = 4;
    flight.update(input, 0.1);
    flight.y = -500;
    flight.update(input, 0.1);
    const camera = flight.cameraY;
    const score = flight.altitude;
    for (let i = 0; i < 600; i++) flight.update(input, 1 / 60);
    expect(flight.velocity).toBe(FLIGHT.maxFall);
    expect(flight.cameraY).toBeLessThanOrEqual(camera);
    expect(flight.altitude).toBeGreaterThanOrEqual(score);
    expect(flight.offscreen).toBe(true);
  });

  it('glides in proportion to the analog strafe, stops at the edges, and returns', () => {
    const run = (strafe: number, frames = 60) => {
      const flight = new Flight();
      const input = { ...active(), strafe };
      for (let i = 0; i < frames; i++) flight.update(input, 1 / 60);
      return flight.x;
    };
    const centre = new Flight().x;
    expect(run(0)).toBe(centre);
    const slight = run(0.3) - centre;
    const full = run(1) - centre;
    expect(slight).toBeGreaterThan(0);
    expect(full).toBeGreaterThan(slight * 2);
    expect(run(-1)).toBeLessThan(centre);
    expect(run(1, 600)).toBe(FLIGHT.maxX);
    expect(run(-1, 600)).toBe(FLIGHT.minX);
    expect(run(5)).toBe(run(1));
  });

  it('pauses without tracking and rebases a reset input counter', () => {
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
