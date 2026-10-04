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

## Team integration

`src/input/types.ts` defines the shared `InputState` and `InputSource` contract. Input producers register with `inputManager.setSource(source)`. Gameplay reads `inputManager.getState()` every frame without waiting on the camera or network.

Keyboard fallback starts by default. Space records one flap per press, arrows provide strafe/jump/squat, and Enter confirms menus. The keyboard badge hides when a CV producer replaces the source. CV menu confirmation can use a new flap count or the optional `select` field. Holding Space does not generate repeated flaps.

`src/game/events.ts` exposes typed `gameEvents.on(name, callback)` subscriptions. It returns an unsubscribe function. Events include `death`, `near_miss`, `new_best`, `milestone`, and `run_end`. Listener failures do not interrupt gameplay.

Dev 3 can register `setScoreSink` from `src/net/scoreSync.ts` to send finished runs to the leaderboard. No backend endpoint is configured yet. Best altitude stays available locally when the backend or browser storage is unavailable.

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
