import { EMPTY_INPUT, InputSource, InputState } from './types';

let active: InputSource = { getState: () => EMPTY_INPUT };

export const inputManager = {
  setSource(source: InputSource) { active = source; },
  getState(): Readonly<InputState> { return active.getState(); },
};