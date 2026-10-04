import type { InputState } from "../input/types";

/** Hands-together contacts and keyboard presses confirm once across scene changes. */
export class MenuConfirm {
  private held: boolean;
  private count: number;
  constructor(input: Readonly<InputState>) {
    this.held = input.jump || Boolean(input.select);
    this.count = input.selectCount ?? 0;
  }
  read(input: Readonly<InputState>): boolean {
    const held = input.jump || Boolean(input.select);
    const count = input.selectCount ?? 0;
    const pressed =
      count > this.count ||
      ((!input.menuConfirmMode || input.menuConfirmMode === "press") &&
        held &&
        !this.held);
    this.held = held;
    this.count = count;
    return pressed && input.tracking && input.calibrated;
  }
}
