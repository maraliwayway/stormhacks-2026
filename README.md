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
npm run typecheck
npm test
npm run build
npm run preview
```

For browser integration checks:

```sh
npx playwright install chromium
npm run test:browser
```

The browser test starts its own local server and checks start, flight, restart, shared input, tracking pause, and responsive sizing. It saves screenshots under `test-results`. Enable worms through `.env.local` to exercise the optional pickup check too.

## Team integration

`src/input/types.ts` defines the shared `InputState` and `InputSource` contract. Input producers register with `inputManager.setSource(source)`. Gameplay reads `inputManager.getState()` every frame without waiting on the camera or network.

Keyboard fallback starts by default. Space records one flap per press, arrows provide strafe/jump/squat, and Enter confirms menus. The keyboard badge hides when a CV producer replaces the source. Camera menus use a small wave with either hand raised above the shoulder: move it sideways and back. Lower your hands before waving again for the next screen. Vertical flaps, a single sweep and holding a hand up do not confirm. Waves use the existing `selectCount` field. A fresh jump or the optional `select` field also remains accepted. Holding Space does not generate repeated flaps.

Keyboard confirmation also uses the optional monotonic `selectCount` field so a short Enter press is not missed between render frames. Existing CV producers do not need to provide it.

`src/game/events.ts` exposes typed `gameEvents.on(name, callback)` subscriptions. It returns an unsubscribe function. Events include `death`, `near_miss`, `new_best`, `milestone`, and `run_end`. Listener failures do not interrupt gameplay.

Dev 3 can register `setScoreSink` from `src/net/scoreSync.ts` to send finished runs to the leaderboard. No backend endpoint is configured yet. Best altitude stays available locally when the backend or browser storage is unavailable.

Dev 1 can call `setDifficulty` in `src/game/difficulty.ts` with `enemyEveryMetres`, `enemySpeed`, and weights for `static`, `sweeper`, and `diver`. The first cat waits at least five seconds of active gameplay after the first flap, and this grace period restarts on every retry. Tracking loss pauses the timer. Cat frequency also increases with total run altitude, including across map loops. With default settings, encounter spacing ramps from 24 to 12 metres and the cooldown between warning starts drops from 6 to 4 seconds over the first 600 metres, then stays capped. Both the distance and cooldown must pass before another cat appears. The legacy speed/mix fields remain accepted for producer compatibility, but do not affect the cat: its warning always lasts 2.5 seconds at every altitude. The face marks and locks the bird's current lane, then disappears as a paw strikes that lane for 350 ms. Leave the marked lane to survive; climbing alone does not evade the strike. Tracking loss freezes the encounter. Heaven remains free of cats and obstacles.

Camera controls register a brisk two-arm downstroke just below shoulder height after the arms have been raised. You do not need to finish the stroke at hip height. Wrist and body filters favour faster response, and a small torso tilt or sideways step selects one adjacent lane. Return upright to move again in the same direction. Holding a tilt keeps the selected lane. Opposite tilts move one lane back. Lane changes take about 170 ms and stop at the outer lanes. Keyboard arrows follow the same one-press, one-lane behaviour. Small movements, slow arm drops and single-arm motions remain filtered out. The camera requests up to 60 fps when supported. Actual camera performance depends on the laptop and lighting.

Each flap now adds a 700 px/s upward impulse (previously 400), with upward speed capped at 1000 px/s (previously 600). One flap from rest lifts roughly 7.7 metres instead of 2.5. Faster flapping travels farther, while the slow 150 px/s fall remains the same. Horizontal movement snaps to the selected lane.

## Optional worm pickups

FA-25 is isolated on `feat/worm-pickups`. Copy `.env.example` to `.env.local`, set `VITE_ENABLE_WORMS=true`, and restart Vite to try it. Leave it off until the team's M3 core milestone passes. Worms appear beside hazards, play a short pickup sound, and save the total locally. The sound is an original generated tone that the designer can replace.

The bird, kitchen, hazards, and enemies use code-drawn placeholders. Final art, webcam tracking, voice playback, and the backend transport are separate team integration work.

| Folder | Owner / purpose |
| --- | --- |
| `src/input` | Shared contract and input sources |
| `src/cv` | Camera integration seam |
| `src/game/scenes` | Phaser scenes, Dev 2 |
| `src/audio` | Voice and sound, Dev 3 |
| `src/net` | Backend connection, Dev 3 |
| `public/assets` | Art and audio from the designer |

## Review workflow

One branch and pull request per ticket. Use commit titles such as `feat(FA-1): scaffold the Phaser frontend`. Describe the behavior, validation, and dependencies in each PR. Merge through `dev` after team review.

## Storyboard flow

Jump, press Enter, or click Start to see the controls. Confirm again to fly. Space flaps in keyboard mode and left/right arrows change lanes. After a death, flap to retry or jump/Enter to return to the menu. Heaven continues into the next circuit without a victory screen.

Kitchen runs from 0 to 60 metres, Dessert from 60 to 120, and Bird Heaven from 120 to 150. At 150 metres the map returns to Kitchen and repeats this circuit indefinitely. These distances live in `src/game/levels.ts`. Altitude, score, pickups and difficulty carry across every loop. Each level starts with a lift boost. Heaven has scrolling clouds, a golden halo and a clear flight path for a short breather. Keep flapping to avoid falling. `level_start` includes Heaven and fires on every transition. Reaching Heaven does not end the run or emit `win`. Death ends the run and submits its accumulated score.

The browser game targets a laptop. Native desktop packaging, slots, inventory, powerups, final art, and live encouragement need their respective team integrations. Multiplayer and daily streaks are excluded as shown in the MVP storyboard. The designer's reference calls for clean 2D shapes, bright contrasting colours, and medium pencil-textured outlines. Current art is drawn placeholder art with medium outlines; final texture assets come from the designer.

## Gentle obstacle pacing

Map obstacles appear one at a time, with rows 900 px apart. The next obstacle waits for the previous one to leave the screen. Cat encounters clear all map obstacles so only one threat is active. The cat face warns for 2.5 seconds before the paw strikes, even at high altitude. Skipped rows stay skipped after the paw retreats; later obstacles resume normally. Difficulty still needs a short arm-flapping playtest on the demo laptop.
