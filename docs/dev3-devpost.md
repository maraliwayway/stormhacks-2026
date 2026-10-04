# Devpost paragraphs (Dev 3 tracks)

## MLH Best Use of ElevenLabs

Flappy Arms is narrated like a story game. Three ElevenLabs voices perform 69 hand-written lines rendered with **Eleven v3**, using audio tags like `[shouting]`, `[whispers]` and `[awed]` for real performances:
- **The Narrator**, a Bastion-style storyteller, opens every run and eulogises each flop.
- **Chef Gustavo** screams at the pigeon escaping his kitchen ("Into the pot! FINALLY, some good stock!").
- **The Announcer** hypes near misses and new records.

Lines are chosen by context: which world you're in, what killed you, whether you just looped back to the Kitchen. Pacing rules make the voices coach rather than spam. Every flap, crash, record and new world has a sound effect generated with the **ElevenLabs Sound Effects API**. On every second death, **ElevenLabs Flash v2.5** voices a brand-new roast written from your actual run. The full death-to-audio round trip is about 1 second. Everything pre-rendered is cached, so the voices keep working with no network at all.

## MLH Best Use of Gemini API

When you die, the game sends Gemini your real run: the height you reached, what killed you, how many times you flapped your arms, how far below your best you fell, and how many times you've crashed this session. **Gemini 3.5 Flash-Lite** turns one of those facts into a single in-character line, angry Chef in the Kitchen or deadpan Narrator in the desert. For example: "Seventy metres to the sky, yet Pidge found the only prickly plant for miles." We pre-compute every number so the model never does maths. We disable thinking to keep it at about 1 second, and we warm the connection when a run starts. A 1.5 s timeout and a kid-safe word filter fall back to a hand-written line, so a slow or off-colour response never reaches the player.

## SSSS Python Track

The backend is Python end to end:
- A **FastAPI** service with a WebSocket for the live roast, plus REST endpoints for the leaderboard, ranks and renaming runs. SQLite stores the scores.
- Async **httpx** with pooled, pre-warmed connections to Gemini and ElevenLabs, with strict timeouts and fallbacks.
- Python build tools that turn our JSON script into 69 voice lines and 6 sound effects with a hash cache, so only changed lines cost credits.
- A smoke tool that measures live roast latency (p50/p90).
- 29 pytest tests covering the API, the WebSocket protocol, timeouts, fallbacks and the content filter.

## MLH .Tech Domain

The game is live at **flappyarms.tech**. Webcam motion controls require HTTPS, so the .tech domain is served over Cloudflare with TLS. The FastAPI backend sits behind a secure WebSocket. Judges can open the link on any laptop, allow the camera and start flapping, with no install.
