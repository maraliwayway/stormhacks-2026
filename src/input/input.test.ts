import assert from 'node:assert/strict';
import { createMenuInput, MENU } from './menuInput';
import { createKeyboardInput } from './keyboardInput';
import { EMPTY_INPUT, type InputState } from './types';

function fakeState(over: Partial<InputState> = {}): InputState {
  return { ...EMPTY_INPUT, tracking: true, calibrated: true, ...over };
}

function key(target: EventTarget, type: 'keydown' | 'keyup', k: string) {
  const e = new Event(type) as Event & { key: string };
  e.key = k;
  target.dispatchEvent(e);
}

const tests: Record<string, () => void> = {
  'menu: strafe/jump/squat fire once on the rising edge'() {
    let s = fakeState();
    const m = createMenuInput(() => s, () => 0);
    m.poll();
    s = fakeState({ strafeRight: true });
    assert.deepEqual(m.poll(), ['right']);
    assert.deepEqual(m.poll(), [], 'held pose does not repeat');
    s = fakeState();
    m.poll();
    s = fakeState({ jump: true });
    assert.deepEqual(m.poll(), ['up']);
    s = fakeState({ squat: true });
    assert.deepEqual(m.poll(), ['down']);
    s = fakeState({ strafeLeft: true });
    assert.deepEqual(m.poll(), ['left']);
  },
  'menu: one flap does not confirm, two do'() {
    let s = fakeState();
    let t = 0;
    const m = createMenuInput(() => s, () => t);
    m.poll();
    s = fakeState({ flapCount: 1 });
    t = 100;
    assert.deepEqual(m.poll(), []);
    assert.equal(m.confirmProgress(), 0.5);
    s = fakeState({ flapCount: 2 });
    t = 600;
    assert.deepEqual(m.poll(), ['confirm']);
    assert.equal(m.confirmProgress(), 0);
  },
  'menu: two flaps too far apart do not confirm'() {
    let s = fakeState();
    let t = 0;
    const m = createMenuInput(() => s, () => t);
    m.poll();
    s = fakeState({ flapCount: 1 });
    t = 100;
    m.poll();
    s = fakeState({ flapCount: 2 });
    t = 100 + MENU.confirmWindowMs + 200;
    assert.deepEqual(m.poll(), []);
  },
  'menu: flaps from before the menu opened are ignored'() {
    const s = fakeState({ flapCount: 7 });
    const m = createMenuInput(() => s, () => 0);
    assert.deepEqual(m.poll(), []);
  },
  'menu: nothing fires when not tracking or not calibrated'() {
    let s = fakeState({ tracking: false, jump: true, flapCount: 0 });
    const m = createMenuInput(() => s, () => 0);
    assert.deepEqual(m.poll(), []);
    s = fakeState({ calibrated: false, strafeLeft: true, flapCount: 5 });
    assert.deepEqual(m.poll(), []);
  },
  'keyboard: space flaps, arrows strafe, same InputState as CV'() {
    const target = new EventTarget();
    let t = 0;
    const kb = createKeyboardInput(target, () => t);
    kb.start!();
    let s = kb.getState();
    assert.equal(s.tracking, true);
    assert.equal(s.calibrated, true);

    key(target, 'keydown', ' ');
    key(target, 'keydown', ' '); // auto-repeat while held must not count again
    t = 100;
    s = kb.getState();
    assert.equal(s.flapCount, 1);
    assert.equal(s.flapping, true);
    key(target, 'keyup', ' ');

    key(target, 'keydown', 'ArrowRight');
    assert.equal(kb.getState().strafe, 1);
    assert.equal(kb.getState().strafeRight, true);
    key(target, 'keydown', 'ArrowLeft');
    assert.equal(kb.getState().strafe, 0, 'both = no strafe');
    key(target, 'keyup', 'ArrowRight');
    assert.equal(kb.getState().strafe, -1);
    key(target, 'keydown', 'w');
    assert.equal(kb.getState().jump, true);
    key(target, 'keydown', 'ArrowDown');
    assert.equal(kb.getState().squat, false, 'jump wins over squat');
    key(target, 'keyup', 'w');
    assert.equal(kb.getState().squat, true);

    t = 5000;
    assert.equal(kb.getState().flapRate, 0, 'rate decays');
    kb.stop!();
  },
  'keyboard works with the menu layer'() {
    const target = new EventTarget();
    const kb = createKeyboardInput(target, () => 0);
    kb.start!();
    const m = createMenuInput(() => kb.getState(), () => 0);
    m.poll();
    key(target, 'keydown', 'ArrowLeft');
    assert.deepEqual(m.poll(), ['left']);
    key(target, 'keyup', 'ArrowLeft');
    m.poll();
    key(target, 'keydown', ' ');
    key(target, 'keyup', ' ');
    key(target, 'keydown', ' ');
    assert.deepEqual(m.poll(), ['confirm']);
  },
};

let failed = 0;
for (const [name, fn] of Object.entries(tests)) {
  try { fn(); console.log('ok   ', name); }
  catch (e) { failed++; console.log('FAIL ', name, '\n     ', (e as Error).message); }
}
process.exit(failed ? 1 : 0);
