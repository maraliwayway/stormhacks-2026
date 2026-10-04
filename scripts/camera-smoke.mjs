import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createServer } from "vite";

// Exercise the real model and worker without requiring webcam permission or a person.
const server = await createServer({
  server: { host: "127.0.0.1", port: 0, strictPort: false },
});
await server.listen();
const address = server.httpServer.address();
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
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${address.port}/cv-test.html`);
  await page.evaluate(async () => {
    const tracker = await import("/src/input/cv/poseTracker.ts");
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const context = canvas.getContext("2d");
    window.cameraFrames = [];
    window.cameraHeartbeats = 0;
    window.cameraStream = canvas.captureStream(30);
    navigator.mediaDevices.getUserMedia = async () => window.cameraStream;
    // Changing pixels produce actual video callbacks; a blank frame should detect no body.
    window.cameraTimer = setInterval(() => {
      window.cameraHeartbeats++;
      context.fillStyle = window.cameraHeartbeats % 2 ? "#999" : "#aaa";
      context.fillRect(0, 0, 640, 480);
    }, 16);
    window.removeCameraListener = tracker.onFrame((frame) => {
      if (frame.frameTs > 0) {
        window.cameraFrames.push({
          ...frame,
          heartbeats: window.cameraHeartbeats,
        });
      }
    });
    await tracker.startTracker(document.getElementById("video"));
    window.cameraTracker = tracker;
  });
  await page.waitForFunction(() => window.cameraFrames.length >= 8, null, {
    timeout: 30000,
  });
  const frames = await page.evaluate(() => window.cameraFrames);
  assert.ok(["GPU", "CPU"].includes(frames[0].delegate));
  assert.ok(
    frames.every((frame) => frame.landmarks === null && frame.error === null),
  );
  assert.ok(frames.every((frame) => frame.inferenceMs > 0));
  assert.ok(
    frames.at(-1).heartbeats > frames[0].heartbeats + 5,
    "the main thread continues rendering during model inference",
  );
  for (let i = 1; i < frames.length; i++) {
    assert.ok(
      frames[i].frameTs > frames[i - 1].frameTs,
      "capture timestamps increase",
    );
  }
  const stopped = await page.evaluate(() => {
    window.cameraTracker.stopTracker();
    window.removeCameraListener();
    clearInterval(window.cameraTimer);
    return {
      tracks: window.cameraStream.getTracks().map((track) => track.readyState),
      videoReleased: document.getElementById("video").srcObject === null,
      landmarks: window.cameraTracker.getLatest().landmarks,
    };
  });
  assert.deepEqual(stopped.tracks, ["ended"]);
  assert.equal(stopped.videoReleased, true);
  assert.equal(stopped.landmarks, null);
  assert.deepEqual(errors, []);
  console.log(
    `Camera worker checks passed: ${frames[0].delegate}, local model, ${frames.length} frames, responsive UI, camera cleanup.`,
  );
} finally {
  await browser?.close();
  await server.close();
}
