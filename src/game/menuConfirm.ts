import type { InputState } from "../input/types";

/** One confirmation per hand wave, jump or Enter press, even across scene changes. */
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
    const pressed = (held && !this.held) || count > this.count;
    this.held = held;
    this.count = count;
    return pressed && input.tracking && input.calibrated;
  }
}
