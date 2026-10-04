import type { LevelId } from "../../shared/events";
import type { LevelConfig } from "./LevelConfig";

export const LEVELS: Record<LevelId, LevelConfig> = {
  kitchen: {
    id: "kitchen",
    name: "Kitchen",
    palette: { sky: 0xfff3e0, accent: 0xe65100, hazard: 0x5d4037 },
    background: { far: "kitchen_far", near: "kitchen_near" },
    hazards: ["pot", "knife", "rolling_pin"],
    voicePersona: "chef",
  },
  dessert: {
    id: "dessert",
    name: "Dessert",
    palette: { sky: 0xfce4ec, accent: 0xad1457, hazard: 0x6a1b9a },
    background: { far: "dessert_far", near: "dessert_near" },
    hazards: ["cupcake", "candy", "sprinkle_bomb"],
    voicePersona: "announcer",
  },
};
