// Owner: Dev 2. Gameplay tuning knobs. Keep magic numbers here, not in scenes.

export const WIDTH = 1280;
export const HEIGHT = 720;

export const PHYSICS = {
  gravity: 900,            // px/s^2
  flapImpulse: -420,       // px/s, applied per flap
  maxFallSpeed: 650,       // terminal velocity
  laneX: [WIDTH / 2 - 260, WIDTH / 2, WIDTH / 2 + 260] as const,
  laneLerp: 0.18,          // 0..1 per frame, snappy but eased
  hitboxScale: 0.8,        // forgiving hitboxes (20% smaller than sprite)
};

export const SCORING = {
  pxPerMetre: 10,
  milestoneEveryM: 100,
};

export const TIMING = {
  deathSlowMoMs: 600,
  restartLockoutMs: 400,   // ignore flaps right after death so a dying flap does not restart
};
