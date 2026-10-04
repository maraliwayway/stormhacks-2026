# Flappy Arms

Flap your arms to fly a bird through a cartoon kitchen. Built for StormHacks 2026.

## Run locally

Use Node.js 22.12 or newer.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. The game uses a 1280 by 720 canvas that fits the browser while preserving its aspect ratio.

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run preview
```

For browser integration checks:

```sh
npx playwright install chromium
npm run test:browser
npm run test:camera
```

The browser test starts its own local server and checks prayer-only camera menus, release before another selection, head steering, an inert centre zone, and steering with an obscured wrist, start, flight, restart, tracking pause, and responsive sizing. The camera test loads the real local pose model in its worker, processes generated video, checks that the interface keeps updating, and verifies camera shutdown. It does not assess tracking accuracy on a person. It saves screenshots under `test-results`. Enable worms through `.env.local` to exercise the optional pickup check too.

## Team integration

`src/input/types.ts` defines the shared `InputState` and `InputSource` contract. Input producers register with `inputManager.setSource(source)`. Gameplay reads `inputManager.getState()` every frame without waiting on the camera or network.

Keyboard fallback starts by default. Space records one flap per press, arrows provide strafe/jump/squat, and Enter confirms menus. The keyboard badge hides when a CV producer replaces the source. Camera menus use a clap into a prayer pose: bring your palms together near your chest, then separate them before selecting again. Holding the pose does not skip screens. Swipes, jumps, and flaps do not select buttons. Contacts increment `selectCount`; `menuConfirmMode: "clap"` restricts camera confirmation to that counter. The same gesture returns from game over to the menu. Holding Space does not generate repeated flaps.

Keyboard confirmation also uses the optional monotonic `selectCount` field so a short Enter press is not missed between render frames. Existing CV producers do not need to provide it.

`src/game/events.ts` exposes typed `gameEvents.on(name, callback)` subscriptions. It returns an unsubscribe function. Events include `death`, `near_miss`, `new_best`, `milestone`, and `run_end`. Listener failures do not interrupt gameplay.

Dev 3 can register `setScoreSink` from `src/net/scoreSync.ts` to send finished runs to the leaderboard. No backend endpoint is configured yet. Best altitude stays available locally when the backend or browser storage is unavailable.

Dev 1 can call `setDifficulty` in `src/game/difficulty.ts` with `enemyEveryMetres`, `enemySpeed`, and weights for `static`, `sweeper`, and `diver`. The first cat waits at least five seconds of active gameplay after the first flap, and this grace period restarts on every retry. Tracking loss pauses the timer. Cat frequency also increases with total run altitude, including across map loops. With default settings, encounter spacing ramps from 24 to 12 metres and the cooldown between warning starts drops from 6 to 4 seconds over the first 600 metres, then stays capped. Both the distance and cooldown must pass before another cat appears. The legacy speed/mix fields remain accepted for producer compatibility, but do not affect the cat: its warning always lasts 2.5 seconds at every altitude. The face marks and locks the bird's current lane, then disappears as a paw strikes that lane for 350 ms. Leave the marked lane to survive; climbing alone does not evade the strike. Tracking loss freezes the encounter. Heaven remains free of cats and obstacles.

Camera turning uses your head position in the mirrored preview. Move your head into the LEFT or RIGHT zone to select one adjacent lane. Return to STAY to reset for another turn in the same direction. Returning to the centre keeps your current lane, and holding a side does not repeat. The outer 35% of each side triggers a turn, with a smaller central release zone to prevent boundary jitter. Head position is independent of the calibrated shoulder and hip positions. Shoulder tilt, hip movement, and hand swipes do not turn the camera player. Lane changes take about 170 ms. Keyboard arrows keep the same one-press, one-lane behaviour.

Head turns increment `turnLeftCount` or `turnRightCount`, so a brief side entry survives between render frames. `steeringMode: "head"` restricts turning to those counters. New runs baseline the counters, and a temporarily obscured face does not rearm a held turn. Visible paired eyes or ears can supply the head centre when the nose is obscured. If the whole face is untracked, turning pauses while visible shoulders and wrists can still support flapping.

Flaps use a small upward movement followed by a paired downward movement at any arm height. Each direction needs only 0.08 shoulder widths of travel. Hands do not need to cross shoulder height. Wrist motion is measured relative to the torso so body bobbing does not count as a flap.

Calibration needs about two seconds with your shoulders in view. Hips and feet may be outside the laptop camera view. Steering continues when a wrist is obscured. Prayer detection can also use visible finger landmarks when palms touch and hide the wrists.

Pose inference runs in a Web Worker with GPU acceleration and CPU fallback. The camera requests up to 60 fps. At most one frame is captured or processed at a time, so busy frames are skipped instead of accumulating delay. The 600 ms freshness limit allows slower laptops to deliver usable results. Gesture smoothing and confidence thresholds favour small movements. No visible shoulders or a stopped camera pauses the controls. Press D or use `/cv-test.html` to inspect camera timing and gesture counts.

For a camera playtest: calibrate with your upper body in view, bring your palms together once to select, hold them together to check that the next screen stays put, then separate and clap again. During play, move your head into LEFT, return to STAY, then enter RIGHT. Check that returning to STAY keeps the current lane and holding a side changes only one lane. Try short flaps below shoulder height. An obscured wrist should not stop steering. Leaving the camera view should pause the game. Automated tests cover these cases with generated poses and video; they do not establish accuracy for a person on the demo laptop.

Each flap adds a 700 px/s upward impulse, with upward speed capped at 1000 px/s. One flap from rest lifts roughly 7.7 metres. Faster flapping travels farther, while the bird falls at no more than 150 px/s. Horizontal movement stops at the selected lane.

## Optional worm pickups

Copy `.env.example` to `.env.local`, set `VITE_ENABLE_WORMS=true`, and restart Vite to try it. Leave it off until the team's M3 core milestone passes. Worms appear beside hazards, play a short pickup sound, and save the total locally. The sound is an original generated tone that the designer can replace.

The bird, kitchen, hazards, and enemies use code-drawn placeholders. Webcam tracking is integrated. Final art, voice playback, and the backend transport remain team integration work.

| Folder | Owner / purpose |
| --- | --- |
| `src/input` | Shared contract and input sources |
| `src/input/cv` | Camera tracking, calibration, and gesture detection |
| `src/game/scenes` | Phaser scenes, Dev 2 |
| `src/net` | Backend connection, Dev 3 |
| `public/assets` | Art and audio from the designer |

## Review workflow

One branch and pull request per ticket. Use commit titles such as `feat(FA-1): scaffold the Phaser frontend`. Describe the behavior, validation, and dependencies in each PR. Confirm the integration target with the team before merging.

## Code conventions

The TypeScript style is adapted from AleaSat ground software's [Biome configuration](https://github.com/jumiknows/Aleasat-Mission-Software/blob/main/alea-gsw/biome.json) and [contributor guidance](https://github.com/jumiknows/Aleasat-Mission-Software/blob/main/alea-gsw/CONTRIBUTING.md). The pinned Biome version matches that reference. This Vite project uses extensionless imports, like AleaSat's frontend override, and also requires braces around control-flow blocks.

Run `npm run lint:fix` before reviewing a change. `npm run lint` checks formatting, imports, naming, unused variables, and the configured correctness rules. CI runs those checks, unit tests, and the production build. Keep functions focused on one responsibility; use descriptive camelCase names, PascalCase types/classes, and CONSTANT_CASE configuration. Name time units explicitly, keep tuning values in their configuration modules, and explain non-obvious behavior rather than restating the code.

| Module | Responsibility |
| --- | --- |
| `src/game/scenes/GameScene.ts` | Run lifecycle and ordered frame updates |
| `src/game/rendering` | Bird, obstacles, cat, and background drawing |
| `src/game/flight.ts` | Movement physics and lane selection |
| `src/game/hazards.ts`, `enemies.ts`, `difficulty.ts` | Safe obstacle generation, cat encounters, and pacing |
| `src/input/cv/poseTracker.ts`, `poseWorker.ts` | Camera lifecycle, frame freshness, and background pose inference |
| `src/input/cv/gestureDetector.ts` | Pose smoothing and gesture coordination |
| `src/input/cv/flapDetector.ts`, `prayerDetector.ts`, `headSteering.ts`, `bodyGestureDetector.ts` | Independent gesture recognition |
| `src/input/cv/gestureConfig.ts`, `gestureTypes.ts` | Gesture tuning, calibration, and typed pose/state contracts |

Keep `InputState`, the gesture factory exports, game event payloads, and the difficulty/score integration contracts compatible with other developers' code. Hazard advancement takes named options such as `{ birdY, suppressObstacles }` so the caller's intent is visible. A cleanup should preserve seeded obstacle order, gesture counts across tracking loss, collision timing, and map-loop progress. Run the browser smoke test for changes to those paths; it can exercise optional pickups with `VITE_ENABLE_WORMS=true npm run test:browser`.

## Storyboard flow

Bring your palms together in camera mode, press Enter in keyboard mode, or click Start to see the controls. Confirm again to fly. Space flaps in keyboard mode and left/right arrows change lanes. After a death, bring your palms together to return to the menu in camera mode. Keyboard players can flap to retry or jump/Enter to return to the menu. Heaven continues into the next circuit without a victory screen.

Kitchen runs from 0 to 60 metres, Dessert from 60 to 120, and Bird Heaven from 120 to 150. At 150 metres the map returns to Kitchen and repeats this circuit indefinitely. These distances live in `src/game/levels.ts`. Altitude, score, pickups and difficulty carry across every loop. Each level starts with a lift boost. Heaven has scrolling clouds, a golden halo and a clear flight path for a short breather. Keep flapping to avoid falling. `level_start` includes Heaven and fires on every transition. Reaching Heaven does not end the run or emit `win`. Death ends the run and submits its accumulated score.

The browser game targets a laptop. Native desktop packaging, slots, inventory, powerups, final art, and live encouragement need their respective team integrations. Multiplayer and daily streaks are excluded as shown in the MVP storyboard. The designer's reference calls for clean 2D shapes, bright contrasting colours, and medium pencil-textured outlines. Current art is drawn placeholder art with medium outlines; final texture assets come from the designer.

## Gentle obstacle pacing

Map obstacles appear one at a time, with rows 900 px apart. The next obstacle waits for the previous one to leave the screen. Every new obstacle has at least 2500 px of clear distance from the bird, enough for 2.5 seconds at the maximum climb speed. An advance marker and lane hint show which lane is blocked while the obstacle is still offscreen. Rows that would spawn too close are skipped, including after cats and map transitions. Cat encounters clear all map obstacles so only one threat is active. The cat face warns for 2.5 seconds before the paw strikes, even at high altitude. Skipped rows stay skipped after the paw retreats; later obstacles resume normally. Difficulty still needs a short arm-flapping playtest on the demo laptop.
