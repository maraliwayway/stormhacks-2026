import {
  type Mix,
  bass,
  bell,
  clap,
  hat,
  kick,
  pad,
  pluck,
  shaker,
  woodblock,
} from "./instruments";

export type TrackName = "title" | "kitchen" | "dessert" | "heaven";

type Step = number | null;
interface Track {
  bpm: number;
  /** One chord per bar, four bars per loop. */
  chords: number[][];
  roots: number[];
  bassSteps: number[];
  /** Indices into the bar's chord tones (spanning two octaves); null rests. */
  melody: [Step[], Step[]];
  lead: "pluck" | "bell";
  pad?: number;
  kick?: number[];
  clap?: number[];
  hat?: number[];
  shaker?: number[];
  woodblock?: number[];
}

/** A rest, kept to one letter so the patterns line up. */
const R = null;

/** Each world gets its own key, tempo, and band. Loops are four bars long. */
export const TRACKS: Record<TrackName, Track> = {
  title: {
    bpm: 92,
    chords: [
      [60, 64, 67, 71],
      [57, 60, 64, 67],
      [53, 57, 60, 64],
      [55, 59, 62, 67],
    ],
    roots: [36, 33, 29, 31],
    bassSteps: [0, 10],
    melody: [
      [0, R, 1, R, 2, R, 3, R, 4, R, 3, R, 2, R, 1, R],
      [0, R, 2, R, 1, R, 3, R, 5, R, 4, R, 2, R, R, R],
    ],
    lead: "pluck",
    pad: 0.035,
    hat: [4, 12],
  },
  kitchen: {
    bpm: 120,
    chords: [
      [60, 64, 67],
      [55, 59, 62],
      [57, 60, 64],
      [53, 57, 60],
    ],
    roots: [36, 31, 33, 29],
    bassSteps: [0, 3, 8, 11, 14],
    melody: [
      [3, R, 4, 3, R, 2, R, 3, 5, R, 4, R, 3, R, 2, R],
      [2, R, 3, 2, R, 1, R, 0, 3, R, 4, 5, R, 4, R, R],
    ],
    lead: "pluck",
    kick: [0, 8, 10],
    clap: [4, 12],
    hat: [2, 6, 10, 14],
  },
  dessert: {
    bpm: 100,
    chords: [
      [62, 65, 69],
      [60, 64, 67],
      [58, 62, 65],
      [57, 61, 64],
    ],
    roots: [38, 36, 34, 33],
    bassSteps: [0, 6, 10],
    melody: [
      [0, R, R, 1, 2, R, 1, R, 3, R, 2, 1, 0, R, R, R],
      [3, R, 4, R, 3, 2, R, 1, 2, R, R, 0, 1, R, 0, R],
    ],
    lead: "pluck",
    kick: [0, 6, 10],
    woodblock: [3, 11, 14],
    shaker: [0, 2, 4, 6, 8, 10, 12, 14],
  },
  heaven: {
    bpm: 76,
    chords: [
      [53, 57, 60, 64],
      [52, 55, 59, 62],
      [50, 53, 57, 60],
      [48, 52, 55, 59],
    ],
    roots: [29, 28, 26, 24],
    bassSteps: [0, 8],
    melody: [
      [4, R, R, R, 5, R, R, R, 6, R, R, R, 5, R, R, R],
      [6, R, R, R, 5, R, R, 4, 5, R, R, R, R, R, R, R],
    ],
    lead: "bell",
    pad: 0.05,
  },
};

const STEPS_PER_BAR = 16;
const LOOP_STEPS = STEPS_PER_BAR * 4;

export function stepSeconds(track: Track): number {
  return 60 / track.bpm / 4;
}

/** Schedules every voice that falls on one sixteenth-note step. */
export function scheduleStep(
  mix: Mix,
  track: Track,
  step: number,
  time: number,
): void {
  const local = step % STEPS_PER_BAR;
  const bar = Math.floor((step % LOOP_STEPS) / STEPS_PER_BAR);
  const chord = track.chords[bar];
  const stepLength = stepSeconds(track);
  if (local === 0 && track.pad) {
    pad(mix, time, chord, stepLength * STEPS_PER_BAR, track.pad);
  }
  if (track.bassSteps.includes(local)) {
    const next =
      track.bassSteps.find((candidate) => candidate > local) ?? STEPS_PER_BAR;
    bass(mix, time, track.roots[bar], (next - local) * stepLength * 0.9);
  }
  const index = track.melody[bar % 2][local];
  if (index !== null) {
    const tones = [...chord, ...chord.map((note) => note + 12)];
    const note = tones[Math.min(index, tones.length - 1)] + 12;
    if (track.lead === "bell") {
      bell(mix, time, note, 0.8);
    } else {
      pluck(mix, time, note, local % 4 === 0 ? 1 : 0.75);
    }
  }
  if (track.kick?.includes(local)) {
    kick(mix, time);
  }
  if (track.clap?.includes(local)) {
    clap(mix, time);
  }
  if (track.hat?.includes(local)) {
    hat(mix, time, local % 4 === 2 ? 1 : 0.6);
  }
  if (track.shaker?.includes(local)) {
    shaker(mix, time, local % 4 === 0 ? 1 : 0.6);
  }
  if (track.woodblock?.includes(local)) {
    woodblock(mix, time);
  }
}
