import { gameEvents, type GameEvents } from '../game/events';

export type ScoreSink = (score: GameEvents['run_end']) => void | Promise<void>;
let sink: ScoreSink | undefined;

/** Dev 3 supplies the backend transport. No endpoint or auth scheme is assumed. */
export function setScoreSink(next: ScoreSink | undefined): void { sink = next; }

export function installScoreSync(): () => void {
  return gameEvents.on('run_end', score => {
    if (!sink) return;
    try {
      void Promise.resolve(sink(score)).catch(error => console.warn('Score sync unavailable', error));
    } catch (error) { console.warn('Score sync unavailable', error); }
  });
}
