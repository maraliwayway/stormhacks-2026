import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { createServer } from "vite";

// The server and browser share this process's local network environment.
const server = await createServer({
  server: { host: "127.0.0.1", port: 0, strictPort: false },
});
await server.listen();
const address = server.httpServer.address();
const url = `http://127.0.0.1:${address.port}`;
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
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${url}/?nocamera`);
  await page.waitForSelector("canvas");
  await page.evaluate(async () => {
    const { game } = await import("/src/main.ts");
    window.testGame = game;
    window.testManager = (
      await import("/src/input/inputManager.ts")
    ).inputManager;
    window.testEmpty = (await import("/src/input/types.ts")).EMPTY_INPUT;
  });
  await page.waitForFunction(() => {
    const game = window.testGame;
    return game.scene.isActive("Boot");
  });
  const canvas = await page.locator("canvas").boundingBox();
  assert.ok(Math.abs(canvas.width / canvas.height - 16 / 9) < 0.01);
  await mkdir("test-results", { recursive: true });
  // Real gesture recognition feeds the same counter contract as the camera source.
  await page.evaluate(async () => {
    const { createGestureDetector, DEFAULT_CALIBRATION: cal } = await import(
      "/src/input/cv/gestureDetector.ts"
    );
    const { L } = await import("/src/input/cv/landmarks.ts");
    const detector = createGestureDetector();
    let timestampMs = 1000;
    window.motionInput = {
      ...window.testEmpty,
      tracking: true,
      calibrated: true,
      menuConfirmMode: "clap",
      selectCount: 0,
    };
    window.testManager.setSource({ getState: () => window.motionInput });
    window.motionFrames = ({
      together = false,
      lean = 0,
      headX = 0.5,
      hiddenWrist = false,
      sweepX = null,
      frames = 6,
    } = {}) => {
      for (let frame = 0; frame < frames; frame++) {
        const points = Array.from({ length: 33 }, () => ({
          x: 0.5,
          y: 0.6,
          visibility: 1,
        }));
        for (const index of [L.NOSE, L.EYE_L, L.EYE_R, L.EAR_L, L.EAR_R]) {
          points[index] = { x: headX, y: 0.2, visibility: 1 };
        }
        points[L.SHOULDER_L] = {
          x: 0.375 + lean,
          y: cal.shoulderY,
          visibility: 1,
        };
        points[L.SHOULDER_R] = {
          x: 0.625 + lean,
          y: cal.shoulderY,
          visibility: 1,
        };
        points[L.HIP_L] = { x: 0.375, y: cal.hipY, visibility: 1 };
        points[L.HIP_R] = { x: 0.625, y: cal.hipY, visibility: 1 };
        points[L.WRIST_L] = {
          x: together ? 0.49 : 0.35,
          y: together ? 0.43 : 0.6,
          visibility: hiddenWrist ? 0.05 : 0.35,
        };
        points[L.WRIST_R] = {
          x: sweepX ?? (together ? 0.51 : 0.65),
          y: sweepX !== null ? cal.shoulderY : together ? 0.43 : 0.6,
          visibility: 0.35,
        };
        timestampMs += 33;
        const gestures = detector.update(points, timestampMs, cal);
        window.motionInput = {
          ...window.testEmpty,
          ...gestures,
          calibrated: true,
          menuConfirmMode: "clap",
          selectCount: gestures.prayerCount,
        };
      }
    };
    for (const sweepX of [0.65, 0.6, 0.55, 0.5, 0.45, 0.4, 0.35]) {
      window.motionFrames({ sweepX, frames: 3 });
    }
    window.motionInput.jump = true;
    window.motionInput.select = true;
  });
  await page.waitForTimeout(100);
  assert.equal(
    await page.evaluate(() => window.testGame.scene.isActive("Game")),
    false,
    "swipes and jumps cannot select camera menus",
  );
  await page.waitForFunction(() => {
    const scene = window.testGame.scene.getScene("Boot");
    return scene.inputSource === window.testManager.getSource();
  });
  const preview = await page.evaluate(async () => {
    const { mountCameraPanel } = await import("/src/input/cv/cameraPanel.ts");
    const { previewBounds } = await import("/src/input/cv/previewBounds.ts");
    const surface = document.createElement("canvas");
    surface.width = 1280;
    surface.height = 720;
    const context = surface.getContext("2d");
    context.fillStyle = "#295351";
    context.fillRect(0, 0, surface.width, surface.height);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    window.motionStream = surface.captureStream(30);
    video.srcObject = window.motionStream;
    await video.play();
    window.motionPanel = mountCameraPanel(
      {
        getState: () => window.motionInput,
        getCalibration: () => ({ phase: "done", progress: 1 }),
        getPrompt: () => null,
      },
      video,
      document.getElementById("game"),
    );
    const { gameUi } = await import("/src/ui/gameUi.ts");
    gameUi.setCameraStatus("ready");
    const slot = document
      .querySelector(".mirror .camera-slot")
      .getBoundingClientRect();
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const panel = document
      .querySelector(".camera-panel")
      .getBoundingClientRect();
    const tips = document.querySelector(".tips").getBoundingClientRect();
    return {
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
      objectFit: video.style.objectFit,
      bounds: previewBounds(video, 640, 480),
      slot: { left: slot.left, top: slot.top, width: slot.width },
      panel: { left: panel.left, top: panel.top, width: panel.width },
      tipsRight: tips.right,
      button: !document.querySelector("[data-action=advance]").disabled,
    };
  });
  assert.equal(preview.videoWidth, 1280);
  assert.equal(preview.videoHeight, 720);
  assert.equal(preview.objectFit, "contain");
  assert.deepEqual(preview.bounds, { x: 0, y: 60, width: 640, height: 360 });
  for (const key of ["left", "top", "width"]) {
    assert.ok(
      Math.abs(preview.panel[key] - preview.slot[key]) < 1,
      "the bird sits in the mirror",
    );
  }
  assert.ok(preview.tipsRight < preview.slot.left, "tips clear the mirror");
  assert.equal(preview.button, true, "a calibrated player can fly");
  await page.waitForTimeout(300);
  await page.screenshot({ path: "test-results/head-controls.png" });
  await page.evaluate(() => {
    window.motionFrames();
    window.motionFrames({ together: true });
  });
  await page.waitForFunction(() => window.testGame.scene.isActive("Game"));
  assert.equal(
    await page.evaluate(() => window.testGame.scene.getScene("Game").flight.x),
    640,
    "prayer selection keeps the starting lane centred",
  );
  await page.evaluate(() => {
    window.motionFrames({ lean: 0.015, hiddenWrist: true });
  });
  assert.equal(await page.evaluate(() => window.motionInput.tracking), true);
  await page.waitForTimeout(100);
  assert.equal(
    await page.evaluate(() => window.testGame.scene.getScene("Game").flight.x),
    640,
    "shoulder motion cannot turn while the head stays centered",
  );
  await page.evaluate(() => {
    window.motionFrames({ headX: 0.7, hiddenWrist: true });
  });
  await page.waitForFunction(
    () => window.testGame.scene.getScene("Game").flight.x === 340,
  );
  await page.waitForTimeout(100);
  assert.equal(
    await page.evaluate(() => window.testGame.scene.getScene("Game").flight.x),
    340,
    "a held head position changes only one lane",
  );
  await page.screenshot({ path: "test-results/head-left.png" });
  await page.evaluate(() => {
    window.motionFrames({ hiddenWrist: true });
  });
  await page.waitForTimeout(100);
  assert.equal(
    await page.evaluate(() => window.testGame.scene.getScene("Game").flight.x),
    340,
    "centering the head keeps the current lane",
  );
  await page.screenshot({ path: "test-results/head-center.png" });
  await page.evaluate(() => {
    window.motionFrames({ headX: 0.3, hiddenWrist: true });
  });
  await page.waitForFunction(
    () => window.testGame.scene.getScene("Game").flight.x === 640,
  );
  await page.evaluate(() => {
    window.motionFrames();
    window.motionFrames({ headX: 0.3 });
  });
  await page.waitForFunction(
    () => window.testGame.scene.getScene("Game").flight.x === 940,
  );
  await page.evaluate(() => {
    window.testGame.scene.getScene("Game").showGameOver();
    window.motionInput.flapCount++;
    window.motionInput.jump = true;
  });
  await page.waitForTimeout(100);
  assert.equal(
    await page.evaluate(() => window.testGame.scene.getScene("Game").phase),
    "over",
    "camera flaps and jumps cannot select a game-over action",
  );
  await page.evaluate(() => {
    window.motionFrames();
    window.motionFrames({ together: true });
  });
  await page.waitForFunction(() => {
    const scene = window.testGame.scene.getScene("Game");
    return window.testGame.scene.isActive("Game") && scene.phase === "playing";
  });
  await page.evaluate(async () => {
    window.motionPanel.destroy();
    for (const track of window.motionStream.getTracks()) {
      track.stop();
    }
    window.fallInput = {
      ...window.testEmpty,
      tracking: true,
      calibrated: true,
      menuConfirmMode: "clap",
      selectCount: 0,
    };
    window.testManager.setSource({ getState: () => window.fallInput });
    window.testGame.scene.stop("Game");
    window.testGame.scene.start("Boot");
  });
  await page.waitForFunction(() => window.testGame.scene.isActive("Boot"));
  await page.evaluate(() => window.fallInput.selectCount++);
  await page.waitForFunction(() =>
    Boolean(
      window.testGame.scene.isActive("Game") &&
        window.testGame.scene.getScene("Game").flight,
    ),
  );
  await mkdir("test-results", { recursive: true });
  await page.screenshot({ path: "test-results/core.png" });
  // Let gravity finish a real run, then restart from the results card.
  await page.waitForFunction(
    () => window.testGame.scene.getScene("Game").phase === "over",
    null,
    { timeout: 10000 },
  );
  await page.getByRole("button", { name: "Play again" }).click();
  await page.waitForFunction(() => {
    const game = window.testGame;
    const scene = game.scene.getScene("Game");
    return (
      game.scene.isActive("Game") &&
      scene.phase === "playing" &&
      Boolean(scene.flight && scene.hazards)
    );
  });

  // Drive the existing InputSource seam with a fake CV producer to verify integration.
  await page.evaluate(async () => {
    const inputManager = window.testManager;
    const EMPTY_INPUT = window.testEmpty;
    window.testInput = { ...EMPTY_INPUT, tracking: true, calibrated: true };
    inputManager.setSource({ getState: () => window.testInput });
    const game = window.testGame;
    const scene = game.scene.getScene("Game");
    scene.hazards.items = [];
    scene.hazards.advance = () => undefined;
    scene.enemies.items = [];
    scene.enemies.tick = () => undefined;
    window.nextFlap = setInterval(() => {
      window.testInput.flapCount++;
    }, 333);
  });
  await page.waitForFunction(
    () => {
      const game = window.testGame;
      return game.scene.getScene("Game").flight.altitude > 25;
    },
    null,
    { timeout: 15000 },
  );
  const flight = await page.evaluate(async () => {
    const game = window.testGame;
    const scene = game.scene.getScene("Game");
    return {
      altitude: scene.flight.altitude,
      camera: scene.flight.cameraY,
    };
  });
  assert.ok(flight.camera < 0);
  const pickupEnabled = await page.evaluate(
    () => !document.querySelector("[data-worm-total]").hidden,
  );
  if (pickupEnabled) {
    const previous = await page.evaluate(() => {
      const scene = window.testGame.scene.getScene("Game");
      const before = document.querySelector("[data-worm-total]").textContent;
      scene.worms.items = [
        {
          id: 9999,
          x: scene.flight.x,
          y: scene.flight.y,
          width: 42,
          height: 30,
        },
      ];
      return before;
    });
    await page.waitForFunction(
      (before) =>
        document.querySelector("[data-worm-total]").textContent !== before,
      previous,
    );
    assert.equal(
      await page.evaluate(() => localStorage.getItem("flappy-arms.worms")),
      "1",
    );
  }
  await page.evaluate(() => {
    window.testInput.strafe = -1;
  });
  await page.waitForFunction(() => {
    const game = window.testGame;
    return game.scene.getScene("Game").flight.lane === 0;
  });
  await page.waitForFunction(
    () => window.testGame.scene.getScene("Game").flight.x === 340,
  );
  await page.evaluate(() => {
    window.testInput.strafe = 1;
  });
  await page.waitForFunction(
    () => window.testGame.scene.getScene("Game").flight.x === 640,
  );
  await page.waitForTimeout(200);
  assert.equal(
    await page.evaluate(() => window.testGame.scene.getScene("Game").flight.x),
    640,
    "holding a right tilt moves one lane and stays there",
  );
  await page.evaluate(() => {
    window.testInput.strafe = 0;
  });
  await page.waitForFunction(
    () => window.testGame.scene.getScene("Game").flight.strafeDirection === 0,
  );
  await page.evaluate(() => {
    window.testInput.strafe = 0.25;
  });
  await page.waitForFunction(
    () => window.testGame.scene.getScene("Game").flight.x === 940,
  );
  await page.evaluate(() => {
    window.testInput.strafe = -0.25;
  });
  await page.waitForFunction(
    () => window.testGame.scene.getScene("Game").flight.x === 640,
  );
  await mkdir("test-results", { recursive: true });
  await page.screenshot({ path: "test-results/gameplay.png" });
  const paused = await page.evaluate(async () => {
    const game = window.testGame;
    window.testInput.tracking = false;
    clearInterval(window.nextFlap);
    return game.scene.getScene("Game").flight.y;
  });
  await page.waitForTimeout(150);
  const pausedAfter = await page.evaluate(async () => {
    const game = window.testGame;
    return game.scene.getScene("Game").flight.y;
  });
  assert.equal(pausedAfter, paused);
  await page.setViewportSize({ width: 900, height: 900 });
  await page.waitForFunction(() => {
    const rect = document.querySelector("canvas").getBoundingClientRect();
    return rect.width <= 900 && rect.height <= 900;
  });
  const resized = await page.locator("canvas").boundingBox();
  assert.ok(Math.abs(resized.width / resized.height - 16 / 9) < 0.01);
  assert.ok(resized.width <= 900 && resized.height <= 900);
  // Place the bird at authored boundaries, then let the real scene update drive flow.
  await page.evaluate(async () => {
    window.testInput.tracking = true;
    const scene = window.testGame.scene.getScene("Game");
    // Boundary screenshots must not let gravity end this controlled test run.
    window.testGame.scene.pause("Game");
    scene.flight.y = 550 - 60 * 40;
    scene.flight.cameraY = scene.flight.y - 360;
    scene.flight.velocity = -100;
    window.endEvents = 0;
    window.winEvents = 0;
    const { gameEvents } = await import("/src/game/events.ts");
    gameEvents.on("run_end", () => window.endEvents++);
    gameEvents.on("win", () => window.winEvents++);
    scene.update(0, 16);
  });
  await page.waitForFunction(
    () => window.testGame.scene.getScene("Game").level.id === "dessert",
  );
  assert.equal(
    await page.evaluate(
      () => document.querySelector("[data-world-banner]").textContent,
    ),
    "the desert",
  );
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.screenshot({ path: "test-results/dessert.png" });
  // Step the paused scene through Heaven and multiple laps without ending the run.
  await page.evaluate(async () => {
    const { FLIGHT } = await import("/src/game/flight.ts");
    const { HazardField, BIRD_BOX } = await import("/src/game/hazards.ts");
    const { EnemyField, WARNING_SECONDS } = await import(
      "/src/game/enemies.ts"
    );
    window.levelEvents = [];
    const { gameEvents } = await import("/src/game/events.ts");
    gameEvents.on("level_start", (event) =>
      window.levelEvents.push(event.level),
    );
    window.visitAltitude = (altitude) => {
      const scene = window.testGame.scene.getScene("Game");
      scene.flight.y = FLIGHT.startY - altitude * FLIGHT.pixelsPerMetre;
      scene.flight.velocity = -100;
      scene.update(0, 16);
      const hazard = scene.hazards.items[0];
      return {
        level: scene.level.id,
        phase: scene.phase,
        altitude: scene.flight.altitude,
        score: `${document.querySelector("[data-altitude]").textContent} m`,
        hazards: scene.hazards.items.length,
        enemies: scene.enemies.items.length,
        worms: scene.worms.items.length,
        hint: scene.hint,
        hazardLead: hazard
          ? scene.flight.y -
            BIRD_BOX.height / 2 -
            (hazard.y + hazard.height / 2)
          : null,
      };
    };
    window.restoreFields = () => {
      const scene = window.testGame.scene.getScene("Game");
      scene.hazards.advance = HazardField.prototype.advance;
      scene.enemies.advanceGrace(5, 1);
      scene.enemies.tick = EnemyField.prototype.tick;
    };
    // Carry an obstacle and a warning cat into Heaven: a map change must not remove them.
    const scene = window.testGame.scene.getScene("Game");
    scene.hazards.items = [
      {
        id: 100,
        x: 340,
        y: FLIGHT.startY - 135 * FLIGHT.pixelsPerMetre,
        width: 96,
        height: 62,
        kind: "pot",
        passed: false,
      },
    ];
    scene.enemies.items = [
      {
        kind: "cat-paw",
        lane: 0,
        x: 340,
        y: 0,
        width: 220,
        height: 720,
        age: WARNING_SECONDS / 2,
        faceOffset: 200,
        strikeChecked: false,
        crossedStrike: false,
      },
    ];
  });
  const visit = (altitude) =>
    page.evaluate((altitude) => window.visitAltitude(altitude), altitude);
  const heaven = await visit(120);
  assert.equal(heaven.level, "heaven");
  assert.equal(heaven.phase, "playing");
  assert.deepEqual(
    [heaven.hazards, heaven.enemies],
    [1, 1],
    "the obstacle and cat survive entering Heaven",
  );
  assert.equal(
    await page.evaluate(
      () => document.querySelector("[data-world-banner]").textContent,
    ),
    "bird heaven",
  );
  await page.screenshot({ path: "test-results/heaven.png" });
  assert.equal((await visit(135)).level, "heaven");
  // Check obstacle resumption separately from the carried cat.
  await page.evaluate(async () => {
    const { HazardField } = await import("/src/game/hazards.ts");
    const scene = window.testGame.scene.getScene("Game");
    scene.enemies.items = [];
    scene.hazards.advance = HazardField.prototype.advance;
  });
  const kitchenAgain = await visit(150);
  assert.equal(kitchenAgain.level, "kitchen");
  assert.equal(kitchenAgain.phase, "playing");
  assert.equal(kitchenAgain.score, "150 m");
  assert.equal(kitchenAgain.hazards, 1, "one obstacle resumes after Heaven");
  assert.ok(
    kitchenAgain.hazardLead >= 2500,
    "obstacles resume with a full reaction gap",
  );
  await page.screenshot({ path: "test-results/kitchen-loop.png" });
  assert.equal((await visit(210)).level, "dessert");
  assert.equal((await visit(270)).level, "heaven");
  await page.evaluate(() => window.restoreFields());
  const thirdKitchen = await visit(300);
  assert.equal(thirdKitchen.level, "kitchen");
  assert.equal(thirdKitchen.phase, "playing");
  assert.equal(thirdKitchen.enemies, 1, "one cat resumes after Heaven");
  assert.ok(
    thirdKitchen.hazards <= 1,
    "a cat never adds a second map obstacle",
  );
  assert.deepEqual(await page.evaluate(() => window.levelEvents), [
    "heaven",
    "kitchen",
    "dessert",
    "heaven",
    "kitchen",
  ]);
  assert.deepEqual(
    await page.evaluate(() => [window.winEvents, window.endEvents]),
    [0, 0],
  );
  await page.evaluate(() =>
    window.testGame.scene.getScene("Game").finishRun("test"),
  );
  assert.deepEqual(
    await page.evaluate(() => [window.winEvents, window.endEvents]),
    [0, 1],
  );
  assert.ok(
    Number(
      await page.evaluate(() =>
        localStorage.getItem("flappy-arms.best-altitude"),
      ),
    ) >= 300,
  );
  // Isolate the authored encounter while running the real scene and renderer.
  await page.evaluate(async () => {
    window.testInput = {
      ...window.testEmpty,
      tracking: true,
      calibrated: true,
    };
    window.testGame.scene.start("Game");
  });
  await page.waitForFunction(
    () =>
      window.testGame.scene.isActive("Game") &&
      window.testGame.scene.getScene("Game").phase === "playing",
  );
  await page.evaluate(() => {
    const scene = window.testGame.scene.getScene("Game");
    window.testGame.scene.pause("Game");
    scene.flight.update = () => (window.startGrace ? 1 : 0);
    scene.flight.altitude = 20;
    scene.flight.x = 640;
    scene.hazards.advance = () => undefined;
    scene.hazards.items = [];
    scene.update(0, 0);
  });
  const catStep = async (frames) =>
    page.evaluate((frames) => {
      const scene = window.testGame.scene.getScene("Game");
      for (let i = 0; i < frames; i++) {
        scene.update(0, 25);
      }
      return {
        phase: scene.phase,
        age: scene.enemies.items[0]?.age,
        x: scene.enemies.items[0]?.x,
      };
    }, frames);
  assert.equal(
    (await catStep(40)).age,
    undefined,
    "waiting without flapping does not use grace",
  );
  await page.evaluate(() => {
    window.startGrace = true;
  });
  assert.equal(
    (await catStep(100)).age,
    undefined,
    "no cat during the first 2.5 seconds",
  );
  await page.evaluate(() => {
    window.startGrace = false;
    window.testInput.tracking = false;
  });
  assert.equal(
    (await catStep(240)).age,
    undefined,
    "tracking pause preserves remaining grace",
  );
  await page.evaluate(() => {
    window.testInput.tracking = true;
  });
  assert.equal(
    (await catStep(99)).age,
    undefined,
    "no cat before five active seconds",
  );
  const firstCat = await catStep(2);
  assert.equal(firstCat.phase, "playing");
  assert.ok(
    firstCat.age >= 0 && firstCat.age < 0.05,
    "first cat starts a fresh warning",
  );
  assert.equal((await catStep(20)).phase, "playing");
  await page.screenshot({ path: "test-results/cat-warning.png" });
  const catAge = await page.evaluate(() => {
    window.testInput.tracking = false;
    return window.testGame.scene.getScene("Game").enemies.items[0].age;
  });
  assert.equal((await catStep(20)).age, catAge);
  await page.evaluate(() => {
    window.testInput.tracking = true;
    window.testGame.scene.getScene("Game").flight.x = 340;
  });
  const dodged = await catStep(81);
  assert.equal(dodged.phase, "playing");
  assert.equal(dodged.x, 640);
  await page.screenshot({ path: "test-results/cat-paw.png" });
  await page.evaluate(() => {
    window.testGame.scene.getScene("Game").flight.x = 640;
  });
  assert.equal((await catStep(1)).phase, "dying");
  await page.goto(`${url}/cv-test.html`);
  assert.equal(
    await page.locator("#kb").count(),
    0,
    "the debug page has no keyboard controls",
  );
  assert.deepEqual(errors, []);
  console.log(
    "Browser checks passed: prayer-only menus, release before repeat, swipes and jumps rejected, head zones despite wrist occlusion, inert centre, release before another turn, canvas fit, camera-only start, fall, play-again, prayer retry, CV input, ascent, lane change, tracking pause, resize, Kitchen, Dessert, Heaven, threats kept across maps, repeated loops, continuous score, resumed obstacles, death-only run end, cat warning, locked lane, tracking pause, dodge, paw collision, CV debug page, no runtime errors.",
  );
} finally {
  await browser?.close();
  await server.close();
}
