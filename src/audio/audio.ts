import type { InputState } from "../input/types";
import * as voice from "./instruments";
import { TRACKS, type TrackName, scheduleStep, stepSeconds } from "./music";

export type { TrackName } from "./music";
export type SfxName =
  | "flap"
  | "lane"
  | "nearMiss"
  | "meow"
  | "swipe"
  | "bonk"
  | "fall"
  | "angel"
  | "chime"
  | "newBest"
  | "world"
  | "pause"
  | "resume"
  | "click"
  | "ready"
  | "gameOver";
export type SoundStatus = "on" | "muted" | "locked";

const MUSIC_LEVEL = 0.3;
const DUCKED_LEVEL = 0.1;
const SFX_LEVEL = 0.75;
const LOOKAHEAD_SECONDS = 0.12;
const MUTE_KEY = "flap-or-flop.muted";
/** Drop a licensed recording here to replace the synthesised version. */
const SAMPLE_OVERRIDES: Partial<Record<SfxName, string>> = {
  meow: "assets/audio/meow.mp3",
  angel: "assets/audio/angel.mp3",
};

const SYNTHS: Record<SfxName, (mix: voice.Mix, time: number) => void> = {
  flap: voice.flap,
  lane: voice.laneChange,
  nearMiss: voice.nearMiss,
  meow: (mix, time) => voice.meow(mix, time, 0.95 + Math.random() * 0.15),
  swipe: voice.swipe,
  bonk: voice.bonk,
  fall: voice.slideWhistle,
  angel: voice.angel,
  chime: voice.chime,
  newBest: voice.jingle,
  world: voice.fanfare,
  pause: (mix, time) => voice.blip(mix, time, false),
  resume: (mix, time) => voice.blip(mix, time, true),
  click: voice.click,
  ready: voice.ready,
  gameOver: voice.wahWah,
};

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * One AudioContext for music and effects. Browsers keep it suspended until the
 * first click or key press on the page, so the UI shows a hint until then.
 */
class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private sfx!: voice.Mix;
  private musicMix!: voice.Mix;
  private samples = new Map<SfxName, AudioBuffer>();
  private muted = readMuted();
  private listeners = new Set<(status: SoundStatus) => void>();
  private track: TrackName | null = null;
  private step = 0;
  private nextStepTime = 0;
  private timer = 0;
  private ducked = false;

  init(): void {
    if (this.ctx || typeof AudioContext === "undefined") {
      return;
    }
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(ctx.destination);
    const reverb = voice.createReverb(ctx);
    const reverbLevel = ctx.createGain();
    reverbLevel.gain.value = 0.35;
    reverb.connect(reverbLevel).connect(this.master);
    const sfxBus = ctx.createGain();
    sfxBus.gain.value = SFX_LEVEL;
    sfxBus.connect(this.master);
    this.music = ctx.createGain();
    this.music.gain.value = MUSIC_LEVEL;
    this.music.connect(this.master);
    const musicReverb = ctx.createGain();
    musicReverb.gain.value = MUSIC_LEVEL;
    musicReverb.connect(reverb);
    this.sfx = { ctx, out: sfxBus, reverb };
    this.musicMix = { ctx, out: this.music, reverb: musicReverb };
    ctx.addEventListener("statechange", () => this.notify());
    for (const type of ["pointerdown", "keydown", "touchstart"]) {
      window.addEventListener(type, this.unlock, { capture: true });
    }
    this.loadOverrides();
    this.timer = window.setInterval(this.schedule, 25);
  }

  /** Any page interaction may start audio; this also retries after camera access. */
  unlock = (): void => {
    if (this.ctx?.state === "suspended") {
      this.ctx.resume().catch(() => undefined);
    }
  };

  private async loadOverrides(): Promise<void> {
    for (const [name, path] of Object.entries(SAMPLE_OVERRIDES)) {
      try {
        const response = await fetch(path);
        if (
          !response.ok ||
          !response.headers.get("content-type")?.startsWith("audio/")
        ) {
          continue;
        }
        const buffer = await this.ctx!.decodeAudioData(
          await response.arrayBuffer(),
        );
        this.samples.set(name as SfxName, buffer);
      } catch {
        /* The synthesised sound stays in place. */
      }
    }
  }

  get status(): SoundStatus {
    if (this.muted) {
      return "muted";
    }
    return this.ctx?.state === "running" ? "on" : "locked";
  }

  onStatus(listener: (status: SoundStatus) => void): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.status);
    }
  }

  toggleMute(): void {
    // While the browser still blocks audio, the first press means "turn it on".
    if (this.status === "locked") {
      this.unlock();
      return;
    }
    this.muted = !this.muted;
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? "1" : "0");
    } catch {
      /* Muting still works for this visit. */
    }
    if (this.ctx) {
      this.master.gain.setTargetAtTime(
        this.muted ? 0 : 1,
        this.ctx.currentTime,
        0.05,
      );
    }
    this.unlock();
    this.notify();
  }

  play(name: SfxName, delaySeconds = 0): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running" || this.muted) {
      return;
    }
    const time = ctx.currentTime + delaySeconds;
    const sample = this.samples.get(name);
    if (sample) {
      const source = ctx.createBufferSource();
      source.buffer = sample;
      source.connect(this.sfx.out);
      source.start(time);
      return;
    }
    SYNTHS[name](this.sfx, time);
  }

  /** Crossfades to another world's loop; null stops the music. */
  setMusic(track: TrackName | null): void {
    if (!this.ctx) {
      this.track = track;
      return;
    }
    if (track === this.track) {
      return;
    }
    const ctx = this.ctx;
    const now = ctx.currentTime;
    this.music.gain.cancelScheduledValues(now);
    this.music.gain.setTargetAtTime(0, now, 0.08);
    this.track = track;
    if (track) {
      this.step = 0;
      this.nextStepTime = now + 0.35;
      this.music.gain.setTargetAtTime(this.musicLevel(), now + 0.3, 0.1);
    }
  }

  /** Quieter music behind pause and lost-tracking screens. */
  duck(on: boolean): void {
    this.ducked = on;
    if (this.ctx && this.track) {
      this.music.gain.setTargetAtTime(
        this.musicLevel(),
        this.ctx.currentTime,
        0.15,
      );
    }
  }

  private musicLevel(): number {
    return this.ducked ? DUCKED_LEVEL : MUSIC_LEVEL;
  }

  private schedule = (): void => {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running" || !this.track) {
      return;
    }
    const track = TRACKS[this.track];
    // After a stall, skip ahead instead of playing a burst of late notes.
    if (this.nextStepTime < ctx.currentTime - 0.2) {
      this.nextStepTime = ctx.currentTime + 0.05;
    }
    while (this.nextStepTime < ctx.currentTime + LOOKAHEAD_SECONDS) {
      scheduleStep(this.musicMix, track, this.step, this.nextStepTime);
      this.nextStepTime += stepSeconds(track);
      this.step++;
    }
  };

  /** Every prayer gets the angel choir; finishing calibration gets a small ding. */
  watch(getState: () => Readonly<InputState>): () => void {
    let prayers = getState().selectCount ?? 0;
    let calibrated = getState().calibrated;
    let frame = 0;
    const check = () => {
      frame = requestAnimationFrame(check);
      const state = getState();
      const count = state.selectCount ?? 0;
      if (count > prayers) {
        this.play("angel");
      }
      prayers = count;
      if (state.calibrated && !calibrated && state.tracking) {
        this.play("ready");
      }
      calibrated = state.calibrated;
    };
    frame = requestAnimationFrame(check);
    return () => cancelAnimationFrame(frame);
  }

  destroy(): void {
    window.clearInterval(this.timer);
    for (const type of ["pointerdown", "keydown", "touchstart"]) {
      window.removeEventListener(type, this.unlock, { capture: true });
    }
    this.ctx?.close();
    this.ctx = null;
    this.track = null;
  }
}

export const audio = new AudioEngine();
