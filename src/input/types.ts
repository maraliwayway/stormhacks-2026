/**
 * Snapshot of player input, read by the game every frame.
 * Produced by the camera (cv/cvInput.ts); tests drive it with scripted poses.
 * Plain data only: no methods, no React state.
 */
export interface InputState {
  /** True while the player is in an active flapping motion (both arms). */
  flapping: boolean;

  /**
   * Flap intensity, 0 when idle.
   * CV: smoothed vertical wrist speed in shoulder-widths per second.
   */
  flapVelocity: number;

  /**
   * Total completed flaps (downstrokes) this session. Only ever increases.
   * Game reacts to the difference:
   *   if (s.flapCount > last) { lift(); last = s.flapCount; }
   */
  flapCount: number;

  /** Flaps per second over a rolling 3 s window. Used by difficulty + voice. */
  flapRate: number;

  /**
   * Analog strafe, -1 (fully left) .. 0 (centre) .. +1 (fully right).
   * Camera: the head's side zone in the mirrored preview. The centre is inert.
   * Head steering uses turn counters to preserve short movements between render frames.
   */
  strafe: number;

  /** True while the camera head is in the left zone. */
  strafeLeft: boolean;

  /** True while the camera head is in the right zone. */
  strafeRight: boolean;

  /** True while in the jump pose. */
  jump: boolean;

  /** True while in the squat pose. */
  squat: boolean;

  /** False when no body is detected. */
  tracking: boolean;

  /** True once calibration baseline is captured. */
  calibrated: boolean;
  /** Optional menu confirmation. Older gesture producers remain compatible. */
  select?: boolean;
  /** Monotonic prayer contacts, so a brief one survives between render frames. */
  selectCount?: number;
  /** Camera menus use hands-together contacts; legacy swipe producers remain compatible. */
  menuConfirmMode?: "clap" | "swipe" | "press";
  /** Completed directional swipes. Counters preserve brief gestures between render frames. */
  swipeLeftCount?: number;
  swipeRightCount?: number;
  lastSwipeDirection?: -1 | 0 | 1;
  /** Suppress tilt-induced lane changes while a hand is making a deliberate swipe. */
  swipeInProgress?: boolean;
  /** Head producers turn only through these counters; other producers keep legacy controls. */
  steeringMode?: "head";
  /** Horizontal head position (0..1) in the mirrored preview, null while untracked. */
  headPosition?: number | null;
  turnLeftCount?: number;
  turnRightCount?: number;
  lastTurnDirection?: -1 | 0 | 1;
}

export interface InputSource {
  /** Called every frame by the game. Must be cheap; never throw or await. */
  getState(): Readonly<InputState>;
  start?(): Promise<void>;
  stop?(): void;
}

export const EMPTY_INPUT: Readonly<InputState> = {
  flapping: false,
  flapVelocity: 0,
  flapCount: 0,
  flapRate: 0,
  strafe: 0,
  strafeLeft: false,
  strafeRight: false,
  jump: false,
  squat: false,
  tracking: false,
  calibrated: false,
};
