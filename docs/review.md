# Gameplay review

The feature branches form a stack. Review each branch against the base listed below so its diff contains one ticket. The existing input contract belongs to Mara and is reused as the starting dependency.

| Ticket | Branch | Review base | Change |
| --- | --- | --- | --- |
| FA-1 | `feat/scaffold-frontend` | `feat/input-contract` | Vite, TypeScript, Phaser canvas, folders, run steps |
| FA-7 | `feat/keyboard-fallback` | `feat/scaffold-frontend` | Keyboard source, menu confirmation, mode badge |
| FA-8 | `feat/core-vertical-scroller` | `feat/keyboard-fallback` | Flap impulses, gravity, lanes, upward camera, altitude |
| FA-9 | `feat/hazards-restart` | `feat/core-vertical-scroller` | Seeded hazards, forgiving collisions, death, flap restart |
| FA-17 | `feat/best-score` | `feat/hazards-restart` | Saved best score, dashed marker, confetti, score transport seam |
| FA-20 | `feat/enemy-behaviours` | `feat/best-score` | Static, sweeper, diver, warnings, adaptive parameter seam |
| FA-19 | `feat/game-vfx` | `feat/enemy-behaviours` | Feathers, squash, shake, near-miss slow motion, milestone pop |
| FA-25 | `feat/worm-pickups` | `feat/game-vfx` | Optional pickups, saved balance, pickup sound |
| FA-35 | `test/gameplay-smoke` | `feat/worm-pickups` | Browser integration checks and review instructions |

Merge the shared input contract through `dev` first. Retarget the next PR to `dev` as its dependency merges. Do not merge a stretch branch before the core milestone passes. No automatic merges are configured.

## Validation

- 16 unit checks cover input repeats and blur, flight tuning, lane edges, fall speed, camera direction, seeded spawning, hitboxes, near misses, event isolation, storage failures, score transport failures, enemy warnings, difficulty bounds, and pickup deduplication.
- TypeScript checks and the production build pass.
- Chromium checks cover the 16:9 canvas, a brief Enter press, gravity death, a flap restart, fake CV input through the real shared contract, ascent, camera movement, lane changes, tracking pause, window resizing, and runtime errors.
- The browser check also passes with worms enabled and verifies pickup persistence.

## Team integration still needed

Dev 1 connects the real gesture producer and calibration/menu flow to `inputManager`. The camera and pose implementation are not part of these Gameplay branches.

Dev 3 subscribes to `gameEvents` for voice and registers the actual leaderboard transport through `setScoreSink`. Network services never block the game loop.

The designer replaces the code-drawn bird, kitchen, hazard, and enemy placeholders. The optional pickup tone can be replaced with the final sound asset.

The team should tune gesture thresholds and game difficulty together on the demo laptop. The automated fake CV test proves the interface, not real camera accuracy or the target laptop's performance.
