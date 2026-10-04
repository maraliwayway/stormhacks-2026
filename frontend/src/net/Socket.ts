// Owner: Dev 3. Optional backend link. Every call is fire-and-forget:
// the game never waits on this, and it silently does nothing when offline.

import type { VoiceDirector } from "../audio/VoiceDirector";
import { EventBus } from "../shared/EventBus";

interface Envelope {
  type: string;
  ts: number;
  payload: Record<string, unknown>;
}

export class Socket {
  private ws?: WebSocket;
  private dynamicEvery = 2; // only every 2nd death gets a live roast
  private deaths = 0;

  constructor(private voice: VoiceDirector) {}

  connect(): void {
    const url = import.meta.env.VITE_BACKEND_WS as string | undefined;
    if (!url) return;
    try {
      this.ws = new WebSocket(url);
      this.ws.onmessage = (m) => this.handle(JSON.parse(m.data) as Envelope);
      this.ws.onclose = () => setTimeout(() => this.connect(), 3000);
      this.ws.onerror = () => this.ws?.close();
    } catch {
      /* offline is fine */
    }

    EventBus.on("death", (e) => {
      this.deaths++;
      if (this.deaths % this.dynamicEvery === 0) this.send("death", { ...e.stats });
    });
  }

  send(type: string, payload: Record<string, unknown>): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type, ts: Date.now(), payload } satisfies Envelope));
  }

  private handle(msg: Envelope): void {
    if (msg.type === "roast" && typeof msg.payload.audio_b64 === "string") {
      this.voice.playBase64(msg.payload.audio_b64);
    }
    // TODO(Dev 3): "leaderboard" messages -> update title screen top 10.
  }
}
