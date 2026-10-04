import type Phaser from "phaser";
import { HAZARD_ART } from "../hazardAppearance";

const INK = 0x24323a;
const CLOUD = 0x8c97a8;
const CLOUD_LIGHT = 0xb5bfcc;
const BOLT = 0xffd166;

/** Storm clouds give Heaven its own obstacles in the same ink-outlined style as the maps. */
export function ensureHeavenArt(scene: Phaser.Scene): void {
  const [wide] = HAZARD_ART.heaven.pot;
  const [bolt] = HAZARD_ART.heaven.knife;
  const [small] = HAZARD_ART.heaven.pin;
  drawCloud(scene, wide.texture, wide.width, wide.height, false);
  drawCloud(scene, bolt.texture, bolt.width, bolt.height, true);
  drawCloud(scene, small.texture, small.width, small.height, false);
}

function drawCloud(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  withBolt: boolean,
): void {
  if (scene.textures.exists(key)) {
    return;
  }
  // Draw at 2x so the texture stays crisp when the canvas is scaled up.
  const scale = 2;
  const w = width * scale;
  const h = height * scale;
  const cloudHeight = withBolt ? h * 0.58 : h;
  const g = scene.make.graphics({}, false);
  const puffs = [
    [0.22, 0.62, 0.2],
    [0.42, 0.4, 0.26],
    [0.64, 0.45, 0.24],
    [0.8, 0.64, 0.18],
    [0.5, 0.7, 0.28],
  ] as const;
  // Sized so every puff and its outline stay inside the texture.
  const radius = cloudHeight * 0.92;
  g.fillStyle(INK);
  for (const [x, y, r] of puffs) {
    g.fillCircle(x * w, y * cloudHeight, r * radius + 5);
  }
  g.fillStyle(CLOUD);
  for (const [x, y, r] of puffs) {
    g.fillCircle(x * w, y * cloudHeight, r * radius);
  }
  g.fillStyle(CLOUD_LIGHT);
  for (const [x, y, r] of puffs.slice(1, 3)) {
    g.fillCircle(
      x * w - r * radius * 0.25,
      y * cloudHeight - r * radius * 0.25,
      r * radius * 0.55,
    );
  }
  if (withBolt) {
    const top = cloudHeight * 0.8;
    const bolt = [
      [0.52, top],
      [0.36, top + (h - top) * 0.55],
      [0.5, top + (h - top) * 0.5],
      [0.42, h - 4],
      [0.66, top + (h - top) * 0.38],
      [0.53, top + (h - top) * 0.42],
      [0.62, top],
    ].map(([x, y]) => ({ x: x * w, y }));
    g.fillStyle(BOLT).fillPoints(bolt, true);
    g.lineStyle(5, INK).strokePoints(bolt, true);
  }
  g.generateTexture(key, w, h);
  g.destroy();
}
