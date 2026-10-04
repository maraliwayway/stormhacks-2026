// Owner: Dev 1. Ticket: "Gesture state machine: flap, strafe, jump, squat".
// First-pass implementation of docs/gesture-spec.md. Tune with real players.

import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { InputState, type Gesture, type Lane } from "../shared/InputState";
import type { Baseline } from "./Calibration";
import { isFullBodyVisible } from "./Calibration";
import { OneEuroFilter } from "./OneEuroFilter";
import { FILTER, LM, THRESHOLDS } from "./thresholds";

type FlapPhase = "down" | "up";

export class GestureDetector {
  private filters = new Map<string, OneEuroFilter>();
  private lastFired = new Map<Gesture, number>();
  private flapPhase: FlapPhase = "down";
  private flapUpAt = 0;
  private prevHipY?: number;
  private prevT?: number;
  private lane: Lane = 0;

  constructor(private baseline: Baseline) {}

  setBaseline(b: Baseline): void {
    this.baseline = b;
    this.filters.clear();
  }

  update(raw: NormalizedLandmark[] | null, tMs: number): void {
    InputState.bodyVisible = !!raw && isFullBodyVisible(raw);
    if (!raw || !InputState.bodyVisible) return;

    const p = (i: number) => ({ x: this.smooth(`${i}x`, raw[i].x, tMs), y: this.smooth(`${i}y`, raw[i].y, tMs) });
    const ls = p(LM.L_SHOULDER), rs = p(LM.R_SHOULDER);
    const lw = p(LM.L_WRIST), rw = p(LM.R_WRIST);
    const lh = p(LM.L_HIP), rh = p(LM.R_HIP);

    const sw = this.baseline.shoulderWidth;
    const shoulderY = (ls.y + rs.y) / 2;
    const hipX = (lh.x + rh.x) / 2;
    const hipY = (lh.y + rh.y) / 2;

    this.detectFlap(lw.y, rw.y, shoulderY, tMs);
    this.detectStrafe(hipX, sw);
    this.detectJumpSquat(hipY, sw, tMs);
  }

  // Flap fires on the downstroke: both wrists above shoulders, then both below, within the window.
  private detectFlap(lwY: number, rwY: number, shoulderY: number, tMs: number): void {
    const bothUp = lwY < shoulderY && rwY < shoulderY;
    const bothDown = lwY > shoulderY && rwY > shoulderY;
    if (this.flapPhase === "down" && bothUp) {
      this.flapPhase = "up";
      this.flapUpAt = tMs;
    } else if (this.flapPhase === "up" && bothDown) {
      this.flapPhase = "down";
      if (tMs - this.flapUpAt <= THRESHOLDS.flapWindowMs) this.fire("flap", tMs);
    }
  }

  // Mirror x: the webcam image is not flipped, so the player's left is image right.
  private detectStrafe(hipX: number, sw: number): void {
    const offset = (this.baseline.hipX - hipX) / sw;
    const { strafeOffset: t, strafeHysteresis: h } = THRESHOLDS;
    let next: Lane = this.lane;
    if (this.lane === 0) next = offset < -t ? -1 : offset > t ? 1 : 0;
    else if (this.lane === -1 && offset > -(t - h)) next = 0;
    else if (this.lane === 1 && offset < t - h) next = 0;
    if (next !== this.lane) {
      this.lane = next;
      InputState.setLane(next, "pose");
    }
  }

  private detectJumpSquat(hipY: number, sw: number, tMs: number): void {
    const rise = (this.baseline.hipY - hipY) / sw; // positive = higher than baseline
    let velocity = 0;
    if (this.prevHipY !== undefined && this.prevT !== undefined) {
      const dt = Math.max((tMs - this.prevT) / 1000, 1e-3);
      velocity = (this.prevHipY - hipY) / sw / dt;
    }
    this.prevHipY = hipY;
    this.prevT = tMs;

    if (rise > THRESHOLDS.jumpRise && velocity > THRESHOLDS.jumpMinVelocity) this.fire("jump", tMs);
    if (-rise > THRESHOLDS.squatDrop) this.fire("squat", tMs);
  }

  private fire(g: Gesture, tMs: number): void {
    const last = this.lastFired.get(g) ?? -Infinity;
    if (tMs - last < THRESHOLDS.refractoryMs) return;
    this.lastFired.set(g, tMs);
    InputState.emit(g, "pose");
  }

  private smooth(key: string, v: number, tMs: number): number {
    let f = this.filters.get(key);
    if (!f) {
      f = new OneEuroFilter(FILTER.minCutoff, FILTER.beta, FILTER.dCutoff);
      this.filters.set(key, f);
    }
    return f.filter(v, tMs);
  }
}
