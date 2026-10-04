/**
 * Snapshot of player input, read by the game every frame.
 * Produced by CV (cv/cvInput.ts) or keyboard (keyboardInput.ts).
 * Plain data only: no methods, no React state.
 */
export interface InputState {
    /** True while the player is in an active flapping motion (both arms). */
    flapping: boolean;
  
    /**
     * Flap intensity, 0 when idle.
     * CV: smoothed vertical wrist speed in shoulder-widths per second.
     * Keyboard: fixed value (e.g. 1) while Space is held.
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
  
    /** True while hip midpoint is left of calibrated center. */
    strafeLeft: boolean;
  
    /** True while hip midpoint is right of calibrated center. */
    strafeRight: boolean;
  
    /** True while in the jump pose. */
    jump: boolean;
  
    /** True while in the squat pose. */
    squat: boolean;
  
    /** False when no body is detected. Keyboard source: always true. */
    tracking: boolean;
  
    /** True once calibration baseline is captured. Keyboard source: always true. */
    calibrated: boolean;
    /** Optional menu confirmation. Older gesture producers remain compatible. */
    select?: boolean;
    /** Optional monotonic confirmations, so short key presses survive a render frame. */
    selectCount?: number;
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
    strafeLeft: false,
    strafeRight: false,
    jump: false,
    squat: false,
    tracking: false,
    calibrated: false,
  };
