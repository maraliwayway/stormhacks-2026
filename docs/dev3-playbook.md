# Dev 3 Playbook: Backend + Voice (Stephen)

Everything Dev 3 owns, in build order, with what is already scaffolded and what is left.

**Owns:** `backend/`, `frontend/src/audio/`, `frontend/src/net/`, deploy, .tech domain.
**Prize tracks carried:** MLH ElevenLabs (primary), MLH Gemini, SSSS Python Track, MLH .Tech Domain.
**Load:** 10.5 h must + should, 3 h whole-team, 3 h stretch (slots + power-ups).

## Do right now (before H0, 20 min)

| Account / key | Where | Goes in |
| --- | --- | --- |
| ElevenLabs API key | elevenlabs.io > Profile > API keys (check the MLH sponsor page for hackathon credits) | `backend/.env` `ELEVENLABS_API_KEY` |
| Gemini API key | aistudio.google.com > Get API key | `backend/.env` `GEMINI_API_KEY` |
| Two voice IDs | ElevenLabs Voice Library: one gruff (chef), one hyper (announcer). Pick with the PM | `VOICE_ID_CHEF`, `VOICE_ID_ANNOUNCER` |
| .tech domain | MLH sponsor code from the hackathon Discord / MLH page | Claim `flappyarms.tech` (or similar) |
| Hosting | Railway or Render account (backend), Vercel or Netlify (frontend) | Later, M4 |

Never commit `.env`. Share keys with the team over DM, not the repo.

## Build order

### M1 Foundations (H0-4)

**1. Backend scaffold** (1 h) - mostly done
- [x] FastAPI app with `/health`, `/score`, `/leaderboard`, `/ws` (`backend/app/main.py`)
- [x] SQLite leaderboard (`backend/app/db.py`)
- [ ] Create venv, `pip install -r requirements.txt`, run `uvicorn app.main:app --reload --port 8000`
- [ ] Confirm `GET /health` shows `"elevenlabs": true, "gemini": true` once keys are in
- **Done when:** health check passes with both keys detected.

### M2 Playable core (H4-10)

**2. ElevenLabs pre-render** (1.5 h) - script done, needs real lines
- [x] `backend/scripts/render_voice_lines.py` renders MP3s + `manifest.json`, skips unchanged lines
- [ ] Wait for the PM's full ~40-line `backend/data/voice_lines.json` (target: by H4). 12 starter lines are there to test with now
- [ ] Run the script, listen to every line, tweak `VOICE_SETTINGS` (stability lower = more expressive)
- [ ] Commit MP3s in `frontend/public/assets/voice/` + `manifest.json`
- **Done when:** every event has 4+ variants per persona and the game plays them offline.

### M3 Content + voice (H10-16): your heaviest block (~7 h)

**3. Voice director** (2 h) - first pass done (`frontend/src/audio/VoiceDirector.ts`)
- [x] Subscribes to EventBus, 4 s global cooldown, 10 s per event, priority, no repeat of last 2
- [ ] **Fix double death voice:** on deaths that get a live roast, skip the cached death line (or delay it ~1.6 s and cancel if the roast arrives). Today both can play
- [ ] Music ducking to ~60% while speaking (once the PM picks music)
- [ ] Play-test 5 runs: is it funny or spammy? Adjust cooldowns
- **Done when:** a full run has 3 to 6 voice lines, never overlapping.

**4. SFX pack** (1 h) - not started
- [ ] New script `backend/scripts/render_sfx.py` calling ElevenLabs Sound Effects (`POST https://api.elevenlabs.io/v1/sound-generation`, body `{"text": "...", "duration_seconds": 0.5}`)
- [ ] Sounds: flap whoosh, splat, sizzle, pop (worm), slot spin, jackpot
- [ ] Output to `frontend/public/assets/sfx/`; hook flap/death SFX to EventBus
- **Done when:** flap and death have sound.

**5. Dynamic death roast** (2.5 h) - backend done (`backend/app/roast.py`), client partly done
- [x] Gemini writes one line from run stats with a 1.5 s timeout; ElevenLabs Flash voices it; any error returns `roast_fallback`
- [x] Client sends stats on every 2nd death and plays returned audio (`frontend/src/net/Socket.ts`)
- [ ] Test end to end with real keys; measure latency (target under 2 s from death to audio)
- [ ] Tune the prompt in `build_prompt()` until 8 of 10 lines are actually funny
- [ ] Show the roast text as a caption on the game-over card (judges may have sound off)
- **Done when:** dying twice reliably gets a stat-specific roast, and pulling the network cable still gets a cached line.

**6. Leaderboard** (1.5 h) - API done, UI not started
- [x] `POST /score`, `GET /leaderboard`, WS `score` message returns updated top 10
- [ ] Initials entry on GameOverScene: strafe to change letter, flap to confirm (coordinate with Dev 2, who owns the scene)
- [ ] Top 10 on the title screen (coordinate with Dev 1, who owns MenuScene)
- **Done when:** a judge can enter initials and see themselves on the board.

### M4 Polish + stretch (H16-21)

**7. Deploy + .tech domain** (1 h)
- [ ] Backend to Railway/Render (needs WebSocket support; set env vars in the dashboard, set `FRONTEND_ORIGIN` to the deployed URL)
- [ ] Frontend to Vercel/Netlify with `VITE_BACKEND_WS=wss://<backend>/ws` (must be `wss` on HTTPS)
- [ ] Point the .tech domain at the frontend
- **Done when:** the game loads on the .tech URL on a phone-hotspot connection.

**8. Stretch: slots + power-ups** (3 h) - only if M3 exit criteria are met
- [ ] Deterministic rarity table in code; Berry Nice (shield), Seedling (slow fall), Feather Boost (auto climb)
- [ ] Voice-announced pulls using pre-rendered lines (ask PM for 6 extra lines)

### M5 Ship (H21-24)

- [ ] Give the PM one paragraph each for the ElevenLabs, Gemini, Python and .Tech Devpost sections (what, how, why it matters)
- [ ] Final QA: game runs with backend killed and with Wi-Fi off
- [ ] Code freeze in the final hour

## Handoffs

| From / to | What | When |
| --- | --- | --- |
| PM to you | Full `voice_lines.json`, voice choices | H4 |
| Dev 2 to you | Events firing from GameScene (`near_miss` is still a TODO there) | H8 |
| You to PM | Rendered voice lines to review | H6 |
| You to Dev 2 / Dev 1 | Initials UI + leaderboard hooks | H14 |
| You to PM | Devpost paragraphs for your tracks | H20 |

## Quick tests

```bash
# Backend
cd backend && uvicorn app.main:app --reload --port 8000
curl localhost:8000/health
curl -X POST localhost:8000/score -H 'content-type: application/json' -d '{"initials":"STE","level":"kitchen","altitude":120}'
curl 'localhost:8000/leaderboard?level=kitchen'

# Frontend talking to backend
cd frontend && cp .env.example .env.local && npm run dev
```

## Risks you own

- **API quota or outage mid-demo:** cached lines cover it; never make a voice line depend on the network.
- **Roast latency:** if Gemini + TTS exceeds 2 s in the venue, drop to every 3rd death or pre-generate 10 roasts at startup.
- **WebSocket blocked on venue Wi-Fi:** the game must not care. Test with the backend off before the demo.
- **Keys leaking:** frontend never calls ElevenLabs or Gemini directly.
