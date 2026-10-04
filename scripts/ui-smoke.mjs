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
    window.cameraBehavior = "deny";
    Object.defineProperty(navigator, "mediaDevices", {
      value: {
        getUserMedia: () => {
          window.cameraRequests++;
          if (window.cameraBehavior === "pending") {
            return new Promise((_resolve, reject) => {
              window.rejectCamera = reject;
            });
          }
          return Promise.reject(
            new DOMException(
              "Camera blocked for the fallback check",
              "NotAllowedError",
            ),
          );
        },
      },
    });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  await page.goto(`${url}/?kb`);
  await page.getByRole("button", { name: "Take flight" }).waitFor();
  await page.waitForFunction(
    () => !document.querySelector("[data-action=advance]").disabled,
  );
  await page.evaluate(async () => {
    const { game } = await import("/src/main.ts");
    window.testGame = game;
    await Promise.all(Array.from(document.images, (image) => image.decode()));
  });
  assert.equal(
    await page.evaluate(() => window.cameraRequests),
    0,
    "opening the menu never requests a camera",
  );
  const artMatches = await page.evaluate(async () => {
    const { HAZARD_ART } = await import("/src/game/hazardAppearance.ts");
    return Object.values(HAZARD_ART)
      .flatMap((world) => Object.values(world).flat())
      .every((art) => {
        const texture = window.testGame.textures
          .get(art.texture)
          .getSourceImage();
        return (
          texture.width > 0 &&
          Math.abs(
            art.width / art.height / (texture.width / texture.height) - 1,
          ) < 0.04
        );
      });
  });
  assert.ok(
    artMatches,
    "the loaded obstacle artwork and its collision box share the same proportions",
  );
  await mkdir("test-results", { recursive: true });
  await page.screenshot({ path: "test-results/ui-menu.png" });

  // Enter activates a focused native button without also advancing the game menu.
  await page.getByRole("button", { name: "Use my camera" }).focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() =>
    document
      .querySelector("[data-input-status]")
      .textContent.includes("Camera unavailable"),
  );
  assert.equal(
    await page.locator("#game-ui").getAttribute("data-view"),
    "menu",
  );
  assert.equal(await page.evaluate(() => window.cameraRequests), 1);
  await page.getByRole("button", { name: "Keyboard", exact: true }).click();
  await page.evaluate(() => {
    window.cameraBehavior = "pending";
  });
  await page.getByRole("button", { name: "Use my camera" }).click();
  await page.waitForFunction(() => Boolean(window.rejectCamera));
  assert.equal(
    await page.getByRole("button", { name: "Take flight" }).isDisabled(),
    true,
  );
  await page.getByRole("button", { name: "Keyboard", exact: true }).click();
  await page.evaluate(() =>
    window.rejectCamera(
      new DOMException("Cancelled camera request", "NotAllowedError"),
    ),
  );
  await page.waitForFunction(
    () => !document.querySelector("[data-action=advance]").disabled,
  );
  assert.match(
    await page.locator("[data-input-status]").textContent(),
    /Keyboard ready/,
  );

  await page.getByRole("button", { name: "Take flight" }).click();
  await page
    .getByRole("heading", { name: "You’ve got wings. Let’s use them." })
    .waitFor();
  assert.equal(await page.locator(".lesson-card").count(), 3);
  await page.screenshot({ path: "test-results/ui-controls.png" });
  await page.getByRole("button", { name: "Let’s fly" }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Pause game" }).waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("dialog", { name: "A little breather." }).waitFor();
  assert.equal(
    await page.locator(".play-hud").evaluate((element) => element.inert),
    true,
  );
  const paused = await page.evaluate(() => {
    const scene = window.testGame.scene.getScene("Game");
    return {
      x: scene.flight.x,
      y: scene.flight.y,
      velocity: scene.flight.velocity,
    };
  });
  await page.keyboard.press("Space");
  await page.waitForFunction(async () => {
    const { keyboard } = await import("/src/input/defaultInput.ts");
    return (
      window.testGame.scene.getScene("Game").flight.lastFlapCount ===
      keyboard.getState().flapCount
    );
  });
  assert.deepEqual(
    await page.evaluate(() => {
      const scene = window.testGame.scene.getScene("Game");
      return {
        x: scene.flight.x,
        y: scene.flight.y,
        velocity: scene.flight.velocity,
      };
    }),
    paused,
    "pausing freezes movement and discards flaps behind the dialog",
  );
  await page.keyboard.press("Shift+Tab");
  assert.equal(
    await page.evaluate(() => document.activeElement.dataset.action),
    "keyboard",
    "backwards focus remains inside the dialog",
  );
  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(() => document.activeElement.dataset.action),
    "resume",
  );
  assert.equal(
    await page.evaluate(
      () => getComputedStyle(document.activeElement).outlineStyle,
    ),
    "solid",
  );
  await page.screenshot({ path: "test-results/ui-pause.png" });
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    () => document.getElementById("game-ui").dataset.view === "playing",
  );
  assert.equal(
    await page.locator(".play-hud").evaluate((element) => element.inert),
    false,
  );
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.getByRole("dialog", { name: "A little breather." }).waitFor();
  await page.getByRole("button", { name: "Keep flying" }).click();
  await page.evaluate(async () => {
    const { inputManager } = await import("/src/input/inputManager.ts");
    const { EMPTY_INPUT } = await import("/src/input/types.ts");
    window.cameraInput = {
      ...EMPTY_INPUT,
      tracking: true,
      calibrated: true,
      flapCount: 80,
      selectCount: 40,
      menuConfirmMode: "clap",
      steeringMode: "head",
      turnLeftCount: 12,
      turnRightCount: 8,
    };
    window.testManager = inputManager;
    inputManager.setSource({ getState: () => window.cameraInput });
  });
  await page.waitForFunction(
    () => window.testGame.scene.getScene("Game").flight.lastFlapCount === 80,
  );
  assert.equal(
    await page.locator("#game-ui").getAttribute("data-view"),
    "playing",
    "changing producers does not replay old confirmations",
  );
  await page.keyboard.press("Escape");
  await page.getByRole("dialog", { name: "A little breather." }).waitFor();
  await page.evaluate(() => {
    window.cameraInput.selectCount++;
  });
  await page.waitForFunction(
    () => document.getElementById("game-ui").dataset.view === "playing",
  );
  await page.evaluate(async () => {
    const { keyboard } = await import("/src/input/defaultInput.ts");
    window.testManager.setSource(keyboard);
  });
  await page.evaluate(() =>
    window.testGame.scene.getScene("Game").finishRun("fall"),
  );
  await page.getByRole("button", { name: "Fly again" }).waitFor();
  await page.screenshot({ path: "test-results/ui-results.png" });
  await page.getByRole("button", { name: "Fly again" }).click();
  await page.getByRole("button", { name: "Pause game" }).waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Back to the nest" }).click();
  await page.getByRole("button", { name: "Take flight" }).waitFor();

  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 900, height: 900 },
    { width: 390, height: 844 },
    { width: 320, height: 568 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    const layout = await page.locator("#game-ui").evaluate((element) => ({
      width: element.clientWidth,
      scrollWidth: element.scrollWidth,
      height: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
    assert.ok(
      layout.scrollWidth <= layout.width + 1,
      `menu fits ${viewport.width}px without horizontal scrolling`,
    );
    if (viewport.width === 1280) {
      assert.ok(
        layout.scrollHeight <= layout.height + 1,
        "the desktop menu fits a 720p display",
      );
    }
    assert.ok(
      (await page.getByRole("button", { name: "Take flight" }).boundingBox())
        .height >= 44,
    );
    if (viewport.width === 390) {
      await page.screenshot({ path: "test-results/ui-mobile-menu.png" });
    }
    await page.getByRole("button", { name: "Take flight" }).click();
    await page
      .getByRole("heading", { name: "You’ve got wings. Let’s use them." })
      .waitFor();
    const controlsWidth = await page
      .locator("#game-ui")
      .evaluate((element) => element.scrollWidth - element.clientWidth);
    assert.ok(
      controlsWidth <= 1,
      `controls fit ${viewport.width}px without horizontal scrolling`,
    );
    if (viewport.width === 390) {
      await page.screenshot({ path: "test-results/ui-mobile-controls.png" });
    }
    await page.keyboard.press("Escape");
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(
    await page
      .locator(".hero-pigeon")
      .evaluate((element) => getComputedStyle(element).animationName),
    "none",
  );
  assert.deepEqual(errors, []);

  // Missing art has a visible recovery instruction rather than a broken playable world.
  const failedPage = await context.newPage();
  await failedPage.route("**/assets/art/map-kitchen.webp", (route) =>
    route.abort(),
  );
  await failedPage.goto(`${url}/?kb`);
  await failedPage.waitForFunction(() =>
    document
      .querySelector("[data-asset-status]")
      .textContent.includes("couldn’t load"),
  );
  assert.equal(
    await failedPage.getByRole("button", { name: "Take flight" }).isDisabled(),
    true,
  );
  console.log(
    "UI checks passed: designer art, matching obstacle proportions, native buttons, opt-in camera, permission fallback, cancelled camera request, controls, pause/resume, discarded paused flaps, focus trap, visible focus, blur pause, retry, five viewport sizes, 720p fit, reduced motion, asset failure recovery, no runtime errors.",
  );
} finally {
  await browser?.close();
  await server.close();
}
