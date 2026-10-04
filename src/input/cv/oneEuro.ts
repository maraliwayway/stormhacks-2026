/**
 * One Euro filter (Casiez et al. 2012): low-pass filter whose cutoff rises with
 * speed. Slow movement is smoothed hard (no jitter); fast movement passes through
 * with little lag (flaps stay responsive).
 */
export class OneEuroFilter {
  private xPrev: number | null = null;
  private dxPrev = 0;
  private tPrev = 0;

  constructor(
    private minCutoff = 1.0, // Hz: smoothing at rest. Lower = smoother but laggier.
    private beta = 0.5, //      how fast the cutoff grows with speed. Higher = less lag on fast moves.
    private dCutoff = 1.0, //   Hz: smoothing of the speed estimate.
  ) {}

  /** @param tMs timestamp in ms, must increase between calls. */
  filter(x: number, tMs: number): number {
    if (this.xPrev === null) {
      this.xPrev = x;
      this.tPrev = tMs;
      return x;
    }
    const dt = Math.max((tMs - this.tPrev) / 1000, 1e-3);
    this.tPrev = tMs;

    const dx = (x - this.xPrev) / dt;
    const dxHat = this.dxPrev + alpha(dt, this.dCutoff) * (dx - this.dxPrev);
    this.dxPrev = dxHat;

    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const xHat = this.xPrev + alpha(dt, cutoff) * (x - this.xPrev);
    this.xPrev = xHat;
    return xHat;
  }

  reset() {
    this.xPrev = null;
    this.dxPrev = 0;
  }
}

function alpha(dt: number, cutoff: number): number {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
}
