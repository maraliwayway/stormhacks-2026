import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  CAL,
  type CalPoint,
  bodyInFrame,
  createCalibrator,
  createLostBodyMonitor,
} from "./calibration";
import { L } from "./landmarks";

const FRAME = 33;

function body(
  o: { hipX?: number; hipY?: number; drop?: number[]; vis?: number } = {},
): CalPoint[] {
  const lm: CalPoint[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    visibility: 1,
  }));
  const hx = o.hipX ?? 0.5;
  const hy = o.hipY ?? 0.55;
  lm[L.SHOULDER_L] = { x: 0.4, y: 0.3, visibility: 1 };
  lm[L.SHOULDER_R] = { x: 0.6, y: 0.3, visibility: 1 };
  lm[L.HIP_L] = { x: hx - 0.08, y: hy, visibility: 1 };
  lm[L.HIP_R] = { x: hx + 0.08, y: hy, visibility: 1 };
  lm[L.KNEE_L] = { x: 0.45, y: 0.75, visibility: 1 };
  lm[L.KNEE_R] = { x: 0.55, y: 0.75, visibility: 1 };
  lm[L.ANKLE_L] = { x: 0.45, y: 0.93, visibility: 1 };
  lm[L.ANKLE_R] = { x: 0.55, y: 0.93, visibility: 1 };
  for (const i of o.drop ?? []) {
    lm[i] = { ...lm[i], visibility: o.vis ?? 0.1 };
  }
  return lm;
}

const tests: Record<string, () => void> = {
  "bodyInFrame: full body yes, null no"() {
    assert.equal(bodyInFrame(body()), true);
    assert.equal(bodyInFrame(null), false);
  },
  "bodyInFrame: hidden ankles or cut-off at the edge = no"() {
    assert.equal(bodyInFrame(body({ drop: [L.ANKLE_L] })), false);
    const lm = body();
    lm[L.ANKLE_R] = { x: 0.55, y: 1.02, visibility: 1 };
    assert.equal(bodyInFrame(lm), false);
  },
  "captures baseline after ~2 s of a still body"() {
    const c = createCalibrator();
    c.start();
    let t = 0;
    let s = c.update(body(), t);
    assert.equal(s.phase, "capturing");
    while (s.phase !== "done" && t < 5000) {
      t += FRAME;
      s = c.update(body(), t);
    }
    assert.equal(s.phase, "done");
    assert.ok(t >= CAL.captureMs && t < CAL.captureMs + 100, `took ${t} ms`);
    const cal = s.calibration!;
    assert.ok(Math.abs(cal.shoulderWidth - 0.2) < 1e-9);
    assert.ok(
      Math.abs(cal.hipX - 0.5) < 1e-9 && Math.abs(cal.hipY - 0.55) < 1e-9,
    );
    assert.ok(Math.abs(cal.shoulderY - 0.3) < 1e-9);
    assert.ok(Math.abs(cal.shoulderX! - 0.5) < 1e-9);
  },
  "waits (no capture) while body not in frame; losing it mid-capture restarts"() {
    const c = createCalibrator();
    c.start();
    let s = c.update(body({ drop: [L.ANKLE_L] }), 0);
    assert.equal(s.phase, "waiting");
    s = c.update(body(), 100);
    assert.equal(s.phase, "capturing");
    s = c.update(body(), 1500);
    assert.ok(s.progress > 0.5);
    s = c.update(body({ drop: [L.KNEE_L] }), 1600);
    assert.equal(s.phase, "waiting");
    s = c.update(body(), 1700);
    assert.equal(s.phase, "capturing");
    assert.equal(s.progress, 0);
  },
  "moving during capture does not calibrate; retries and succeeds once still"() {
    const c = createCalibrator();
    c.start();
    let t = 0;
    let s = c.update(body(), t);
    for (; t < CAL.captureMs + FRAME; t += FRAME) {
      s = c.update(body({ hipX: 0.3 + (t / CAL.captureMs) * 0.4 }), t); // walking sideways
    }
    assert.notEqual(s.phase, "done");
    for (let i = 0; i < 100 && s.phase !== "done"; i++) {
      t += FRAME;
      s = c.update(body({ hipX: 0.5 }), t);
    }
    assert.equal(s.phase, "done");
  },
  "start() again recalibrates but keeps the old baseline until the new one is done"() {
    const c = createCalibrator();
    c.start();
    let s = c.update(body(), 0);
    for (let t = FRAME; s.phase !== "done"; t += FRAME) {
      s = c.update(body(), t);
    }
    const old = s.calibration;
    c.start();
    s = c.update(body({ hipX: 0.6 }), 10000);
    assert.equal(s.phase, "capturing");
    assert.equal(s.calibration, old);
  },
  "lost-body monitor: prompts after 2 s, resets on return"() {
    const m = createLostBodyMonitor();
    assert.equal(m.update(true, 0), false);
    assert.equal(m.update(false, 100), false);
    assert.equal(m.update(false, 1900), false);
    assert.equal(m.update(false, 2200), true);
    assert.equal(m.update(true, 2300), false);
    assert.equal(m.update(false, 2400), false);
  },
};

describe("calibration", () => {
  for (const [name, fn] of Object.entries(tests)) {
    it(name, fn);
  }
});
