import Phaser from "phaser";
import { gameEvents } from "./events";

/** Listeners live only as long as the scene. All particles have bounded lifetimes. */
export function installVfx(
  scene: Phaser.Scene,
  bird: Phaser.GameObjects.Image,
  score: Phaser.GameObjects.Text,
  slowMotion: () => void,
): void {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const burst = (x: number, y: number, color: number, count: number): void => {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const feather = scene.add.ellipse(x, y, 7, 18, color).setDepth(12);
      scene.tweens.add({
        targets: feather,
        x: x + Math.cos(angle) * 70,
        y: y + Math.sin(angle) * 50,
        alpha: 0,
        angle: i * 35,
        duration: 450,
        onComplete: () => feather.destroy(),
      });
    }
  };
  const remove = [
    gameEvents.on("flap", (event) => {
      if (!reduced) {
        burst(event.x, event.y, 0xfff3dc, 7);
      }
      scene.tweens.killTweensOf(bird);
      bird.setScale(reduced ? 1 : 1.15, reduced ? 1 : 0.85);
      scene.tweens.add({
        targets: bird,
        scaleX: 1,
        scaleY: 1,
        duration: 160,
        ease: "Back.Out",
      });
    }),
    gameEvents.on("death", () => {
      if (!reduced) {
        scene.cameras.main.shake(220, 0.008);
        burst(bird.x, bird.y, 0xe6785b, 12);
      }
    }),
    gameEvents.on("near_miss", () => {
      if (!reduced) {
        scene.cameras.main.shake(90, 0.002);
        slowMotion();
      }
    }),
    gameEvents.on("milestone", () => {
      if (reduced) {
        return;
      }
      scene.tweens.killTweensOf(score);
      score.setScale(1.2);
      scene.tweens.add({
        targets: score,
        scale: 1,
        duration: 280,
        ease: "Back.Out",
      });
    }),
  ];
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
    remove.forEach((unsubscribe) => unsubscribe()),
  );
}
