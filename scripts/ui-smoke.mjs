import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { createServer } from "vite";

const server = await createServer({
  server: { host: "127.0.0.1", port: 0, strictPort: false },
});
await server.listen();
const url = `http://127.0.0.1:${server.httpServer.address().port}`;
let browser;
try {
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  await context.addInitScript(() => {
    window.cameraRequests = 0;
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: () => {
          window.cameraRequests++;
          return Promise.reject(
            new DOMException("Camera blocked for the check", "NotAllowedError"),
          );
        },
      },
    });
  });
  await mkdir("test-results", { recursive: true });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });

  // The camera is the controller, so the page asks for it straight away.
  await page.goto(url);
  await page.waitForFunction(() => window.cameraRequests === 1);
  const retry = page.getByRole("button", { name: "Try again" });
  await retry.waitFor();
  assert.match(
    await page.locator("[data-menu-status]").textContent(),
    /needs your camera/,
  );
  assert.equal(
    await page.locator("[data-action=advance]").isDisabled(),
    true,
    "nobody can start without a calibrated camera",
  );
  await page.screenshot({ path: "test-results/ui-camera-blocked.png" });
  await retry.click();
  await page.waitForFunction(() => window.cameraRequests === 2);

  // The first click unlocks audio; the sound button then mutes and remembers it.
  await page.waitForSelector('#game-ui[data-sound="on"]');
  assert.equal(await page.locator("[data-sound-hint]").isHidden(), true);
  await page.getByRole("button", { name: "Turn sound off" }).click();
  await page.waitForSelector('#game-ui[data-sound="muted"]');
  assert.equal(
    await page.evaluate(() => localStorage.getItem("flap-or-flop.muted")),
    "1",
  );
  await page.getByRole("button", { name: "Turn sound on" }).click();
  await page.waitForSelector('#game-ui[data-sound="on"]');

  // Keys never control the game.
  await page.evaluate(async () => {
    window.testGame = (await import("/src/main.ts")).game;
    window.testManager = (
      await import("/src/input/inputManager.ts")
    ).inputManager;
    const { EMPTY_INPUT } = await import("/src/input/types.ts");
    window.pose = {
      ...EMPTY_INPUT,
      tracking: true,
      calibrated: true,
      menuConfirmMode: "clap",
      selectCount: 0,
    };
    window.testManager.setSource({ getState: () => window.pose });
    (await import("/src/ui/gameUi.ts")).gameUi.setCameraStatus("ready");
  });
  for (const key of ["Enter", "Space", "ArrowUp", "Escape"]) {
    await page.keyboard.press(key);
  }
  await page.waitForTimeout(150);
  assert.equal(
    await page.evaluate(() => window.testGame.scene.isActive("Game")),
    false,
    "keyboard presses do not start the game",
  );
  assert.equal(await page.locator("[data-action=advance]").isDisabled(), false);
  await page.screenshot({ path: "test-results/ui-title.png" });

  // Warm-up card: safe links in a new tab; palms together closes it without starting.
  await page.getByRole("button", { name: "Warm up first" }).click();
  const warmup = page.getByRole("dialog", { name: "warm up" });
  await warmup.waitFor();
  const links = await warmup
    .locator("a")
    .evaluateAll((anchors) =>
      anchors.map((anchor) => [anchor.href, anchor.target, anchor.rel]),
    );
  assert.equal(links.length, 3);
  for (const [href, target, rel] of links) {
    assert.match(href, /^https:\/\/www\.(nhs\.uk|youtube\.com)\//);
    assert.equal(target, "_blank");
    assert.match(rel, /noopener/);
  }
  await page.screenshot({ path: "test-results/ui-warmup.png" });
  await page.evaluate(() => window.pose.selectCount++);
  await warmup.waitFor({ state: "detached" });
  assert.equal(
    await page.evaluate(() => window.testGame.scene.isActive("Game")),
    false,
    "closing the warm-up card does not start a run",
  );

  // Palms together starts the run.
  await page.evaluate(() => window.pose.selectCount++);
  await page.waitForFunction(() => window.testGame.scene.isActive("Game"));
  await page.locator(".score").waitFor();
  assert.equal(
    await page.locator("[data-world-banner]").textContent(),
    "the kitchen",
  );
  await page.keyboard.press("Escape");
  await page.keyboard.press("Space");
  await page.waitForTimeout(100);
  assert.equal(
    await page.locator('[role="dialog"]').count(),
    0,
    "Escape does not pause",
  );
  assert.equal(
    await page.evaluate(() => window.testGame.scene.getScene("Game").runFlaps),
    0,
    "Space does not flap",
  );

  // Pause with the button; a flap behind the dialog never replays.
  await page.getByRole("button", { name: "Pause" }).click();
  await page.getByRole("dialog", { name: "paused" }).waitFor();
  const pausedY = await page.evaluate(() => {
    window.pose.flapCount += 3;
    return window.testGame.scene.getScene("Game").flight.y;
  });
  await page.waitForTimeout(150);
  assert.equal(
    await page.evaluate(() => window.testGame.scene.getScene("Game").flight.y),
    pausedY,
  );
  await page.screenshot({ path: "test-results/ui-pause.png" });
  await page.evaluate(() => window.pose.selectCount++);
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
  assert.equal(
    await page.evaluate(() => window.testGame.scene.getScene("Game").runFlaps),
    0,
    "flaps made while paused are discarded",
  );

  // Leaving the window pauses.
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.getByRole("dialog", { name: "paused" }).waitFor();
  await page.getByRole("button", { name: "Resume" }).click();

  // Losing the player shows a card with the camera in it.
  await page.evaluate(() => {
    window.pose.tracking = false;
  });
  await page.locator("[data-tracking-notice]").waitFor({ state: "visible" });
  await page.evaluate(() => {
    window.pose.tracking = true;
  });
  await page.locator("[data-tracking-notice]").waitFor({ state: "hidden" });

  // Results: play again by button, then palms together, then the menu.
  await page.evaluate(() =>
    window.testGame.scene.getScene("Game").finishRun("cat-paw"),
  );
  await page.getByRole("dialog", { name: "game over!" }).waitFor();
  assert.equal(await page.locator(".reason").textContent(), "The cat got you.");
  await page.screenshot({ path: "test-results/ui-results.png" });
  await page.getByRole("button", { name: "Play again" }).click();
  await page.waitForFunction(
    () => window.testGame.scene.getScene("Game").phase === "playing",
  );
  await page.evaluate(() =>
    window.testGame.scene.getScene("Game").finishRun("pot"),
  );
  await page.getByRole("dialog", { name: "game over!" }).waitFor();
  assert.equal(
    await page.locator(".reason").textContent(),
    "You flew into the cookware.",
  );
  await page.evaluate(() => window.pose.selectCount++);
  await page.waitForFunction(
    () =>
      window.testGame.scene.getScene("Game").phase === "playing" &&
      !document.querySelector('[role="dialog"]'),
  );
  await page.evaluate(() =>
    window.testGame.scene.getScene("Game").finishRun("fall"),
  );
  await page.getByRole("button", { name: "Menu" }).click();
  await page.waitForFunction(() => window.testGame.scene.isActive("Boot"));
  await page.locator(".title-screen").waitFor();

  // The UI layer always matches the 16:9 game, whatever the window.
  for (const [width, height] of [
    [1920, 1080],
    [1440, 900],
    [1280, 720],
    [1024, 768],
    [800, 600],
  ]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(150);
    const fit = await page.evaluate(() => {
      const canvas = document.querySelector("canvas").getBoundingClientRect();
      const ui = document.getElementById("game-ui").getBoundingClientRect();
      const screen = document
        .querySelector(".title-screen")
        .getBoundingClientRect();
      const overflow = Array.from(
        document.querySelectorAll(".title-screen *"),
      ).some((element) => {
        const rect = element.getBoundingClientRect();
        return (
          rect.width > 0 &&
          (rect.right > screen.right + 1 || rect.bottom > screen.bottom + 1)
        );
      });
      return { canvas, ui, overflow, scrollable: document.body.scrollHeight };
    });
    for (const key of ["left", "top", "width", "height"]) {
      assert.ok(
        Math.abs(fit.canvas[key] - fit.ui[key]) < 2,
        `UI matches the canvas at ${width}x${height}`,
      );
    }
    assert.equal(fit.overflow, false, `nothing spills at ${width}x${height}`);
    assert.ok(fit.scrollable <= height, "the page never scrolls");
  }

  assert.deepEqual(
    errors.filter((message) => !message.includes("camera unavailable")),
    [],
  );

  // Missing art has a visible recovery instruction rather than a broken world.
  const failedPage = await context.newPage();
  await failedPage.route("**/assets/art/map-kitchen.webp", (route) =>
    route.abort(),
  );
  await failedPage.goto(url);
  await failedPage.waitForFunction(() =>
    document
      .querySelector("[data-menu-status]")
      .textContent.includes("didn’t load"),
  );
  assert.equal(
    await failedPage.locator("[data-action=advance]").isDisabled(),
    true,
  );
  console.log(
    "UI checks passed: camera requested on load, blocked-camera retry, sound unlock and mute, keys ignored, warm-up card and links, palms-together start, world banner, pause button, discarded paused flaps, prayer resume, blur pause, lost-tracking card, results reasons, play again by button and prayer, menu, five window sizes, no page scroll, asset failure, no runtime errors.",
  );
} finally {
  await browser?.close();
  await server.close();
}
