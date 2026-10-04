import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { FLIGHT } from "../../game/flight";
import {
  DEFAULT_CALIBRATION as C,
  createGestureDetector,
} from "./gestureDetector";
import { L } from "./landmarks";

const FRAME = 33; // ms, ~30 fps

interface Pose {
  wristY: number;
  wristRx: number;
  hipX: number;
  hipY: number;
}
const standing: Pose = {
  wristY: 0.6,
  wristRx: 0.6,
  hipX: C.hipX,
  hipY: C.hipY,
};

function pose(p: Partial<Pose> = {}) {
  const v = { ...standing, ...p };
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5 }));
  const hs = C.shoulderWidth / 2;
  lm[L.SHOULDER_L] = { x: 0.5 - hs, y: C.shoulderY };
  lm[L.SHOULDER_R] = { x: 0.5 + hs, y: C.shoulderY };
  lm[L.WRIST_L] = { x: 0.4, y: v.wristY };
  lm[L.WRIST_R] = { x: v.wristRx, y: v.wristY };
  lm[L.HIP_L] = { x: v.hipX - hs, y: v.hipY };
  lm[L.HIP_R] = { x: v.hipX + hs, y: v.hipY };
  return lm;
}

/** Feed `ms` of a pose that moves linearly from `from` to `to`. Returns the last state. */
function run(
  d: ReturnType<typeof createGestureDetector>,
  t: { now: number },
  from: Partial<Pose>,
  to: Partial<Pose>,
  ms: number,
) {
  const f0 = { ...standing, ...from };
  const f1 = { ...standing, ...to };
  const n = Math.max(1, Math.round(ms / FRAME));
  let s = d.update(pose(f0), t.now, C);
  for (let i = 1; i <= n; i++) {
    const k = i / n;
    t.now += FRAME;
    s = d.update(
      pose({
        wristY: f0.wristY + (f1.wristY - f0.wristY) * k,
        wristRx: f0.wristRx + (f1.wristRx - f0.wristRx) * k,
        hipX: f0.hipX + (f1.hipX - f0.hipX) * k,
        hipY: f0.hipY + (f1.hipY - f0.hipY) * k,
      }),
      t.now,
      C,
    );
  }
  return s;
}

function fresh() {
  const d = createGestureDetector();
  const t = { now: 1000 };
  run(d, t, {}, {}, 500); // settle filters
  return { d, t };
}

const flap = (
  d: ReturnType<typeof createGestureDetector>,
  t: { now: number },
  downMs: number,
) => {
  run(d, t, { wristY: 0.6 }, { wristY: 0.1 }, 200); // up
  return run(d, t, { wristY: 0.1 }, { wristY: 0.6 }, downMs); // down
};

const tests: Record<string, () => void> = {
  "calibrated resting torso tilt and small shoulder jitter do not steer"() {
    const d = createGestureDetector();
    const cal = { ...C, shoulderX: C.hipX + 0.05 };
    for (let i = 0; i < 60; i++) {
      const lm = pose();
      const offset = 0.05 + Math.sin(i) * C.shoulderWidth * 0.04;
      lm[L.SHOULDER_L].x += offset;
      lm[L.SHOULDER_R].x += offset;
      const s = d.update(lm, 1000 + i * FRAME, cal);
      assert.ok(
        Math.abs(s.strafe) < FLIGHT.laneEnter,
        "jitter stays below the lane threshold",
      );
    }
  },
  "one arm alone cannot flap, and losing tracking clears a half-finished stroke"() {
    const { d, t } = fresh();
    for (const y of [0.2, 0.2, 0.2, 0.38, 0.5, 0.6]) {
      t.now += FRAME;
      const lm = pose();
      lm[L.WRIST_L].y = y;
      assert.equal(d.update(lm, t.now, C).flapCount, 0);
    }
    run(d, t, {}, { wristY: 0.1 }, 200);
    t.now += FRAME;
    d.update(null, t.now, C);
    t.now += FRAME;
    assert.equal(d.update(pose({ wristY: 0.6 }), t.now, C).flapCount, 0);
  },
  "a comfortable downstroke fires near the shoulder line without waiting for arms to reach the hips"() {
    const { d, t } = fresh();
    const upY = C.shoulderY - C.shoulderWidth * 0.4;
    const downY = C.shoulderY + C.shoulderWidth * 0.12;
    run(d, t, {}, { wristY: upY }, 200);
    const s = run(d, t, { wristY: upY }, { wristY: downY }, 100);
    assert.equal(s.flapCount, 1);
    assert.equal(
      run(d, t, { wristY: downY }, { wristY: downY }, 500).flapCount,
      1,
      "holding arms down does not repeat",
    );
  },
  "counts every flap at four flaps per second"() {
    const { d, t } = fresh();
    const upY = C.shoulderY - C.shoulderWidth * 0.5;
    const downY = C.shoulderY + C.shoulderWidth * 0.5;
    for (let i = 0; i < 8; i++) {
      run(d, t, { wristY: downY }, { wristY: upY }, 125);
      const s = run(d, t, { wristY: upY }, { wristY: downY }, 125);
      assert.equal(s.flapCount, i + 1);
    }
  },
  "small shoulder-line jitter neither steers nor creates flaps"() {
    const { d, t } = fresh();
    for (let i = 0; i < 90; i++) {
      t.now += FRAME;
      const jitter = Math.sin(i * 2) * C.shoulderWidth * 0.04;
      const s = d.update(
        pose({ wristY: C.shoulderY + jitter, hipX: C.hipX + jitter }),
        t.now,
        C,
      );
      assert.equal(s.flapCount, 0);
      assert.ok(
        Math.abs(s.strafe) < FLIGHT.laneEnter,
        "jitter stays below the lane threshold",
      );
    }
  },
  "idle: nothing fires"() {
    const { d, t } = fresh();
    const s = run(d, t, {}, {}, 1000);
    assert.equal(s.tracking, true);
    assert.deepEqual(
      [s.flapCount, s.strafeLeft, s.strafeRight, s.jump, s.squat],
      [0, false, false, false, false],
    );
  },
  "fast arms up/down = 1 flap, fires on the downstroke"() {
    const { d, t } = fresh();
    const up = run(d, t, { wristY: 0.6 }, { wristY: 0.1 }, 200);
    assert.equal(up.flapCount, 0, "raising arms must not count");
    const down = run(d, t, { wristY: 0.1 }, { wristY: 0.6 }, 200);
    assert.equal(down.flapCount, 1);
    assert.equal(down.flapping, true);
  },
  "a gentle two-arm downstroke still counts once"() {
    const { d, t } = fresh();
    run(d, t, { wristY: 0.6 }, { wristY: 0.1 }, 200);
    run(d, t, { wristY: 0.1 }, { wristY: 0.1 }, 600); // hold above
    const s = run(d, t, { wristY: 0.1 }, { wristY: 0.6 }, 2500);
    assert.equal(s.flapCount, 1);
  },
  "flapRate over 3 s window"() {
    const { d, t } = fresh();
    let s = d.update(pose(), t.now, C);
    for (let i = 0; i < 3; i++) {
      s = flap(d, t, 200);
    }
    assert.equal(s.flapCount, 3);
    assert.ok(s.flapRate > 0.9 && s.flapRate <= 1.0, `flapRate ${s.flapRate}`);
    s = run(d, t, {}, {}, 4000);
    assert.equal(s.flapRate, 0, "rate decays when player stops");
    assert.equal(s.flapCount, 3, "flapCount never decreases");
  },
  "one horizontal swipe with either hand counts once in its preview direction"() {
    for (const side of [L.WRIST_L, L.WRIST_R]) {
      for (const direction of [-1, 1]) {
        const { d, t } = fresh();
        let state!: ReturnType<typeof d.update>;
        for (let i = 0; i <= 12; i++) {
          const lm = pose();
          lm[side] = {
            x: 0.5 + direction * (0.15 - i * 0.025),
            y: C.shoulderY,
          };
          t.now += FRAME;
          state = d.update(lm, t.now, C);
        }
        assert.equal(state.swipeRightCount, direction === 1 ? 1 : 0);
        assert.equal(state.swipeLeftCount, direction === -1 ? 1 : 0);
        assert.equal(state.flapCount, 0);
        for (let i = 0; i < 60; i++) {
          const lm = pose();
          lm[side] = { x: 0.5 - direction * 0.15, y: C.shoulderY };
          t.now += FRAME;
          state = d.update(lm, t.now, C);
        }
        assert.equal(
          state.swipeRightCount + state.swipeLeftCount,
          1,
          "holding the endpoint cannot repeat",
        );
      }
    }
  },
  "small waves, stationary hands, jitter and flapping cannot confirm"() {
    const { d, t } = fresh();
    for (let i = 0; i < 90; i++) {
      const lm = pose();
      lm[L.WRIST_R] = { x: 0.62 + Math.sin(i / 4) * 0.04, y: C.shoulderY };
      t.now += FRAME;
      assert.equal(d.update(lm, t.now, C).swipeRightCount, 0);
    }
    const flapper = fresh();
    for (let i = 0; i < 3; i++) {
      assert.equal(flap(flapper.d, flapper.t, 200).swipeRightCount, 0);
    }
  },
  "tracking loss clears an unfinished swipe without replaying it on return"() {
    const { d, t } = fresh();
    for (const x of [0.65, 0.65, 0.65, 0.6, 0.55, 0.5]) {
      const lm = pose();
      lm[L.WRIST_R] = { x, y: C.shoulderY };
      t.now += FRAME;
      assert.equal(d.update(lm, t.now, C).swipeRightCount, 0);
    }
    t.now += FRAME;
    d.update(null, t.now, C);
    const lm = pose();
    lm[L.WRIST_R] = { x: 0.35, y: C.shoulderY };
    t.now += FRAME;
    assert.equal(d.update(lm, t.now, C).swipeRightCount, 0);
  },
  "jump needs height AND upward speed"() {
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
  squat() {
    const { d, t } = fresh();
    const s = run(d, t, {}, { hipY: C.hipY + C.shoulderWidth * 0.55 }, 400);
    assert.equal(s.squat, true);
    assert.equal(s.jump, false);
  },
  "lost body: tracking false, everything released, recovers"() {
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

describe("gesture detector", () => {
  for (const [name, fn] of Object.entries(tests)) {
    it(name, fn);
  }
});
