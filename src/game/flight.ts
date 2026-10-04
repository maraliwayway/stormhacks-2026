import type { InputState } from "../input/types";

export const FLIGHT = {
  width: 1280,
  height: 720,
  startY: 550,
  gravity: 800,
  // Without flapping the bird only sinks slowly (maxFall); each flap adds an upward impulse,
  // so flapping faster climbs faster.
  impulse: 700,
  maxFall: 150,
  maxRise: 1000,
  pixelsPerMetre: 40,
  lanes: [340, 640, 940],
  // One small tilt selects one adjacent lane. A 300 px move takes about 170 ms.
  laneSpeed: 1800,
  laneEnter: 0.2,
  laneExit: 0.08,
} as const;

const MAX_FLAPS_PER_FRAME = 4;
const FALL_MARGIN_PIXELS = 40;

/** Tie distances resolve toward the leftmost lane, matching encounter targeting. */
export function nearestLane(x: number): number {
  return FLIGHT.lanes.reduce(
    (closest, laneX, index) =>
      Math.abs(laneX - x) < Math.abs(FLIGHT.lanes[closest] - x)
        ? index
        : closest,
    0,
  );
}

export class Flight {
  x = 640;
  y: number = FLIGHT.startY;
  velocity = 200;
  cameraY = 0;
  altitude = 0;
  private targetLane = 1;
  private strafeDirection = 0;
  private lastFlapCount: number;

  constructor(initialFlapCount = 0) {
    this.lastFlapCount = initialFlapCount;
  }

  update(input: Readonly<InputState>, elapsedSeconds: number): number {
    // Resetting an input producer must never replay its historic downstrokes.
    const flaps =
      input.flapCount >= this.lastFlapCount
        ? Math.min(MAX_FLAPS_PER_FRAME, input.flapCount - this.lastFlapCount)
        : 0;
    this.lastFlapCount = input.flapCount;
    if (!input.tracking || !input.calibrated) {
      return 0;
    }
    this.velocity = Math.max(
      -FLIGHT.maxRise,
      this.velocity - flaps * FLIGHT.impulse,
    );
    this.updateStrafe(input.strafe, elapsedSeconds);
    const nextVelocity = Math.min(
      FLIGHT.maxFall,
      this.velocity + FLIGHT.gravity * elapsedSeconds,
    );
    this.y += (this.velocity + nextVelocity) * 0.5 * elapsedSeconds;
    this.velocity = nextVelocity;
    this.cameraY = Math.min(this.cameraY, this.y - FLIGHT.height / 2);
    this.altitude = Math.max(
      this.altitude,
      (FLIGHT.startY - this.y) / FLIGHT.pixelsPerMetre,
    );
    return flaps;
  }

  private updateStrafe(strafe: number, elapsedSeconds: number): void {
    const magnitude = Math.abs(strafe);
    let direction = this.strafeDirection;
    if (magnitude >= FLIGHT.laneEnter) {
      direction = Math.sign(strafe);
    } else if (magnitude <= FLIGHT.laneExit) {
      direction = 0;
    }
    if (direction !== 0 && direction !== this.strafeDirection) {
      this.targetLane = Math.max(
        0,
        Math.min(FLIGHT.lanes.length - 1, this.targetLane + direction),
      );
    }
    this.strafeDirection = direction;
    const distance = FLIGHT.lanes[this.targetLane] - this.x;
    this.x +=
      Math.sign(distance) *
      Math.min(Math.abs(distance), FLIGHT.laneSpeed * elapsedSeconds);
  }

  /** Nearest of the three hazard lanes, used to aim the cat's ambush. */
  get lane(): number {
    return nearestLane(this.x);
  }

  get offscreen(): boolean {
    return this.y - this.cameraY > FLIGHT.height + FALL_MARGIN_PIXELS;
  }
}
