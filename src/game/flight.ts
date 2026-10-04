import type { InputState } from '../input/types';

export const FLIGHT = {
  width: 1280, height: 720, startY: 550, gravity: 800,
  // Without flapping the bird only sinks slowly (maxFall); each flap adds an upward impulse,
  // so flapping faster climbs faster.
  impulse: 400, maxFall: 150, maxRise: 600, pixelsPerMetre: 40,
  lanes: [340, 640, 940],
  // Strafing glides: horizontal speed follows the analog strafe value (-1..1).
  strafeSpeed: 560, strafeResponse: 7, minX: 110, maxX: 1170,
} as const;

export class Flight {
  x = 640;
  y: number = FLIGHT.startY;
  velocity = 200;
  cameraY = 0;
  altitude = 0;
  private vx = 0;
  private count: number;

  constructor(count = 0) { this.count = count; }

  update(input: Readonly<InputState>, dt: number): number {
    // Resetting an input producer must never replay its historic downstrokes.
    const flaps = input.flapCount >= this.count ? Math.min(4, input.flapCount - this.count) : 0;
    this.count = input.flapCount;
    if (!input.tracking || !input.calibrated) return 0;
    this.velocity = Math.max(-FLIGHT.maxRise, this.velocity - flaps * FLIGHT.impulse);
    const target = Math.max(-1, Math.min(1, input.strafe)) * FLIGHT.strafeSpeed;
    this.vx += (target - this.vx) * (1 - Math.exp(-FLIGHT.strafeResponse * dt));
    this.x = Math.max(FLIGHT.minX, Math.min(FLIGHT.maxX, this.x + this.vx * dt));
    const nextVelocity = Math.min(FLIGHT.maxFall, this.velocity + FLIGHT.gravity * dt);
    this.y += (this.velocity + nextVelocity) * 0.5 * dt;
    this.velocity = nextVelocity;
    this.cameraY = Math.min(this.cameraY, this.y - 360);
    this.altitude = Math.max(this.altitude, (FLIGHT.startY - this.y) / FLIGHT.pixelsPerMetre);
    return flaps;
  }

  /** Nearest of the three hazard lanes, used to aim the cat's ambush. */
  get lane(): number {
    return FLIGHT.lanes.reduce((best, x, i) => Math.abs(x - this.x) < Math.abs(FLIGHT.lanes[best] - this.x) ? i : best, 0);
  }

  get offscreen(): boolean { return this.y - this.cameraY > FLIGHT.height + 40; }
}
