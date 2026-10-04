import { EMPTY_INPUT, type InputSource, type InputState } from "./types";

const CONTROL_KEYS = new Set([
  "Space",
  "Enter",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
]);

/** Keyboard and CV share the same snapshots and monotonic downstroke count. */
export class KeyboardInput implements InputSource {
  private keys = new Set<string>();
  private flaps: number[] = [];
  private state: InputState = {
    ...EMPTY_INPUT,
    tracking: true,
    calibrated: true,
    selectCount: 0,
  };

  constructor(
    private target: Window = window,
    private now: () => number = () => performance.now(),
  ) {}

  async start(): Promise<void> {
    this.target.addEventListener("keydown", this.onDown);
    this.target.addEventListener("keyup", this.onUp);
    this.target.addEventListener("blur", this.release);
  }

  stop(): void {
    this.target.removeEventListener("keydown", this.onDown);
    this.target.removeEventListener("keyup", this.onUp);
    this.target.removeEventListener("blur", this.release);
    this.release();
  }

  getState(): Readonly<InputState> {
    this.flaps = this.flaps.filter((flapMs) => this.now() - flapMs < 3000);
    this.state.flapRate = this.flaps.length / 3;
    return this.state;
  }

  private onDown = (event: KeyboardEvent): void => {
    const element = event.target as HTMLElement | null;
    // Native controls own their activation keys; gameplay never consumes a focused button.
    if (
      element?.closest?.(
        "button, a, input, select, textarea, [contenteditable=true]",
      )
    ) {
      return;
    }
    if (!CONTROL_KEYS.has(event.code)) {
      return;
    }
    event.preventDefault();
    if (event.repeat || this.keys.has(event.code)) {
      return;
    }
    this.keys.add(event.code);
    if (event.code === "Space") {
      this.state.flapCount += 1;
      this.flaps.push(this.now());
    }
    if (event.code === "Enter" || event.code === "ArrowUp") {
      this.state.selectCount = (this.state.selectCount ?? 0) + 1;
    }
    this.updateHeld();
  };

  private onUp = (event: KeyboardEvent): void => {
    if (!CONTROL_KEYS.has(event.code)) {
      return;
    }
    event.preventDefault();
    this.keys.delete(event.code);
    this.updateHeld();
  };

  private release = (): void => {
    this.keys.clear();
    this.updateHeld();
  };

  private updateHeld(): void {
    this.state.flapping = this.keys.has("Space");
    this.state.flapVelocity = this.state.flapping ? 1 : 0;
    this.state.strafeLeft = this.keys.has("ArrowLeft");
    this.state.strafeRight = this.keys.has("ArrowRight");
    this.state.strafe =
      Number(this.state.strafeRight) - Number(this.state.strafeLeft);
    this.state.jump = this.keys.has("ArrowUp");
    this.state.squat = this.keys.has("ArrowDown");
    this.state.select = this.keys.has("Enter");
  }
}
