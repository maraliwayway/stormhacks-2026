import { gameEvents } from "../game/events";
import { audio } from "./audio";

/** Gameplay events map onto effects here, so scenes stay free of audio details. */
export function installGameSounds(): () => void {
  const remove = [
    gameEvents.on("flap", () => audio.play("flap")),
    gameEvents.on("lane_change", () => audio.play("lane")),
    gameEvents.on("near_miss", () => audio.play("nearMiss")),
    gameEvents.on("milestone", () => audio.play("chime")),
    gameEvents.on("new_best", () => audio.play("newBest")),
    gameEvents.on("cat_warning", () => audio.play("meow")),
    gameEvents.on("cat_strike", () => audio.play("swipe")),
    gameEvents.on("level_start", (event) => {
      audio.setMusic(event.level);
      if (event.altitude > 0) {
        audio.play("world");
      }
    }),
    gameEvents.on("death", (event) => {
      audio.setMusic(null);
      audio.play(event.reason === "fall" ? "fall" : "bonk");
    }),
  ];
  return () => remove.forEach((unsubscribe) => unsubscribe());
}
