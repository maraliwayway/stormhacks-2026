# Architecture

```
Browser (demo laptop)                                  Backend (FastAPI, Python)
+------------------------------------------+           +------------------------------+
| Webcam -> PoseTracker (MediaPipe, lite)   |           | GET  /health                 |
|        -> GestureDetector (One Euro)      |           | GET  /leaderboard?level=     |
|        -> InputState  <- KeyboardInput    |           | POST /score                  |
| Phaser 3 scenes read InputState           |   WS      | WS   /ws                     |
| Game emits events on EventBus             |<--------->|   death stats -> Gemini      |
| VoiceDirector plays cached MP3s           |           |   line -> ElevenLabs Flash   |
| Socket sends death stats, receives audio  |           |   audio -> client            |
+------------------------------------------+           | SQLite (Tiger Data stretch)  |
                                                       +------------------------------+
```

## Rules

- **The game loop never waits on the network or an AI call.** AI output is advisory and applied when it arrives.
- Pose inference runs on `requestVideoFrameCallback`, decoupled from Phaser's 60 FPS render loop. The game reads the latest gesture state each frame.
- ~40 voice lines are pre-rendered at build time. Only the death roast is generated live, and it silently falls back to a cached line on any error or a 1.5 s timeout.
- API keys live only in `backend/.env`.

## Performance budget

| Item | Target |
| --- | --- |
| Pose inference | 25+ FPS, under 30 ms/frame (lite model, GPU delegate, 640x480) |
| Render | 60 FPS |
| Motion to action | under 100 ms |
| Cached voice | 0 ms network |
| Dynamic roast | under 2 s, optional |
| Telemetry writes | batched every 2 s, never per frame |

## Stack

Vite + TypeScript + Phaser 3, `@mediapipe/tasks-vision`, Howler.js, FastAPI, ElevenLabs TTS + Sound Effects, Gemini Flash, SQLite. Deploy: Vercel/Netlify (frontend, HTTPS needed for webcam) + Railway/Render (backend) on a .tech domain.
