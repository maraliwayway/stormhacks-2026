import type { InputState } from '../input/types';

export const FLIGHT = {
  width: 1280, height: 720, startY: 550, gravity: 800,
  // Without flapping the bird only sinks slowly (maxFall); each flap adds an upward impulse,
  // so flapping faster climbs faster.
  impulse: 700, maxFall: 150, maxRise: 1000, pixelsPerMetre: 40,
  lanes: [340, 640, 940],
  // One small tilt selects one adjacent lane. A 300 px move takes about 170 ms.
  laneSpeed: 1800, laneEnter: 0.2, laneExit: 0.08,
} as const;

export class Flight {
  x = 640;
  y: number = FLIGHT.startY;
  velocity = 200;
  cameraY = 0;
  altitude = 0;
  private targetLane = 1;
  private strafeDirection = 0;
  private count: number;

  constructor(count = 0) { this.count = count; }

  update(input: Readonly<InputState>, dt: number): number {
    // Resetting an input producer must never replay its historic downstrokes.
    const flaps = input.flapCount >= this.count ? Math.min(4, input.flapCount - this.count) : 0;
    this.count = input.flapCount;
    if (!input.tracking || !input.calibrated) return 0;
    this.velocity = Math.max(-FLIGHT.maxRise, this.velocity - flaps * FLIGHT.impulse);
    const magnitude = Math.abs(input.strafe);
    const direction = magnitude >= FLIGHT.laneEnter ? Math.sign(input.strafe)
      : magnitude <= FLIGHT.laneExit ? 0 : this.strafeDirection;
    if (direction !== 0 && direction !== this.strafeDirection) {
      this.targetLane = Math.max(0, Math.min(FLIGHT.lanes.length - 1, this.targetLane + direction));
    }
    this.strafeDirection = direction;
    const distance = FLIGHT.lanes[this.targetLane] - this.x;
    this.x += Math.sign(distance) * Math.min(Math.abs(distance), FLIGHT.laneSpeed * dt);
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
