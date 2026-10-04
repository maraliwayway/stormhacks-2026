import { describe, expect, it } from 'vitest';
import { EMPTY_INPUT } from '../input/types';
import { Flight, FLIGHT } from './flight';

const active = () => ({ ...EMPTY_INPUT, tracking: true, calibrated: true });

describe('flight physics', () => {
  it('holds altitude at two flaps per second and climbs at three', () => {
    for (const rate of [2, 3]) {
      const flight = new Flight();
      const input = active();
      for (let frame = 0; frame < 600; frame++) {
        if (frame % (60 / rate) === 0) input.flapCount++;
        flight.update(input, 1 / 60);
      }
      if (rate === 2) expect(flight.y).toBeCloseTo(FLIGHT.startY, 5);
      else expect(flight.altitude).toBeGreaterThan(50);
    }
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

  it('uses lane edges, pauses without tracking, and rebases a reset input counter', () => {
    const flight = new Flight(20);
    const input = active();
    input.strafeLeft = true;
    expect(flight.update(input, 1 / 60)).toBe(0);
    flight.update(input, 1 / 60);
    expect(flight.lane).toBe(0);
    input.flapCount = 1;
    expect(flight.update(input, 1 / 60)).toBe(1);
    input.tracking = false;
    const y = flight.y;
    flight.update(input, 1);
    expect(flight.y).toBe(y);
  });
});
