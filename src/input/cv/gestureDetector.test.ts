import assert from 'node:assert/strict';
import { createGestureDetector, DEFAULT_CALIBRATION as C } from './gestureDetector';
import { L } from './landmarks';

const FRAME = 33; // ms, ~30 fps

interface Pose { wristY: number; hipX: number; hipY: number }
const standing: Pose = { wristY: 0.6, hipX: C.hipX, hipY: C.hipY };

function pose(p: Partial<Pose> = {}) {
  const v = { ...standing, ...p };
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5 }));
  const hs = C.shoulderWidth / 2;
  lm[L.SHOULDER_L] = { x: 0.5 - hs, y: C.shoulderY };
  lm[L.SHOULDER_R] = { x: 0.5 + hs, y: C.shoulderY };
  lm[L.WRIST_L] = { x: 0.4, y: v.wristY };
  lm[L.WRIST_R] = { x: 0.6, y: v.wristY };
  lm[L.HIP_L] = { x: v.hipX - hs, y: v.hipY };
  lm[L.HIP_R] = { x: v.hipX + hs, y: v.hipY };
  return lm;
}

/** Feed `ms` of a pose that moves linearly from `from` to `to`. Returns the last state. */
function run(d: ReturnType<typeof createGestureDetector>, t: { now: number }, from: Partial<Pose>, to: Partial<Pose>, ms: number) {
  const f0 = { ...standing, ...from };
  const f1 = { ...standing, ...to };
  const n = Math.max(1, Math.round(ms / FRAME));
  let s = d.update(pose(f0), t.now, C);
  for (let i = 1; i <= n; i++) {
    const k = i / n;
    t.now += FRAME;
    s = d.update(pose({
      wristY: f0.wristY + (f1.wristY - f0.wristY) * k,
      hipX: f0.hipX + (f1.hipX - f0.hipX) * k,
      hipY: f0.hipY + (f1.hipY - f0.hipY) * k,
    }), t.now, C);
  }
  return s;
}

function fresh() {
  const d = createGestureDetector();
  const t = { now: 1000 };
  run(d, t, {}, {}, 500); // settle filters
  return { d, t };
}

const flap = (d: ReturnType<typeof createGestureDetector>, t: { now: number }, downMs: number) => {
  run(d, t, { wristY: 0.6 }, { wristY: 0.1 }, 200); // up
  return run(d, t, { wristY: 0.1 }, { wristY: 0.6 }, downMs); // down
};

const tests: Record<string, () => void> = {
  'idle: nothing fires'() {
    const { d, t } = fresh();
    const s = run(d, t, {}, {}, 1000);
    assert.equal(s.tracking, true);
    assert.deepEqual([s.flapCount, s.strafeLeft, s.strafeRight, s.jump, s.squat], [0, false, false, false, false]);
  },
  'fast arms up/down = 1 flap, fires on the downstroke'() {
    const { d, t } = fresh();
    const up = run(d, t, { wristY: 0.6 }, { wristY: 0.1 }, 200);
    assert.equal(up.flapCount, 0, 'raising arms must not count');
    const down = run(d, t, { wristY: 0.1 }, { wristY: 0.6 }, 200);
    assert.equal(down.flapCount, 1);
    assert.equal(down.flapping, true);
  },
  'slow arm drop (>400 ms) is not a flap'() {
    const { d, t } = fresh();
    run(d, t, { wristY: 0.6 }, { wristY: 0.1 }, 200);
    run(d, t, { wristY: 0.1 }, { wristY: 0.1 }, 600); // hold above
    const s = run(d, t, { wristY: 0.1 }, { wristY: 0.6 }, 2500);
    assert.equal(s.flapCount, 0);
  },
  'flapRate over 3 s window'() {
    const { d, t } = fresh();
    let s = d.update(pose(), t.now, C);
    for (let i = 0; i < 3; i++) s = flap(d, t, 200);
    assert.equal(s.flapCount, 3);
    assert.ok(s.flapRate > 0.9 && s.flapRate <= 1.0, `flapRate ${s.flapRate}`);
    s = run(d, t, {}, {}, 4000);
    assert.equal(s.flapRate, 0, 'rate decays when player stops');
    assert.equal(s.flapCount, 3, 'flapCount never decreases');
  },
  'strafe left = hips to larger image x, with hysteresis'() {
    const { d, t } = fresh();
    const edge = C.shoulderWidth * 0.35;
    let s = run(d, t, {}, { hipX: C.hipX + edge * 1.3 }, 300);
    assert.equal(s.strafeLeft, true);
    assert.equal(s.strafeRight, false);
    s = run(d, t, { hipX: C.hipX + edge * 1.3 }, { hipX: C.hipX + edge * 0.8 }, 300); // inside enter, outside exit
    assert.equal(s.strafeLeft, true, 'hysteresis keeps it on');
    s = run(d, t, { hipX: C.hipX + edge * 0.8 }, {}, 400);
    assert.equal(s.strafeLeft, false);
  },
  'analog strafe is proportional, signed, and has a deadzone'() {
    const { d, t } = fresh();
    const sw = C.shoulderWidth;
    let s = run(d, t, {}, { hipX: C.hipX - sw * 0.05 }, 600);
    assert.equal(s.strafe, 0, 'inside deadzone');
    s = run(d, t, { hipX: C.hipX - sw * 0.05 }, { hipX: C.hipX - sw * 0.25 }, 600);
    assert.ok(s.strafe > 0.1 && s.strafe < 0.5, `slight right ${s.strafe}`);
    assert.equal(s.strafeRight, false, 'boolean not on yet');
    s = run(d, t, { hipX: C.hipX - sw * 0.25 }, { hipX: C.hipX - sw * 0.8 }, 600);
    assert.equal(s.strafe, 1);
    s = run(d, t, { hipX: C.hipX - sw * 0.8 }, { hipX: C.hipX + sw * 0.8 }, 900);
    assert.equal(s.strafe, -1, 'left is negative');
  },
  'strafe right'() {
    const { d, t } = fresh();
    const s = run(d, t, {}, { hipX: C.hipX - C.shoulderWidth * 0.5 }, 300);
    assert.equal(s.strafeRight, true);
    assert.equal(s.strafeLeft, false);
  },
  'jump needs height AND upward speed'() {
    const a = fresh();
    const rise = C.shoulderWidth * 0.4;
    let s = run(a.d, a.t, {}, { hipY: C.hipY - rise }, 150); // fast
    assert.equal(s.jump, true);
    s = run(a.d, a.t, { hipY: C.hipY - rise }, {}, 300);
    assert.equal(s.jump, false);

    const b = fresh();
    s = run(b.d, b.t, {}, { hipY: C.hipY - rise }, 3000); // slow lean/drift
    assert.equal(s.jump, false);
  },
  'squat'() {
    const { d, t } = fresh();
    const s = run(d, t, {}, { hipY: C.hipY + C.shoulderWidth * 0.55 }, 400);
    assert.equal(s.squat, true);
    assert.equal(s.jump, false);
  },
  'lost body: tracking false, everything released, recovers'() {
    const { d, t } = fresh();
    run(d, t, {}, { hipX: C.hipX + 0.2 }, 300);
    t.now += FRAME;
    let s = d.update(null, t.now, C);
    assert.equal(s.tracking, false);
    assert.equal(s.strafeLeft, false);
    s = run(d, t, {}, {}, 300);
    assert.equal(s.tracking, true);
  },
};

let failed = 0;
for (const [name, fn] of Object.entries(tests)) {
  try { fn(); console.log('ok   ', name); }
  catch (e) { failed++; console.log('FAIL ', name, '\n     ', (e as Error).message); }
}
process.exit(failed ? 1 : 0);
