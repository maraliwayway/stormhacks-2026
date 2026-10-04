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
  await page.goto(url);
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
  await page.evaluate(() => { window.testInput.strafeLeft = true; });
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
  await page.evaluate(() => {
    const scene = window.testGame.scene.getScene('Game');
    scene.flight.y = 550 - 120 * 40;
    scene.flight.velocity = -100;
  });
  await page.waitForFunction(() => window.testGame.scene.getScene('Game').phase === 'won');
  await page.waitForTimeout(100);
  assert.deepEqual(await page.evaluate(() => [window.winEvents, window.endEvents]), [1, 1]);
  await page.screenshot({ path: 'test-results/victory.png' });
  await page.evaluate(() => { window.testInput.jump = true; });
  await page.waitForFunction(() => window.testGame.scene.isActive('Boot'));
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => window.testGame.scene.getScene('Boot').stage), 'menu');
  assert.deepEqual(errors, []);
  console.log('Browser checks passed: canvas fit, keyboard start, fall, flap restart, CV input, ascent, lane change, tracking pause, resize, Kitchen, Dessert, victory, menu return, held jump protection, no runtime errors.');
} finally {
  await browser?.close();
  await server.close();
}
