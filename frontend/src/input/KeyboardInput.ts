// Owner: Dev 2. Ticket: "Keyboard fallback input".
// Writes to the same InputState as gestures so the demo never dies on bad lighting.

import { InputState } from "../shared/InputState";

const KEYMAP: Record<string, Parameters<typeof InputState.emit>[0]> = {
  Space: "flap",
  ArrowLeft: "strafeLeft",
  ArrowRight: "strafeRight",
  ArrowUp: "jump",
  ArrowDown: "squat",
  Enter: "select",
};

export function attachKeyboardInput(): () => void {
  const onKey = (e: KeyboardEvent) => {
    if (e.repeat) return;
    const gesture = KEYMAP[e.code];
    if (!gesture) return;
    e.preventDefault();
    InputState.emit(gesture, "keyboard");
  };
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}
