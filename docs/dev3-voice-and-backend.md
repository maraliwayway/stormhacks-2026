# Voice, story and backend (Dev 3)

Flappy Arms is told as a story by three ElevenLabs voices. A FastAPI backend adds a live leaderboard and a death roast written by Gemini from the real run stats. The game never waits on any of it. With no backend, it still speaks every pre-rendered line.

## The story

Pidge is a small pigeon escaping Chef Gustavo's kitchen by flying straight up. Pidge crosses a scorching desert the menu calls "Dessert", reaches Bird Heaven, and then the circuit loops back to the soup.

| Voice | ElevenLabs voice | Speaks |
| --- | --- | --- |
| **The Narrator** | George (warm British storyteller) | Opening of every run, each new world, the loop back, eulogies for deaths outside the Kitchen, dry live roasts |
| **Chef Gustavo** | Callum (husky trickster) | Kitchen near misses, idle heckles ("FLAP HARDER!"), Kitchen deaths by pot, knife, pan, cat or fall, and live Kitchen roasts |
| **The Announcer** | `VOICE_ID_ANNOUNCER` | Hype for near misses, milestones, new records, flap streaks and worm pickups |

There are 69 pre-rendered lines with eleven_v3, using audio tags like `[shouting]` and `[whispers]`, plus 6 generated sound effects. The script is in `backend/data/voice_lines.json`, and its format is in `backend/data/README.md`.

## How it fits the game

```
gameEvents (Dev 2) ──> voiceDirector ──> audioEngine (Web Audio, cached clips)
        │                    │  ▲
        │                    ▼  │ roast {text, audio_b64}
        └─ run_end ──> scoreSync sink ──> backendLink ──> FastAPI ──> Gemini ──> ElevenLabs Flash
```

| Module | Job |
| --- | --- |
| `src/audio/voiceDirector.ts` | Maps game events to lines, tracks idle and streak flapping, handles the roast handoff |
| `src/audio/voicePolicy.ts` | Pure pacing rules: 7 s gap between lines, per-event cooldowns, priority, no overlap |
| `src/audio/voiceLines.ts` | Picks the most specific line for the moment and avoids the last 6 |
| `src/audio/audioEngine.ts` | Web Audio buses (voice, sfx, music), unlocked on first gesture, music ducking, every failure becomes silence |
| `src/audio/sfx.ts` | Flap, death, near-miss, record, new-world and Heaven sounds |
| `src/net/backendLink.ts` | One WebSocket with backoff reconnect, HTTP with 2.5 s timeouts, and no-ops offline |
| `src/net/leaderboard.ts` | Registers the team's `setScoreSink`, call signs, rename, top 10 |
| `src/net/resultsPanel.ts` | Adds the spoken line as a caption, the rank and a rename box to the results card, and a **Top flyers** board to the menu. It works through a MutationObserver, so `src/ui` is untouched |
| `src/net/installDev3.ts` | The single hook called from `main.ts` |

**Death and the live roast.**
1. On every second death, the client sends the run stats over the WebSocket.
2. The cached death line waits up to 2.6 s for a roast.
3. If the roast arrives, it plays and is captioned **LIVE ROAST**. Otherwise the cached line plays.

A death never gets two voices. Starting a run sends `warm`, so the backend opens its Gemini and ElevenLabs connections before the death. A warm roast takes about 1.0 s.

**Safety.** Roasts pass a word filter covering self-harm, death, swearing and insults. Anything that trips it falls back to a hand-written line.

## Run it

```bash
# Backend
cd backend
python -m venv .venv && .venv/Scripts/activate      # macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env                                 # add keys
uvicorn app.main:app --reload --port 8000

# Frontend, in another terminal
echo VITE_BACKEND_URL=http://localhost:8000 >> .env.local
npm run dev
```

Leave `VITE_BACKEND_URL` unset to play fully offline. Voice lines and sound effects still play.

## Checks

| Command | Covers |
| --- | --- |
| `cd backend && python -m pytest -q` | API, ranks, renames, validation, WebSocket protocol, roast fallbacks, timeout, safety filter |
| `npm test` | Manifest covers every death in every world, line selection, pacing (a 60 s run speaks 5 to 9 lines, never overlapping), leaderboard client, offline no-ops, hung-backend timeout |
| `npm run test:voice` | Real backend + Chromium: Narrator opening, flap SFX, captioned Chef death, rank + rename, live roast with no doubled line, Top flyers, backend killed mid-session |
| `python scripts/render_voice_lines.py --dry-run` | Script validation and coverage table |
| `python scripts/roast_smoke.py [--text-only]` | 10 live roasts with latency (p50/p90) |
