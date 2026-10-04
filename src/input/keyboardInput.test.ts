import { describe, expect, it } from 'vitest';
import { KeyboardInput } from './keyboardInput';

class Target extends EventTarget {}
function key(target: Target, type: string, code: string, repeat = false): void {
  const event = new Event(type, { cancelable: true });
  Object.assign(event, { code, repeat });
  target.dispatchEvent(event);
}

describe('keyboard fallback', () => {
  it('counts complete presses, ignores repeats, and expires the rolling flap rate', async () => {
    let now = 0;
    const target = new Target();
    const source = new KeyboardInput(target as unknown as Window, () => now);
    await source.start();
    key(target, 'keydown', 'Space');
    key(target, 'keydown', 'Space', true);
    expect(source.getState().flapCount).toBe(1);
    key(target, 'keyup', 'Space');
    key(target, 'keydown', 'Space');
    expect(source.getState().flapCount).toBe(2);
    expect(source.getState().flapRate).toBeCloseTo(2 / 3);
    now = 3000;
    expect(source.getState().flapRate).toBe(0);
    source.stop();
  });

  it('clears held controls on blur and removes listeners on stop', async () => {
    const target = new Target();
    const source = new KeyboardInput(target as unknown as Window);
    await source.start();
    key(target, 'keydown', 'ArrowLeft');
    key(target, 'keydown', 'Enter');
    expect(source.getState().strafeLeft).toBe(true);
    expect(source.getState().select).toBe(true);
    key(target, 'keyup', 'Enter');
    expect(source.getState().select).toBe(false);
    expect(source.getState().selectCount).toBe(1);
    target.dispatchEvent(new Event('blur'));
    expect(source.getState().strafeLeft).toBe(false);
    expect(source.getState().select).toBe(false);
    source.stop();
    key(target, 'keydown', 'Space');
    expect(source.getState().flapCount).toBe(0);
  });
});
