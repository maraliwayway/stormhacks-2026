/**
 * Owner: Dev 3. Web Audio playback for voice lines, sound effects and (later) music.
 * Buffers are decoded once and cached. Every failure resolves to null: audio never blocks or crashes gameplay.
 */

export type Bus = "voice" | "sfx" | "music";

export interface Playback {
  stop(): void;
  readonly ended: Promise<void>;
}

const BUS_VOLUME: Record<Bus, number> = { voice: 1, sfx: 0.55, music: 0.35 };
const DUCKED_MUSIC = 0.6;
const DUCK_RAMP_SECONDS = 0.25;

class AudioEngine {
  private context: AudioContext | null = null;
  private buses = new Map<Bus, GainNode>();
  private files = new Map<string, Promise<ArrayBuffer | null>>();
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private voicesPlaying = 0;
  private removeUnlock: (() => void) | null = null;

  /** Browsers only start audio after a user gesture, so resume on the first one. */
  install(): () => void {
    if (typeof window === "undefined" || !("AudioContext" in window)) {
      return () => undefined;
    }
    const unlock = (): void => {
      this.ensureContext()
        ?.resume()
        .catch(() => undefined);
    };
    const events = ["pointerdown", "keydown", "touchstart"] as const;
    for (const name of events) {
      window.addEventListener(name, unlock, { capture: true, passive: true });
    }
    this.removeUnlock = () => {
      for (const name of events) {
        window.removeEventListener(name, unlock, { capture: true });
      }
    };
    return () => this.dispose();
  }

  get ready(): boolean {
    return this.context?.state === "running";
  }

  private ensureContext(): AudioContext | null {
    if (this.context || typeof AudioContext === "undefined") {
      return this.context;
    }
    try {
      this.context = new AudioContext();
    } catch {
      return null;
    }
    for (const bus of Object.keys(BUS_VOLUME) as Bus[]) {
      const gain = this.context.createGain();
      gain.gain.value = BUS_VOLUME[bus];
      gain.connect(this.context.destination);
      this.buses.set(bus, gain);
    }
    return this.context;
  }

  /** Downloads compressed bytes only; decoding waits until a clip is first needed. */
  prefetch(url: string): Promise<ArrayBuffer | null> {
    const cached = this.files.get(url);
    if (cached) {
      return cached;
    }
    const pending = fetch(url)
      .then((response) => (response.ok ? response.arrayBuffer() : null))
      .catch(() => null);
    this.files.set(url, pending);
    return pending;
  }

  /** Decodes once; later calls reuse the same promise. */
  load(url: string): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(url);
    if (cached) {
      return cached;
    }
    const pending = this.prefetch(url).then((data) =>
      data ? this.decode(data.slice(0)) : null,
    );
    this.buffers.set(url, pending);
    return pending;
  }

  async decode(data: ArrayBuffer): Promise<AudioBuffer | null> {
    const context = this.ensureContext();
    if (!context) {
      return null;
    }
    try {
      return await context.decodeAudioData(data);
    } catch {
      return null;
    }
  }

  async play(url: string, bus: Bus): Promise<Playback | null> {
    const buffer = await this.load(url);
    return buffer ? this.playBuffer(buffer, bus) : null;
  }

  playBuffer(buffer: AudioBuffer, bus: Bus): Playback | null {
    const context = this.context;
    const output = this.buses.get(bus);
    if (!context || !output || context.state !== "running") {
      return null;
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(output);
    if (bus === "voice") {
      this.setVoiceActive(1);
    }
    let finished = false;
    const ended = new Promise<void>((resolve) => {
      source.onended = () => {
        if (!finished) {
          finished = true;
          if (bus === "voice") {
            this.setVoiceActive(-1);
          }
        }
        resolve();
      };
    });
    source.start();
    return {
      ended,
      stop: () => {
        try {
          source.stop();
        } catch {
          /* Already stopped. */
        }
      },
    };
  }

  /** Music sits under the voice so lines stay intelligible. */
  private setVoiceActive(delta: number): void {
    this.voicesPlaying = Math.max(0, this.voicesPlaying + delta);
    const music = this.buses.get("music");
    if (!music || !this.context) {
      return;
    }
    const target =
      BUS_VOLUME.music * (this.voicesPlaying > 0 ? DUCKED_MUSIC : 1);
    music.gain.cancelScheduledValues(this.context.currentTime);
    music.gain.setTargetAtTime(
      target,
      this.context.currentTime,
      DUCK_RAMP_SECONDS / 3,
    );
  }

  private dispose(): void {
    this.removeUnlock?.();
    this.removeUnlock = null;
    this.context?.close().catch(() => undefined);
    this.context = null;
    this.buses.clear();
    this.buffers.clear();
    this.files.clear();
    this.voicesPlaying = 0;
  }
}

export const audioEngine = new AudioEngine();

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}
