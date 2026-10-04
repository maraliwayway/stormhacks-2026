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

Keyboard fallback starts by default. Space records one flap per press, arrows provide strafe/jump/squat, and Enter confirms menus. The keyboard badge hides when a CV producer replaces the source. CV menu confirmation can use a new flap count or the optional `select` field. Holding Space does not generate repeated flaps.

Keyboard confirmation also uses the optional monotonic `selectCount` field so a short Enter press is not missed between render frames. Existing CV producers do not need to provide it.

`src/game/events.ts` exposes typed `gameEvents.on(name, callback)` subscriptions. It returns an unsubscribe function. Events include `death`, `near_miss`, `new_best`, `milestone`, and `run_end`. Listener failures do not interrupt gameplay.

Dev 3 can register `setScoreSink` from `src/net/scoreSync.ts` to send finished runs to the leaderboard. No backend endpoint is configured yet. Best altitude stays available locally when the backend or browser storage is unavailable.

Dev 1 can call `setDifficulty` in `src/game/difficulty.ts` with `enemyEveryMetres`, `enemySpeed`, and weights for `static`, `sweeper`, and `diver`. The default mix runs locally until adaptive tuning lands. Enemies warn for 650 ms before moving or becoming collidable.

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
