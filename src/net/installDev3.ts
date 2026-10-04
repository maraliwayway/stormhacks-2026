/**
 * Owner: Dev 3. One entry point for voice, sound effects, backend link and leaderboard.
 * Safe to call with no backend configured: the game keeps every offline feature.
 */
import { audioEngine } from "../audio/audioEngine";
import { installSfx } from "../audio/sfx";
import { voiceDirector } from "../audio/voiceDirector";
import { gameEvents } from "../game/events";
import { backendLink } from "./backendLink";
import { installLeaderboard, leaderboard } from "./leaderboard";
import { installResultsPanel } from "./resultsPanel";

export function installDev3(host: HTMLElement): () => void {
  const stops = [
    audioEngine.install(),
    backendLink.start(),
    installLeaderboard(),
    voiceDirector.start(),
    installSfx(),
    installResultsPanel(host),
    gameEvents.on("level_start", (event) => {
      if (event.altitude <= 0) {
        leaderboard.clear();
      }
    }),
  ];
  return () => {
    for (const stop of stops.reverse()) {
      stop();
    }
  };
}
