/**
 * One Euro filter (Casiez et al. 2012): low-pass filter whose cutoff rises with
 * speed. Slow movement is smoothed hard (no jitter); fast movement passes through
 * with little lag (flaps stay responsive).
 */
export class OneEuroFilter {
  private previousValue: number | null = null;
  private previousSpeed = 0;
  private previousTimestampMs = 0;

  constructor(
    private minimumCutoff = 1.0, // Hz: smoothing at rest. Lower = smoother but laggier.
    private beta = 0.5, //      how fast the cutoff grows with speed. Higher = less lag on fast moves.
    private speedCutoff = 1.0, //   Hz: smoothing of the speed estimate.
  ) {}

  /** @param timestampMs timestamp in ms, must increase between calls. */
  filter(value: number, timestampMs: number): number {
    if (this.previousValue === null) {
      this.previousValue = value;
      this.previousTimestampMs = timestampMs;
      return value;
    }
    const elapsedSeconds = Math.max(
      (timestampMs - this.previousTimestampMs) / 1000,
      1e-3,
    );
    this.previousTimestampMs = timestampMs;

    const speed = (value - this.previousValue) / elapsedSeconds;
    const filteredSpeed =
      this.previousSpeed +
      smoothingFactor(elapsedSeconds, this.speedCutoff) *
        (speed - this.previousSpeed);
    this.previousSpeed = filteredSpeed;

    const cutoff = this.minimumCutoff + this.beta * Math.abs(filteredSpeed);
    const filteredValue =
      this.previousValue +
      smoothingFactor(elapsedSeconds, cutoff) * (value - this.previousValue);
    this.previousValue = filteredValue;
    return filteredValue;
  }

  reset(): void {
    this.previousValue = null;
    this.previousSpeed = 0;
  }
}

function smoothingFactor(elapsedSeconds: number, cutoff: number): number {
  const timeConstant = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + timeConstant / elapsedSeconds);
}
