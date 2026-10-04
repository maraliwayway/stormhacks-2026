import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createServer } from 'vite';

// The server and browser share this process's local network environment.
const server = await createServer({ server: { host: '127.0.0.1', port: 0, strictPort: false } });
await server.listen();
const address = server.httpServer.address();
const url = `http://127.0.0.1:${address.port}`;
let browser;
try {
  browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${url}/?kb`);
  await page.waitForSelector('canvas');
  await page.evaluate(async () => {
    const { game } = await import('/src/main.ts');
    window.testGame = game;
    window.testManager = (await import('/src/input/inputManager.ts')).inputManager;
    window.testEmpty = (await import('/src/input/types.ts')).EMPTY_INPUT;
  });
  await page.waitForFunction(() => {
    const game = window.testGame;
    return game.scene.isActive('Boot');
  });
  const canvas = await page.locator('canvas').boundingBox();
  assert.ok(Math.abs(canvas.width / canvas.height - 16 / 9) < 0.01);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.testGame.scene.getScene('Boot').stage === 'controls');
  assert.equal(await page.evaluate(() => window.testGame.scene.isActive('Game')), false);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => {
    const game = window.testGame;
    return game.scene.isActive('Game');
  });
  await page.waitForFunction(() => Boolean(window.testGame.scene.getScene('Game').flight));
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/core.png' });
  // Let gravity finish a real run, verify its card, then restart with a real flap.
  await page.waitForFunction(() => {
    const game = window.testGame;
    return game.scene.getScene('Game').phase === 'over';
  }, null, { timeout: 10000 });
  // A confirmation returns to the menu. A held jump cannot skip the controls.
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.testGame.scene.isActive('Boot'));
  await page.keyboard.down('ArrowUp');
  await page.waitForFunction(() => window.testGame.scene.getScene('Boot').stage === 'controls');
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => window.testGame.scene.isActive('Game')), false);
  await page.keyboard.up('ArrowUp');
  await page.waitForTimeout(50);
  await page.keyboard.press('ArrowUp');
  await page.waitForFunction(() => window.testGame.scene.isActive('Game'));
  await page.waitForFunction(() => window.testGame.scene.getScene('Game').phase === 'over', null, { timeout: 10000 });
  await page.keyboard.press('Space');
  await page.waitForFunction(() => {
    const game = window.testGame;
    const scene = game.scene.getScene('Game');
    return game.scene.isActive('Game') && scene.phase === 'playing' && Boolean(scene.flight && scene.hazards);
  });

  // Drive the existing InputSource seam with a fake CV producer to verify integration.
  await page.evaluate(async () => {
    const inputManager = window.testManager;
    const EMPTY_INPUT = window.testEmpty;
    window.testInput = { ...EMPTY_INPUT, tracking: true, calibrated: true };
    inputManager.setSource({ getState: () => window.testInput });
    const game = window.testGame;
    const scene = game.scene.getScene('Game');
    scene.hazards.items = [];
    scene.hazards.advance = () => {};
    scene.enemies.items = [];
    scene.enemies.tick = () => {};
    window.nextFlap = setInterval(() => { window.testInput.flapCount++; }, 333);
  });
  await page.waitForFunction(() => {
    const game = window.testGame;
    return game.scene.getScene('Game').flight.altitude > 25;
  }, null, { timeout: 15000 });
  const flight = await page.evaluate(async () => {
    const game = window.testGame;
    const scene = game.scene.getScene('Game');
    return { altitude: scene.flight.altitude, camera: scene.flight.cameraY, badge: scene.badge.visible };
  });
  assert.ok(flight.camera < 0);
  assert.equal(flight.badge, false);
  const pickupEnabled = await page.evaluate(() => window.testGame.scene.getScene('Game').wormHud.visible);
  if (pickupEnabled) {
    const previous = await page.evaluate(() => {
      const scene = window.testGame.scene.getScene('Game');
      const before = scene.wormHud.text;
      scene.worms.items = [{ id: 9999, x: scene.flight.x, y: scene.flight.y, width: 42, height: 30 }];
      return before;
    });
    await page.waitForFunction(before => window.testGame.scene.getScene('Game').wormHud.text !== before, previous);
    assert.equal(await page.evaluate(() => localStorage.getItem('flappy-arms.worms')), '1');
  }
  await page.evaluate(() => { window.testInput.strafe = -1; });
  await page.waitForFunction(() => {
    const game = window.testGame;
    return game.scene.getScene('Game').flight.lane === 0;
  });
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/gameplay.png' });
  const paused = await page.evaluate(async () => {
    const game = window.testGame;
    window.testInput.tracking = false;
    clearInterval(window.nextFlap);
    return game.scene.getScene('Game').flight.y;
  });
  await page.waitForTimeout(150);
  const pausedAfter = await page.evaluate(async () => {
    const game = window.testGame;
    return game.scene.getScene('Game').flight.y;
  });
  assert.equal(pausedAfter, paused);
  await page.setViewportSize({ width: 900, height: 900 });
  await page.waitForFunction(() => {
    const rect = document.querySelector('canvas').getBoundingClientRect();
    return rect.width <= 900 && rect.height <= 900;
  });
  const resized = await page.locator('canvas').boundingBox();
  assert.ok(Math.abs(resized.width / resized.height - 16 / 9) < 0.01);
  assert.ok(resized.width <= 900 && resized.height <= 900);
  // Place the bird at authored boundaries, then let the real scene update drive flow.
  await page.evaluate(async () => {
    window.testInput.tracking = true;
    const scene = window.testGame.scene.getScene('Game');
    scene.flight.y = 550 - 60 * 40;
    scene.flight.velocity = -100;
    window.endEvents = 0;
    window.winEvents = 0;
    const { gameEvents } = await import('/src/game/events.ts');
    gameEvents.on('run_end', () => window.endEvents++);
    gameEvents.on('win', () => window.winEvents++);
  });
  await page.waitForFunction(() => window.testGame.scene.getScene('Game').level.id === 'dessert');
  assert.equal(await page.evaluate(() => window.testGame.scene.getScene('Game').levelHud.text), 'DESSERT');
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.screenshot({ path: 'test-results/dessert.png' });
  // Real scene transitions keep one run alive through Heaven and multiple laps.
  await page.evaluate(async () => {
    window.testGame.scene.pause('Game');
    const { FLIGHT } = await import('/src/game/flight.ts');
    const { HazardField } = await import('/src/game/hazards.ts');
    const { EnemyField } = await import('/src/game/enemies.ts');
    window.levelEvents = [];
    const { gameEvents } = await import('/src/game/events.ts');
    gameEvents.on('level_start', event => window.levelEvents.push(event.level));
    window.visitAltitude = altitude => {
      const scene = window.testGame.scene.getScene('Game');
      scene.flight.y = FLIGHT.startY - altitude * FLIGHT.pixelsPerMetre;
      scene.flight.velocity = -100;
      scene.update(0, 16);
      return { level: scene.level.id, phase: scene.phase, altitude: scene.flight.altitude,
        score: scene.score.text, hazards: scene.hazards.items.length, enemies: scene.enemies.items.length,
        worms: scene.worms.items.length };
    };
    window.restoreFields = () => {
      const scene = window.testGame.scene.getScene('Game');
      scene.hazards.advance = HazardField.prototype.advance;
      scene.enemies.advanceGrace(5, 1);
      scene.enemies.tick = EnemyField.prototype.tick;
    };
    // Carry an existing obstacle, paw and pickup into Heaven: all must clear.
    const scene = window.testGame.scene.getScene('Game');
    scene.hazards.items = [{ id: 100, x: 640, y: FLIGHT.startY - 120 * FLIGHT.pixelsPerMetre,
      width: 96, height: 62, kind: 'pot', passed: false }];
    scene.enemies.items = [{ kind: 'cat-paw', lane: 1, x: 640, y: 0, width: 220, height: 720,
      age: 1.1, faceOffset: 200, strikeChecked: false, crossedStrike: true }];
    scene.worms.items = [{ id: 100, x: 640, y: 0, width: 42, height: 30 }];
  });
  const visit = altitude => page.evaluate(altitude => window.visitAltitude(altitude), altitude);
  const heaven = await visit(120);
  assert.equal(heaven.level, 'heaven');
  assert.equal(heaven.phase, 'playing');
  assert.deepEqual([heaven.hazards, heaven.enemies, heaven.worms], [0, 0, 0]);
  assert.equal(await page.evaluate(() => window.testGame.scene.getScene('Game').levelHud.text), 'BIRD HEAVEN');
  await page.screenshot({ path: 'test-results/heaven.png' });
  assert.equal((await visit(135)).level, 'heaven');
  // Check obstacle resumption separately from the cat's intentional clear corridor.
  await page.evaluate(async () => {
    const { HazardField } = await import('/src/game/hazards.ts');
    window.testGame.scene.getScene('Game').hazards.advance = HazardField.prototype.advance;
  });
  const kitchenAgain = await visit(150);
  assert.equal(kitchenAgain.level, 'kitchen');
  assert.equal(kitchenAgain.phase, 'playing');
  assert.equal(kitchenAgain.score, '150 m');
  assert.ok(kitchenAgain.hazards > 0, 'obstacles resume after Heaven');
  await page.screenshot({ path: 'test-results/kitchen-loop.png' });
  assert.equal((await visit(210)).level, 'dessert');
  assert.equal((await visit(270)).level, 'heaven');
  await page.evaluate(() => window.restoreFields());
  const thirdKitchen = await visit(300);
  assert.equal(thirdKitchen.level, 'kitchen');
  assert.equal(thirdKitchen.phase, 'playing');
  assert.ok(thirdKitchen.enemies > 0, 'cats resume after Heaven');
  assert.deepEqual(await page.evaluate(() => window.levelEvents), ['heaven', 'kitchen', 'dessert', 'heaven', 'kitchen']);
  assert.deepEqual(await page.evaluate(() => [window.winEvents, window.endEvents]), [0, 0]);
  await page.evaluate(() => window.testGame.scene.getScene('Game').finishRun('test'));
  assert.deepEqual(await page.evaluate(() => [window.winEvents, window.endEvents]), [0, 1]);
  assert.ok(Number(await page.evaluate(() => localStorage.getItem('flappy-arms.best-altitude'))) >= 300);
  // Isolate the authored encounter while running the real scene and renderer.
  await page.evaluate(async () => {
    window.testInput = { ...window.testEmpty, tracking: true, calibrated: true };
    window.testGame.scene.start('Game');
  });
  await page.waitForFunction(() => window.testGame.scene.isActive('Game') && window.testGame.scene.getScene('Game').phase === 'playing');
  await page.evaluate(() => {
    const scene = window.testGame.scene.getScene('Game');
    window.testGame.scene.pause('Game');
    scene.flight.update = () => window.startGrace ? 1 : 0;
    scene.flight.altitude = 20;
    scene.flight.x = 640;
    scene.hazards.advance = () => {};
    scene.hazards.items = [];
    scene.update(0, 0);
  });
  const catStep = async (frames) => page.evaluate(frames => {
    const scene = window.testGame.scene.getScene('Game');
    for (let i = 0; i < frames; i++) scene.update(0, 25);
    return { phase: scene.phase, age: scene.enemies.items[0]?.age, x: scene.enemies.items[0]?.x };
  }, frames);
  assert.equal((await catStep(40)).age, undefined, 'waiting without flapping does not use grace');
  await page.evaluate(() => { window.startGrace = true; });
  assert.equal((await catStep(100)).age, undefined, 'no cat during the first 2.5 seconds');
  await page.evaluate(() => { window.startGrace = false; window.testInput.tracking = false; });
  assert.equal((await catStep(240)).age, undefined, 'tracking pause preserves remaining grace');
  await page.evaluate(() => { window.testInput.tracking = true; });
  assert.equal((await catStep(99)).age, undefined, 'no cat before five active seconds');
  const firstCat = await catStep(2);
  assert.equal(firstCat.phase, 'playing');
  assert.ok(firstCat.age >= 0 && firstCat.age < 0.05, 'first cat starts a fresh warning');
  assert.equal((await catStep(20)).phase, 'playing');
  await page.screenshot({ path: 'test-results/cat-warning.png' });
  const catAge = await page.evaluate(() => {
    window.testInput.tracking = false;
    return window.testGame.scene.getScene('Game').enemies.items[0].age;
  });
  assert.equal((await catStep(20)).age, catAge);
  await page.evaluate(() => {
    window.testInput.tracking = true;
    window.testGame.scene.getScene('Game').flight.x = 340;
  });
  const dodged = await catStep(21);
  assert.equal(dodged.phase, 'playing');
  assert.equal(dodged.x, 640);
  await page.screenshot({ path: 'test-results/cat-paw.png' });
  await page.evaluate(() => { window.testGame.scene.getScene('Game').flight.x = 640; });
  assert.equal((await catStep(1)).phase, 'dying');
  assert.deepEqual(errors, []);
  console.log('Browser checks passed: canvas fit, keyboard start, fall, flap restart, CV input, ascent, lane change, tracking pause, resize, Kitchen, Dessert, Heaven, repeated loops, continuous score, resumed obstacles, death-only run end, held jump protection, cat warning, locked lane, tracking pause, dodge, paw collision, no runtime errors.');
} finally {
  await browser?.close();
  await server.close();
}
