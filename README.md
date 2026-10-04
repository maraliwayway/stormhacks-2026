# Flappy Arms

Flap your real arms to fly a bird up through a cartoon kitchen, dodging hazards while an AI chef yells at you. Webcam pose tracking in the browser, no controllers.

Built at **StormHacks 2026**. Targets: Best Game, MLH Best Use of ElevenLabs, MLH Gemini API, IATSU Best Design, SSSS Python Track, MLH .Tech Domain.

## Quick start

### Frontend (game)

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

Keyboard controls work from day one, so you can build without a webcam:

| Key | Action |
| --- | --- |
| Space | Flap |
| Left / Right | Strafe |
| Up / Down | Jump / Squat (menus) |
| Enter | Select |
| D | Toggle pose debug overlay |
| C | Re-calibrate |

### Backend (API + voice)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # add your API keys
uvicorn app.main:app --reload --port 8000
```

The game must stay playable with the backend off. The backend only adds the leaderboard and the live death roast.

### Pre-render voice lines

```bash
cd backend
python scripts/render_voice_lines.py   # writes MP3s into frontend/public/assets/voice/
```

## Team and folder ownership

| Role | Owns | Folders |
| --- | --- | --- |
| Dev 1: CV + Input | MediaPipe, calibration, gestures, gesture menus, adaptive difficulty | `frontend/src/cv/`, `frontend/src/game/systems/Difficulty.ts`, `frontend/src/game/scenes/MenuScene.ts`, `frontend/src/game/scenes/CalibrationScene.ts` |
| Dev 2: Gameplay | Phaser scaffold, keyboard input, physics, hazards, enemies, juice, levels | `frontend/src/game/` (except the above), `frontend/src/input/` |
| Dev 3: Backend + Voice (Stephen) | FastAPI, ElevenLabs, Gemini roast, voice director, leaderboard, deploy. See [`docs/dev3-playbook.md`](docs/dev3-playbook.md) | `backend/`, `frontend/src/audio/`, `frontend/src/net/` |
| PM / Designer | Art, UI, voice script, Devpost, video | `frontend/public/assets/`, `backend/data/voice_lines.json`, `docs/` |

Shared files in `frontend/src/shared/` are the **integration contract**. Change them only after telling the team.

## Integration contract

```
Webcam -> PoseTracker -> GestureDetector -> InputState <- KeyboardInput
                                               |
                                           Phaser game
                                               |
                                           EventBus  -> VoiceDirector (cached MP3s)
                                               |
                                           Socket -> FastAPI -> Gemini -> ElevenLabs
```

1. Dev 1 writes gestures into `InputState`.
2. Dev 2's game reads only from `InputState`, and builds against the keyboard until gestures land.
3. Dev 2's game emits events (`death`, `near_miss`, `new_best`, `milestone`) on `EventBus`.
4. Dev 3's `VoiceDirector` subscribes to `EventBus`.
5. **The game loop never waits on the network or an AI call.**

See [`docs/architecture.md`](docs/architecture.md), [`docs/gesture-spec.md`](docs/gesture-spec.md) and [`docs/event-schema.md`](docs/event-schema.md).

## Working agreement

See [`CONTRIBUTING.md`](CONTRIBUTING.md). Short version: branch per ticket, small PRs, `main` always runs, code freeze in the final hour.

## Planning

- Kanban + tickets: Notion page "Flappy Arms"
- Task split spreadsheet: `Flappy_Arms_Task_Split.xlsx` (shared separately)
