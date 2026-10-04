// Owner: Dev 3. Ticket: "Voice director: event bus, cooldowns, priority".
// Plays pre-rendered ElevenLabs lines from public/assets/voice/manifest.json.
// Funny, not spammy: global + per-event cooldowns, priority, no overlap, no repeats.

import { Howl, Howler } from "howler";
import { EventBus } from "../shared/EventBus";
import type { GameEventType } from "../shared/events";

interface ManifestEntry {
  id: string;
  persona: "chef" | "announcer";
  event: string;
  text: string;
  file: string;
}

const GLOBAL_COOLDOWN_MS = 4000;
const EVENT_COOLDOWN_MS = 10_000;
const PRIORITY: Partial<Record<GameEventType, number>> = {
  death: 5,
  new_best: 4,
  near_miss: 3,
  milestone: 2,
  flap_rate_dropped: 2,
  run_start: 1,
};

export class VoiceDirector {
  private lines: ManifestEntry[] = [];
  private persona: ManifestEntry["persona"] = "chef";
  private playing?: { howl: Howl; priority: number };
  private lastAnyAt = -Infinity;
  private lastByEvent = new Map<string, number>();
  private recent: string[] = [];

  async init(): Promise<void> {
    try {
      const res = await fetch("/assets/voice/manifest.json");
      if (res.ok) this.lines = await res.json();
    } catch {
      console.warn("Voice manifest missing; run backend/scripts/render_voice_lines.py");
    }

    EventBus.on("run_start", (e) => {
      this.persona = e.level === "dessert" ? "announcer" : "chef";
      this.say("run_start");
    });
    EventBus.on("near_miss", () => this.say("near_miss"));
    EventBus.on("milestone", () => this.say("milestone"));
    EventBus.on("new_best", () => this.say("new_best"));
    EventBus.on("flap_rate_dropped", () => this.say("flap_rate_dropped"));
    EventBus.on("death", () => this.say("death"));
  }

  /** Plays a cached line. Death always interrupts lower-priority speech. */
  say(event: GameEventType): void {
    const now = performance.now();
    const priority = PRIORITY[event] ?? 0;
    const interrupting = this.playing && priority > this.playing.priority;
    if (!interrupting) {
      if (this.playing) return;
      if (now - this.lastAnyAt < GLOBAL_COOLDOWN_MS && event !== "death") return;
    }
    if (now - (this.lastByEvent.get(event) ?? -Infinity) < EVENT_COOLDOWN_MS && event !== "death") return;

    const pool = this.lines.filter((l) => l.event === event && l.persona === this.persona && !this.recent.includes(l.id));
    const line = pool[Math.floor(Math.random() * pool.length)];
    if (!line) return;

    this.playing?.howl.stop();
    this.playClip(`/assets/voice/${line.file}`, priority);
    this.lastAnyAt = now;
    this.lastByEvent.set(event, now);
    this.recent = [line.id, ...this.recent].slice(0, 2);
  }

  /** Used by the Socket for live roast audio (base64 MP3). */
  playBase64(b64: string): void {
    this.playing?.howl.stop();
    this.playClip(`data:audio/mpeg;base64,${b64}`, PRIORITY.death ?? 5);
  }

  private playClip(src: string, priority: number): void {
    const howl = new Howl({ src: [src], format: ["mp3"], html5: false });
    // TODO(Dev 3): duck music to 60% while speaking once music exists.
    Howler.volume(1);
    howl.once("end", () => (this.playing = undefined));
    howl.once("loaderror", () => (this.playing = undefined));
    howl.play();
    this.playing = { howl, priority };
  }
}
