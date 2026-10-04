/**
 * Owner: Dev 3. Ticket: "Voice director: event bus, cooldowns, priority".
 * Turns game events into a story told by three ElevenLabs voices:
 * the Narrator (story beats and eulogies), Chef Gustavo (the kitchen's furious owner)
 * and the Announcer (hype for near misses, milestones and records).
 * On some deaths the backend writes a live Gemini roast; the cached line waits briefly for it
 * so a death never gets two voices.
 */
import { gameEvents } from "../game/events";
import { bestScore } from "../game/storage";
import { backendLink } from "../net/backendLink";
import { type Playback, audioEngine, base64ToArrayBuffer } from "./audioEngine";
import {
  type Persona,
  SPEAKER_NAMES,
  type VoiceContext,
  type VoiceEvent,
  type VoiceLine,
  type WorldId,
  isVoiceManifest,
  pickLine,
} from "./voiceLines";
import {
  STREAK_FLAPS,
  STREAK_WINDOW_MS,
  decide,
  flapsInWindow,
  initialVoiceState,
  isIdle,
  recordSpoken,
  rememberLine,
} from "./voicePolicy";

export const VOICE_BASE = "/voice/";
/** How long a death waits for a live roast before the cached line plays instead. */
export const ROAST_WAIT_MS = 2600;
/** Every Nth death asks the backend for a live roast; the rest use the hand-written lines. */
export const ROAST_EVERY = 2;
const IDLE_CHECK_MS = 250;

export interface SpokenLine {
  speaker: string;
  text: string;
  live: boolean;
}

type DeathListener = (line: SpokenLine | null) => void;

/** True only while the flight is on screen, not paused or waiting for tracking. */
function flightVisible(): boolean {
  if (typeof document === "undefined") {
    return false;
  }
  const root = document.getElementById("game-ui");
  const notice = root?.querySelector<HTMLElement>("[data-tracking-notice]");
  return (
    root?.dataset.view === "playing" && (!notice || Boolean(notice.hidden))
  );
}

class VoiceDirector {
  private lines: VoiceLine[] = [];
  private state = initialVoiceState();
  private recent: string[] = [];
  private playing: Playback | null = null;
  private world: WorldId = "kitchen";
  private runActive = false;
  private flapTimes: number[] = [];
  private lastFlapMs = Number.NaN;
  private runFlaps = 0;
  private runNearMisses = 0;
  private bestBeforeRun = 0;
  private deaths = 0;
  private roastTimer: ReturnType<typeof setTimeout> | null = null;
  private deathContext: VoiceContext | null = null;
  private deathLine: SpokenLine | null = null;
  private deathListeners = new Set<DeathListener>();
  /** Only the newest requested clip may start; slower earlier loads are discarded. */
  private clipRequest = 0;

  start(): () => void {
    this.loadManifest();
    const idleTimer = setInterval(() => this.checkIdle(), IDLE_CHECK_MS);
    const remove = [
      gameEvents.on("level_start", (event) => this.onLevelStart(event)),
      gameEvents.on("flap", (event) => this.onFlap(event.count)),
      gameEvents.on("near_miss", () => {
        this.runNearMisses += 1;
        this.say("near_miss");
      }),
      gameEvents.on("milestone", () => this.say("milestone")),
      gameEvents.on("new_best", () => {
        if (this.bestBeforeRun > 0) {
          this.say("new_best");
        }
      }),
      gameEvents.on("pickup", () => this.say("pickup")),
      gameEvents.on("death", (event) => this.onDeath(event)),
      backendLink.on("roast", (payload) => this.onRoast(payload)),
      backendLink.on("roast_fallback", () => this.resolveDeathWithCachedLine()),
    ];
    return () => {
      clearInterval(idleTimer);
      this.cancelRoastWait();
      this.playing?.stop();
      for (const off of remove) {
        off();
      }
    };
  }

  /** The line spoken over the latest death, for the results caption. */
  get lastDeathLine(): SpokenLine | null {
    return this.deathLine;
  }

  onDeathLine(listener: DeathListener): () => void {
    this.deathListeners.add(listener);
    return () => this.deathListeners.delete(listener);
  }

  private async loadManifest(): Promise<void> {
    try {
      const response = await fetch(`${VOICE_BASE}manifest.json`);
      const manifest: unknown = response.ok ? await response.json() : null;
      if (isVoiceManifest(manifest)) {
        this.lines = manifest;
        // Compressed clips are small; fetching them now means no network wait mid-run.
        for (const line of manifest) {
          audioEngine.prefetch(VOICE_BASE + line.file);
        }
      }
    } catch {
      console.warn("[voice] manifest unavailable; the game stays silent");
    }
  }

  private onLevelStart(event: { level: WorldId; altitude: number }): void {
    this.world = event.level;
    const newRun = event.altitude <= 0;
    if (newRun) {
      this.runActive = true;
      this.runFlaps = 0;
      this.runNearMisses = 0;
      this.flapTimes = [];
      this.lastFlapMs = Number.NaN;
      this.bestBeforeRun = bestScore.get();
      this.cancelRoastWait();
      this.setDeathLine(null);
      // A quick restart cuts the last death line so the new run's opening beat is heard.
      this.clipRequest += 1;
      this.playing?.stop();
      this.playing = null;
      this.state.speakingPriority = null;
      // Lets the backend open its API connections before the next death roast.
      backendLink.send("warm", {});
    }
    this.say("level_start", {
      level: event.level,
      loop: event.level === "kitchen" && !newRun,
    });
  }

  private onFlap(count: number): void {
    const now = performance.now();
    this.runFlaps += count;
    this.lastFlapMs = now;
    for (let index = 0; index < count; index++) {
      this.flapTimes.push(now);
    }
    this.flapTimes = this.flapTimes.filter(
      (time) => now - time < STREAK_WINDOW_MS,
    );
    if (flapsInWindow(this.flapTimes, now) >= STREAK_FLAPS) {
      this.flapTimes = [];
      this.say("streak");
    }
  }

  private checkIdle(): void {
    const now = performance.now();
    if (
      this.runActive &&
      this.runFlaps > 0 &&
      isIdle(this.lastFlapMs, now) &&
      flightVisible()
    ) {
      this.lastFlapMs = now;
      this.say("idle");
    }
  }

  private onDeath(event: {
    altitude: number;
    duration: number;
    flapCount: number;
    flapRate: number;
    reason: string;
  }): void {
    this.runActive = false;
    this.deaths += 1;
    this.deathContext = { level: this.world, reason: event.reason };
    const asked =
      this.deaths % ROAST_EVERY === 0 &&
      backendLink.send("death", {
        altitude: event.altitude,
        best: this.bestBeforeRun,
        duration: event.duration,
        flapCount: event.flapCount,
        flapRate: event.flapRate,
        reason: event.reason,
        level: this.world,
        nearMisses: this.runNearMisses,
        deaths: this.deaths,
      });
    if (asked) {
      this.cancelRoastWait();
      this.roastTimer = setTimeout(
        () => this.resolveDeathWithCachedLine(),
        ROAST_WAIT_MS,
      );
      return;
    }
    this.resolveDeathWithCachedLine();
  }

  private resolveDeathWithCachedLine(): void {
    const context = this.deathContext;
    if (!context) {
      return;
    }
    this.cancelRoastWait();
    this.deathContext = null;
    const line = this.say("death", context);
    this.setDeathLine(
      line
        ? {
            speaker: SPEAKER_NAMES[line.persona],
            text: line.caption,
            live: false,
          }
        : null,
    );
  }

  private async onRoast(payload: Record<string, unknown>): Promise<void> {
    // A roast that arrives after the cached line already played is dropped.
    if (!this.roastTimer || !this.deathContext) {
      return;
    }
    const { text, audio_b64: audio, persona } = payload;
    if (typeof text !== "string" || typeof audio !== "string") {
      this.resolveDeathWithCachedLine();
      return;
    }
    this.cancelRoastWait();
    this.deathContext = null;
    const speaker =
      SPEAKER_NAMES[(persona as Persona) ?? "chef"] ?? "Chef Gustavo";
    this.setDeathLine({ speaker, text, live: true });
    const request = ++this.clipRequest;
    const buffer = await audioEngine.decode(base64ToArrayBuffer(audio));
    if (buffer && request === this.clipRequest) {
      this.startClip(audioEngine.playBuffer(buffer, "voice"), "death");
    }
  }

  private cancelRoastWait(): void {
    if (this.roastTimer) {
      clearTimeout(this.roastTimer);
      this.roastTimer = null;
    }
  }

  private setDeathLine(line: SpokenLine | null): void {
    this.deathLine = line;
    for (const listener of [...this.deathListeners]) {
      listener(line);
    }
  }

  /** Plays a fitting cached line if the pacing rules allow it. Returns the chosen line. */
  say(
    event: VoiceEvent,
    context: VoiceContext = { level: this.world },
  ): VoiceLine | undefined {
    const now = performance.now();
    const decision = decide(this.state, event, now);
    if (decision === "skip") {
      return undefined;
    }
    const line = pickLine(this.lines, event, context, this.recent);
    if (!line) {
      return undefined;
    }
    if (decision === "interrupt") {
      this.playing?.stop();
    }
    this.recent = rememberLine(this.recent, line.id);
    recordSpoken(this.state, event, now);
    const request = ++this.clipRequest;
    audioEngine.play(VOICE_BASE + line.file, "voice").then((playback) => {
      if (request === this.clipRequest) {
        this.startClip(playback, event);
      } else {
        playback?.stop();
      }
    });
    return line;
  }

  private startClip(playback: Playback | null, event: VoiceEvent): void {
    if (!playback) {
      // Audio is locked or the file failed: free the floor rather than going silent forever.
      this.state.speakingPriority = null;
      return;
    }
    if (this.playing && this.playing !== playback) {
      this.playing.stop();
    }
    this.playing = playback;
    recordSpoken(this.state, event, performance.now());
    playback.ended.then(() => {
      if (this.playing === playback) {
        this.playing = null;
        this.state.speakingPriority = null;
      }
    });
  }
}

export const voiceDirector = new VoiceDirector();
