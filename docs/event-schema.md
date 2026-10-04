# Event schema

Source of truth: `frontend/src/shared/events.ts`. This page mirrors it.

## Game events (EventBus, in browser)

| Event | Payload | Emitted by | Used by |
| --- | --- | --- | --- |
| `run_start` | `level` | GameScene | VoiceDirector |
| `flap` | none | GameScene | SFX |
| `near_miss` | none | GameScene | VoiceDirector, juice |
| `milestone` | `altitude` | GameScene | VoiceDirector |
| `new_best` | `altitude` | GameScene | VoiceDirector, confetti |
| `flap_rate_dropped` | `flapRate` | Difficulty | VoiceDirector |
| `death` | `RunStats` | GameScene | VoiceDirector, Socket, GameOverScene |

## WebSocket messages (client <-> backend)

Every message is `{ "type": string, "ts": number, "payload": object }`.

Client to server:

| type | payload |
| --- | --- |
| `death` | `RunStats` |
| `score` | `{ initials, level, altitude }` |

Server to client:

| type | payload |
| --- | --- |
| `roast` | `{ text, audio_b64 }` (MP3, base64) |
| `roast_fallback` | `{}` (play a cached death line) |
| `leaderboard` | `{ level, entries: [{ initials, altitude }] }` |

## RunStats

```ts
{
  level: "kitchen" | "dessert",
  altitude: number,        // metres
  best: number,
  durationS: number,
  peakFlapRate: number,    // flaps per second
  nearMisses: number,
  causeOfDeath: string     // e.g. "knife", "fell"
}
```
