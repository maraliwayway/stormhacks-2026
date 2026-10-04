import type { InputState } from '../input/types';

export const FLIGHT = {
  width: 1280, height: 720, startY: 550, gravity: 800,
  impulse: 400, maxFall: 580, maxRise: 600, pixelsPerMetre: 40,
  lanes: [340, 640, 940],
} as const;

export class Flight {
  x = 640;
  y: number = FLIGHT.startY;
  velocity = 200;
  cameraY = 0;
  altitude = 0;
  lane = 1;
  private count: number;
  private previousDirection = 0;

  constructor(count = 0) { this.count = count; }

  update(input: Readonly<InputState>, dt: number): number {
    // Resetting an input producer must never replay its historic downstrokes.
    const flaps = input.flapCount >= this.count ? Math.min(4, input.flapCount - this.count) : 0;
    this.count = input.flapCount;
    if (!input.tracking || !input.calibrated) return 0;
    this.velocity = Math.max(-FLIGHT.maxRise, this.velocity - flaps * FLIGHT.impulse);
    const direction = Number(input.strafeRight) - Number(input.strafeLeft);
    if (direction !== 0 && direction !== this.previousDirection) {
      this.lane = Math.max(0, Math.min(2, this.lane + direction));
    }
    this.previousDirection = direction;
    this.x += (FLIGHT.lanes[this.lane] - this.x) * (1 - Math.exp(-16 * dt));
    const nextVelocity = Math.min(FLIGHT.maxFall, this.velocity + FLIGHT.gravity * dt);
    this.y += (this.velocity + nextVelocity) * 0.5 * dt;
    this.velocity = nextVelocity;
    this.cameraY = Math.min(this.cameraY, this.y - 360);
    this.altitude = Math.max(this.altitude, (FLIGHT.startY - this.y) / FLIGHT.pixelsPerMetre);
    return flaps;
  }

  get offscreen(): boolean { return this.y - this.cameraY > FLIGHT.height + 40; }
}
