import { EMPTY_INPUT, type InputSource, type InputState } from "./types";

let active: InputSource = { getState: () => EMPTY_INPUT };

export const inputManager = {
  getSource(): InputSource {
    return active;
  },
  setSource(source: InputSource) {
    active = source;
  },
  getState(): Readonly<InputState> {
    return active.getState();
  },
};
