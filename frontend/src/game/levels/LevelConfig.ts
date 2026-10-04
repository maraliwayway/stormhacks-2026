// A level is data, not code. Dev 2 wires it; PM supplies art keys and palette.

import type { LevelId } from "../../shared/events";

export interface LevelConfig {
  id: LevelId;
  name: string;
  palette: { sky: number; accent: number; hazard: number };
  /** Texture keys loaded in BootScene. Placeholders until PM art lands. */
  background: { far: string; near: string };
  hazards: string[];
  voicePersona: "chef" | "announcer";
  music?: string;
}
