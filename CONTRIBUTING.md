# Contributing

## Branches

- `main` must always run. Never push broken code to it.
- One branch per ticket: `<area>/<short-name>`, for example `cv/gesture-state-machine`, `game/hazard-spawner`, `voice/director`, `api/leaderboard`, `art/kitchen`.
- Rebase or merge `main` into your branch before opening a PR.

## Pull requests

- Keep PRs small (under ~300 lines where possible). Merge often.
- Title starts with the ticket name from the Notion board.
- Any PR touching `frontend/src/shared/` needs a heads-up in the team chat.
- One teammate glances at it. In crunch time, self-merge is fine if `npm run build` passes.

## Before you merge

```bash
cd frontend && npm run build        # type-checks and builds
cd backend && python -m compileall app scripts
```

## Commits

Short, present tense: `add flap impulse`, `tune strafe threshold`.

## Secrets

- Never commit `.env` or API keys. Use `backend/.env.example` as the template.
- The frontend never talks to ElevenLabs or Gemini directly. Everything goes through the backend.

## Timeline rules

- 5-minute standup at the board every 3 hours.
- P2 stretch tickets start only once their milestone's P0s are Done.
- Record a backup demo clip at H18.
- Code freeze in the final hour: only demo-blocking fixes.
