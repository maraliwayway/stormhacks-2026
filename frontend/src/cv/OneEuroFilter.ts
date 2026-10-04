// Owner: Dev 1. Low-lag smoothing for landmark coordinates.
// Reference: Casiez, Roussel, Vogel (2012), "1 Euro Filter".

function alpha(cutoff: number, dtS: number): number {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dtS);
}

export class OneEuroFilter {
  private xPrev?: number;
  private dxPrev = 0;
  private tPrev?: number;

  constructor(
    private minCutoff = 1.5,
    private beta = 0.02,
    private dCutoff = 1.0,
  ) {}

  filter(x: number, tMs: number): number {
    if (this.xPrev === undefined || this.tPrev === undefined) {
      this.xPrev = x;
      this.tPrev = tMs;
      return x;
    }
    const dt = Math.max((tMs - this.tPrev) / 1000, 1e-3);
    const dx = (x - this.xPrev) / dt;
    const dxHat = this.dxPrev + alpha(this.dCutoff, dt) * (dx - this.dxPrev);
    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const xHat = this.xPrev + alpha(cutoff, dt) * (x - this.xPrev);
    this.xPrev = xHat;
    this.dxPrev = dxHat;
    this.tPrev = tMs;
    return xHat;
  }

  reset(): void {
    this.xPrev = undefined;
    this.tPrev = undefined;
    this.dxPrev = 0;
  }
}
