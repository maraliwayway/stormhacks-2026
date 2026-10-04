# Deploying the backend and the .tech domain (Dev 3)

The frontend is a static Vite build served by Cloudflare (`wrangler.jsonc`). The backend is a small FastAPI service that needs WebSockets. Budget about 15 minutes.

## 1. Backend on Render (free plan)

1. Sign in to render.com with GitHub. Choose **New > Blueprint** and pick this repo. Render reads `render.yaml` at the repo root.
2. Fill the secret env vars when prompted:

   | Key | Value |
   | --- | --- |
   | `ELEVENLABS_API_KEY` | From backend/.env |
   | `GEMINI_API_KEY` | From backend/.env |
   | `VOICE_ID_ANNOUNCER` | From backend/.env |
   | `FRONTEND_ORIGIN` | `https://flappyarms.tech,https://flap-or-flop.<you>.workers.dev` |

3. Deploy, then run `curl https://<service>.onrender.com/health`. It should return `"ok": true`, with `gemini`, `elevenlabs` and all three `voices` set to `true`.

Railway works too: point it at `backend/`. It uses `backend/Procfile`.

**Free-plan caveats:**
- **Cold starts.** The service sleeps after 15 minutes idle, and the first request takes about 30 s to wake it. Open `/health` 1 minute before judging.
- **Leaderboard resets.** The SQLite file is wiped on every redeploy. That's fine for a hackathon. Add a Render disk and set `DB_PATH=/var/data/flappy_arms.db` to keep it.

## 2. Frontend on Cloudflare

```bash
echo VITE_BACKEND_URL=https://<service>.onrender.com > .env.production.local
npm run build
npx wrangler deploy          # serves ./dist as configured in wrangler.jsonc
```

`VITE_BACKEND_URL` is read at build time, so rebuild whenever it changes. It must be `https://`. The client derives `wss://.../ws` itself. Browsers block `ws://` from an HTTPS page, and the webcam needs HTTPS.

## 3. The .tech domain

1. Claim `flappyarms.tech` with the MLH .tech code (get.tech).
2. In Cloudflare, add the domain as a site and set the get.tech nameservers to the two Cloudflare gives you.
3. Under **Workers & Pages > flap-or-flop > Settings > Domains & Routes**, choose **Add custom domain** and enter `flappyarms.tech`.
4. Make sure `https://flappyarms.tech` is in the backend's `FRONTEND_ORIGIN`.

## 4. Post-deploy check (on a phone hotspot)

- [ ] `https://flappyarms.tech` loads, and the camera prompt appears after **Use my camera**.
- [ ] The Narrator opens the first run.
- [ ] The second death plays a **LIVE ROAST**, and the results card shows a rank.
- [ ] **Top flyers** on the menu lists the run.
- [ ] Stop the Render service: the game still plays, speaks and shows no errors.
