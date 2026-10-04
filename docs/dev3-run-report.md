# Dev 3 run report (2026-10-04)

Branch `dev3/backend-voice`, based on `origin/dev` at `f65744f`. It is local only, not pushed or merged.

**Deviation from the autopilot prompt:**
- **Different codebase.** The team's `dev` is a root-level Vite app (`src/game/events.ts`, `src/net/scoreSync.ts`, native HTML UI, Biome, vitest, Cloudflare). It is not the `frontend/` + `backend/` scaffold the prompt described, so every task was rebuilt against the team's real seams.
- **Not reused.** The old scaffold's Howler `VoiceDirector` and `Socket` were not reused. Their bugs (reconnect duplicating the death listener, double death voice, ignored `roast_fallback`) don't exist in the new code.

## Summary

| Task | Ticket | Status | Commit |
| --- | --- | --- | --- |
| 0. Backend scaffold, tests | #2 | PASS | 2a3b90f |
| 1. Voice pre-render (69 lines, 3 voices, eleven_v3) | #14 | PASS | a27b742 |
| 2. Voice director, pacing, roast handoff, ducking bus | #15 | PASS | 779eb5d |
| 3. SFX pack (6 sounds) | #21 | PASS | bd58964 |
| 4. Live death roast (Gemini + Flash), caption | #22 | PASS | 2a3b90f, 779eb5d, f833bfe |
| 5. Leaderboard: rank, rename, Top flyers | #23 | PASS | f833bfe |
| 6. Deploy config + guide | #24 | PARTIAL: config ready, deploy needs your accounts | d5d560c |
| 7. Offline + integration hardening | | PASS | c886232 |
| 8. Devpost paragraphs | | PASS | d5d560c |
| 9. Slots + power-ups (stretch) | #26 | SKIPPED: the team README defers power-ups; adding them means editing Dev 2's GameScene | |

## Validation output

```
biome (Dev 3 files)    Checked 14 files. No fixes applied.
tsc --noEmit           ok
vitest                 Test Files 22 passed (22) · Tests 113 passed (113)   (93 team + 20 Dev 3)
npm run build          ok
pytest                 29 passed
compileall             ok
test:ui     (team)     UI checks passed: ... five viewport sizes, 720p fit, ... no runtime errors.
test:browser (team)    Browser checks passed: ... Kitchen, Dessert, Heaven, repeated loops ... no runtime errors.
test:camera (team)     Camera worker checks passed: GPU, local model, 8 frames, responsive UI, camera cleanup.
test:voice  (new)      Voice checks passed: narrator opening, flap SFX, captioned chef death line, rank + rename,
                       live roast in 984 ms ("Thirty-one metres of pure grace before you tried to sharpen my
                       cutlery with your tail") with no doubled line, Top flyers board, backend killed
                       mid-session with cached voice and no errors. Audio clips started: 13.
                       4/4 consecutive passes after the restart fix.
```

**Voice render:**
```
69 lines, 4147 characters. Per persona: narrator 26, chef 19, announcer 24
manifest: 69 lines (69 rendered, 0 cached). ElevenLabs credits this run: 1826
entries 69, missing [], under 5 KB [], orphans [], total 3.7 MB
```

**SFX render:** `manifest: 6 sounds` (flap, death, near_miss, new_best, level_up, heaven), 141 KB.

**Live roast, `roast_smoke.py`, 10 runs with Gemini + Flash TTS:**
```
p50 1005 ms  p90 1743 ms  (p90 is the cold first call; warm roasts measured 992 / 1048 ms)
fallbacks 1/10 (stale pooled connection, since fixed with a transport retry)
Flash characters: 701
```

Prompt tuning took 3 iterations with `--text-only`. In my judgement, the final batch had about 8/10 lines that were funny and specific to the run, for example:
- "Seventy metres to the sky, yet Pidge found the only prickly plant for miles."
- "Twenty-seven metres and you fell flat? My butter melts faster than your flying!"

One e2e roast drifted dark ("suicide"). A word filter now rejects that class of line and falls back to a cached line. It has 9 tests.

**Pacing:** the unit test simulates a busy 60 s run. Before tuning, it spoke 13 lines. After tuning it speaks 9, with a 7 s gap between lines and longer per-event cooldowns. Story beats, death and records always get through.

## Costs and limits

| Service | Used this session | Ongoing |
| --- | --- | --- |
| ElevenLabs v3 (pre-render) | 1,826 + 15 test = **~1.8k credits** | 0 at runtime. Re-renders only changed lines, about 26 credits per line |
| ElevenLabs Sound Effects | 91 credits reported by the API | 0 at runtime |
| ElevenLabs Flash (live roasts) | ~30 roasts, ~2.4k characters, **~1.2k credits** (estimate at 0.5 credit/char) | ~40 credits per roast, 1 roast per 2 deaths. 300 judging deaths ≈ 6k credits |
| Gemini 3.5 Flash-Lite | ~70 calls, ~35k tokens | Fractions of a cent per roast. The free tier returned 429s when called back to back; in game it's at most 1 call per 2 deaths, and a 429 just falls back to a cached line |
| Render (backend) | not deployed | Free plan: $0, but it sleeps after 15 minutes (≈30 s cold start) and SQLite resets on redeploy |
| Cloudflare + .tech | not deployed | Free (MLH .tech code) |

**Total ElevenLabs spend:** about 3k credits. The API key can't read the account balance (it lacks the `user_read` permission), so check the ElevenLabs dashboard. The free tier has 10k credits a month. If credits run low during judging:
- Set `ROAST_EVERY = 3` in `src/audio/voiceDirector.ts`, or
- Remove `GEMINI_API_KEY` from the backend. Every death then uses the hand-written lines, at zero cost.

## Human TODO (priority order)

1. **Listen to the audio.** I can't hear it. Check `public/voice/*.mp3` and `public/sfx/*.mp3`. The Announcer uses your existing `VOICE_ID_ANNOUNCER` (Tom, a conversational voice). If it lacks hype, try Charlie `IKne3meq5aSn9XLyUdCD` and re-render (~24 lines, ~650 credits).
2. **PM review of the script.** `backend/data/voice_lines.json` is PM-owned, and I wrote the story (Pidge vs Chef Gustavo).
3. **Copy `backend/.env` to your main checkout.** The worktree's `.env` now has:
   - `VOICE_ID_NARRATOR` (George)
   - `VOICE_ID_CHEF` (Callum)
   - `ELEVENLABS_TTS_MODEL=eleven_v3`
   - `GEMINI_MODEL=gemini-3.5-flash-lite` (gemini-2.5-flash is closed to new keys)
4. **Deploy** using `docs/dev3-deploy.md`: a Render blueprint, a Cloudflare build with `VITE_BACKEND_URL`, and the .tech domain.
5. **Play-test 5 camera runs** on the demo laptop. Check whether the voice pacing is fun or too much. All the knobs are in `src/audio/voicePolicy.ts`.
6. **Music.** There's no soundtrack yet. The `music` bus already ducks to 60% under voice.

## Contract change requests

None. Dev 3 code uses only the existing seams: `gameEvents.on`, `setScoreSink`, `bestScore`, and read-only DOM queries on `#game-ui`.

## Files touched outside Dev 3 folders

| File | Lines | Why |
| --- | --- | --- |
| `src/main.ts` | +4 | `installDev3(host)` and its HMR teardown |
| `.gitignore` | +8 | Python caches, venv, local DB, render caches |
| `.env.example` | +3 | Documents `VITE_BACKEND_URL` |
| `package.json` | +1 | `test:voice` script |
| `README.md` | 2 changed | Two outdated "no backend yet" sentences now point to the Dev 3 guide |
| `render.yaml` | new | Render Blueprint must live at the repo root |
| `scripts/voice-smoke.mjs` | new | E2E test, follows the existing `scripts/*-smoke.mjs` pattern |

`public/voice/` (3.7 MB) and `public/sfx/` (141 KB) are new asset folders. `public/_headers` already caches `/voice/*`.

## Integration risks

- **Merge check:** `git merge-tree` against `origin/dev` and every open `origin/feat/*` branch is clean.
- **DOM coupling:** the results panel finds `.result-dialog`, `.result-bird` and `.menu-screen .header-tools` in `src/ui/views.ts`. If the designer renames those classes, the panel silently stops appearing, but nothing breaks. `test:voice` catches it.
- **Idle detection** reads `#game-ui[data-view]` and `[data-tracking-notice]` so it never heckles during pause or tracking loss.
- **Local line endings:** with `core.autocrlf=true`, `npm run lint` fails locally on every team file because of CRLF. That's pre-existing. CI on Linux is unaffected, and Dev 3 files were checked with LF endings.
