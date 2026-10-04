// INTEGRATION CONTRACT. Tell the team before changing this file.
//
// Single source of player input. Gestures (Dev 1) and keyboard (Dev 2) both
// write here; the game and menus only ever read from here.

export type Gesture = "flap" | "strafeLeft" | "strafeRight" | "jump" | "squat" | "select";
export type InputSource = "pose" | "keyboard";
export type Lane = -1 | 0 | 1;

type Listener = (gesture: Gesture, source: InputSource) => void;

class InputStateImpl {
  /** Current lane from strafe position. -1 left, 0 centre, 1 right. */
  lane: Lane = 0;
  /** Flaps per second over a rolling 3 s window (pose only; keyboard estimates it). */
  flapRate = 0;
  /** Last source that produced input. Drives the "keyboard mode" HUD badge. */
  source: InputSource = "keyboard";
  /** True while the full body is visible to the camera. */
  bodyVisible = false;

  private listeners = new Set<Listener>();
  private flapTimes: number[] = [];

  emit(gesture: Gesture, source: InputSource): void {
    this.source = source;
    if (gesture === "flap") this.recordFlap(performance.now());
    if (gesture === "strafeLeft") this.lane = Math.max(-1, this.lane - 1) as Lane;
    if (gesture === "strafeRight") this.lane = Math.min(1, this.lane + 1) as Lane;
    this.listeners.forEach((l) => l(gesture, source));
  }

  /** Pose input sets the lane directly from body position instead of stepping. */
  setLane(lane: Lane, source: InputSource): void {
    this.source = source;
    this.lane = lane;
  }

  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private recordFlap(now: number): void {
    this.flapTimes.push(now);
    const windowStart = now - 3000;
    while (this.flapTimes.length && this.flapTimes[0] < windowStart) this.flapTimes.shift();
    this.flapRate = this.flapTimes.length / 3;
  }
}

export const InputState = new InputStateImpl();
