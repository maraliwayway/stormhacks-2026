/**
 * Owner: Dev 3. End-to-end check of voice, SFX, leaderboard and the live roast against the real backend.
 * Needs backend/.venv with requirements installed. Uses real Gemini + ElevenLabs keys from backend/.env
 * when present (one or two roasts per run); without keys the roast step checks the cached fallback instead.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { chromium } from "playwright";
import { createServer } from "vite";

const BACKEND_PORT = 8765;
const backendUrl = `http://127.0.0.1:${BACKEND_PORT}`;
const python = [
  process.env.PYTHON,
  "backend/.venv/Scripts/python.exe",
  "backend/.venv/bin/python",
]
  .filter((candidate) => candidate && existsSync(candidate))
  .map((candidate) => resolve(candidate))[0];
assert.ok(python, "create backend/.venv first (see backend/README.md)");

process.env.VITE_BACKEND_URL = backendUrl;
const server = await createServer({
  server: { host: "127.0.0.1", port: 0, strictPort: false },
});
await server.listen();
const url = `http://127.0.0.1:${server.httpServer.address().port}`;

const dbDir = await mkdtemp(join(tmpdir(), "flappy-voice-"));
const backend = spawn(
  python,
  ["-m", "uvicorn", "app.main:app", "--port", String(BACKEND_PORT)],
  {
    cwd: "backend",
    env: {
      ...process.env,
      DB_PATH: join(dbDir, "smoke.db"),
      FRONTEND_ORIGIN: url,
      PYTHONUNBUFFERED: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
const backendLog = [];
backend.stdout.on("data", (chunk) => backendLog.push(String(chunk)));
backend.stderr.on("data", (chunk) => backendLog.push(String(chunk)));

async function waitForHealth() {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch(`${backendUrl}/health`);
      if (response.ok) {
        return response.json();
      }
    } catch {
      /* Not up yet. */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`backend did not start:\n${backendLog.join("")}`);
}

async function waitForPlaying(page) {
  await page.waitForFunction(
    () =>
      !document.querySelector(".result-dialog") &&
      window.testGame?.scene.getScene("Game")?.phase === "playing",
  );
}

let browser;
try {
  const health = await waitForHealth();
  const liveRoast = health.gemini && health.elevenlabs;
  browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--autoplay-policy=no-user-gesture-required",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
  });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      !/WebSocket|ERR_CONNECTION_REFUSED/.test(message.text())
    ) {
      errors.push(message.text());
    }
  });
  await page.addInitScript(() => {
    window.clipsStarted = 0;
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      window.clipsStarted++;
      return start.apply(this, args);
    };
  });
  await page.goto(`${url}/?kb`);
  await page.getByRole("button", { name: "Take flight" }).waitFor();
  await page.waitForFunction(
    () => !document.querySelector("[data-action=advance]").disabled,
  );
  await page.evaluate(async () => {
    const [{ game }, { voiceDirector }, { audioEngine }, { backendLink }] =
      await Promise.all([
        import("/src/main.ts"),
        import("/src/audio/voiceDirector.ts"),
        import("/src/audio/audioEngine.ts"),
        import("/src/net/backendLink.ts"),
      ]);
    window.testGame = game;
    window.voiceLog = [];
    const say = voiceDirector.say.bind(voiceDirector);
    voiceDirector.say = (event, context) => {
      const line = say(event, context);
      window.voiceLog.push({
        event,
        id: line?.id ?? null,
        at: performance.now(),
      });
      return line;
    };
    window.dev3 = { voiceDirector, audioEngine, backendLink };
  });
  await page.waitForFunction(() => window.dev3.backendLink.online, null, {
    timeout: 10_000,
  });

  // The Top flyers board appears in the menu header only when a backend is configured.
  await page.getByRole("button", { name: "Top flyers" }).waitFor();

  // Starting a run tells the first story beat with the Narrator.
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Let’s fly" }).waitFor();
  await page.keyboard.press("Enter");
  await waitForPlaying(page);
  await page.waitForFunction(() => window.dev3.audioEngine.ready);
  await page.waitForFunction(() =>
    window.voiceLog.some((entry) => entry.event === "level_start" && entry.id),
  );
  const opening = await page.evaluate(() => window.voiceLog[0].id);
  assert.match(opening, /^narrator_start_/, "a run opens with the Narrator");
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press("Space");
    await page.waitForTimeout(120);
  }
  await page.waitForFunction(() => window.clipsStarted >= 3);

  // Death 1: the hand-written kitchen line plays at once and is captioned with the run's rank.
  await page.evaluate(() => {
    const scene = window.testGame.scene.getScene("Game");
    scene.flight.altitude = 23;
    scene.finishRun("pot");
  });
  await page.getByRole("button", { name: "Fly again" }).waitFor();
  await page
    .locator(".dev3-panel [data-dev3-speaker]")
    .filter({ hasText: "Chef Gustavo" })
    .waitFor();
  await page
    .locator(".dev3-panel [data-dev3-rank]")
    .filter({ hasText: "#1" })
    .waitFor();
  const firstCaption = await page
    .locator(".dev3-quote blockquote")
    .textContent();
  assert.ok(
    firstCaption.length > 8,
    "the death line is captioned for players with sound off",
  );

  // Renaming updates the saved run.
  await page.locator("#dev3-name").fill("E2E Pidge");
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByRole("button", { name: "Saved" }).waitFor();
  const board = await (await fetch(`${backendUrl}/leaderboard`)).json();
  assert.equal(board.entries[0].name, "E2E Pidge");
  assert.equal(board.entries[0].altitude, 23);
  await page.screenshot({ path: "test-results/voice-results.png" });

  // Death 2: the backend writes a live roast; the cached line must not also play.
  await page.getByRole("button", { name: "Fly again" }).click();
  await waitForPlaying(page);
  const diedAt = await page.evaluate(() => {
    const scene = window.testGame.scene.getScene("Game");
    scene.flight.altitude = 31;
    const at = performance.now();
    scene.finishRun("knife");
    return at;
  });
  await page.waitForFunction(
    () => window.dev3.voiceDirector.lastDeathLine,
    null,
    {
      timeout: 6000,
    },
  );
  const second = await page.evaluate((since) => {
    const line = window.dev3.voiceDirector.lastDeathLine;
    return {
      line,
      ms: performance.now() - since,
      deathLines: window.voiceLog.filter(
        (entry) => entry.event === "death" && entry.at > since && entry.id,
      ).length,
    };
  }, diedAt);
  await page.getByRole("button", { name: "Fly again" }).waitFor();
  if (liveRoast) {
    assert.equal(
      second.line.live,
      true,
      `expected a live roast, got ${JSON.stringify(second.line)}
${backendLog.join("")}`,
    );
    assert.equal(
      second.deathLines,
      0,
      "a roasted death never also plays the cached line",
    );
    await page.locator(".dev3-live").waitFor();
  } else {
    assert.equal(second.line.live, false);
  }
  await page.screenshot({ path: "test-results/voice-roast.png" });

  // Menu board lists the renamed run.
  await page.getByRole("button", { name: "Back to the nest" }).click();
  await page.getByRole("button", { name: "Top flyers" }).click();
  // Both runs after the rename are saved under the new call sign.
  await page
    .locator(".dev3-popover li")
    .filter({ hasText: "E2E Pidge" })
    .nth(1)
    .waitFor();
  await page.screenshot({ path: "test-results/voice-top-flyers.png" });
  await page.keyboard.press("Escape");

  // Backend dies mid-session: the game keeps playing and deaths still get a voice line.
  backend.kill();
  await page.waitForFunction(() => !window.dev3.backendLink.online, null, {
    timeout: 10_000,
  });
  await page.getByRole("button", { name: "Take flight" }).click();
  await page.getByRole("button", { name: "Let’s fly" }).click();
  await waitForPlaying(page);
  const offlineAt = await page.evaluate(() => {
    const scene = window.testGame.scene.getScene("Game");
    scene.flight.altitude = 12;
    const at = performance.now();
    scene.finishRun("fall");
    return at;
  });
  await page.getByRole("button", { name: "Fly again" }).waitFor();
  const offline = await page.evaluate(
    (since) => ({
      line: window.dev3.voiceDirector.lastDeathLine,
      rankShown: !document.querySelector(".dev3-board")?.hidden,
      deathLines: window.voiceLog.filter(
        (entry) => entry.event === "death" && entry.at > since,
      ).length,
    }),
    offlineAt,
  );
  assert.equal(
    offline.deathLines,
    1,
    "offline deaths play the cached line immediately",
  );
  assert.equal(offline.line?.live, false);
  assert.equal(offline.rankShown, false, "no stale rank is shown offline");

  assert.deepEqual(errors, []);
  await mkdir("test-results", { recursive: true });
  console.log(
    [
      "Voice checks passed: narrator opening, flap SFX, captioned chef death line, rank + rename,",
      liveRoast
        ? `live roast in ${Math.round(second.ms)} ms ("${second.line.text}") with no doubled line,`
        : "cached fallback without keys,",
      "Top flyers board, backend killed mid-session with cached voice and no errors.",
      `Audio clips started: ${await page.evaluate(() => window.clipsStarted)}.`,
    ].join(" "),
  );
} finally {
  await browser?.close();
  backend.kill();
  await server.close();
}
