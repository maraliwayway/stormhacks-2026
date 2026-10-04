/**
 * Small Web Audio voices. Every sound in the game is synthesised here, so the game
 * ships no third-party recordings. Each function schedules one note at `time`.
 */

export interface Mix {
  ctx: AudioContext;
  out: AudioNode;
  reverb: AudioNode;
}

const SILENT = 0.0001;
const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();

export const midiToHz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

function noise(ctx: AudioContext): AudioBufferSourceNode {
  let buffer = noiseBuffers.get(ctx);
  if (!buffer) {
    buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index++) {
      data[index] = Math.random() * 2 - 1;
    }
    noiseBuffers.set(ctx, buffer);
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  return source;
}

/** Percussive envelope: fast attack, exponential decay. */
function hit(
  ctx: AudioContext,
  time: number,
  peak: number,
  attack: number,
  decay: number,
): GainNode {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(SILENT, time);
  gain.gain.exponentialRampToValueAtTime(peak, time + attack);
  gain.gain.exponentialRampToValueAtTime(SILENT, time + attack + decay);
  return gain;
}

function tone(
  mix: Mix,
  type: OscillatorType,
  time: number,
  from: number,
  to: number,
  glide: number,
  peak: number,
  decay: number,
  send = 0,
): void {
  const { ctx } = mix;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(from, time);
  if (to !== from) {
    osc.frequency.exponentialRampToValueAtTime(to, time + glide);
  }
  const gain = hit(ctx, time, peak, 0.005, decay);
  osc.connect(gain).connect(mix.out);
  if (send > 0) {
    const wet = ctx.createGain();
    wet.gain.value = send;
    gain.connect(wet).connect(mix.reverb);
  }
  osc.start(time);
  osc.stop(time + decay + 0.05);
}

function filteredNoise(
  mix: Mix,
  time: number,
  type: BiquadFilterType,
  from: number,
  to: number,
  q: number,
  peak: number,
  attack: number,
  decay: number,
): void {
  const { ctx } = mix;
  const source = noise(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(from, time);
  filter.frequency.exponentialRampToValueAtTime(to, time + attack + decay);
  const gain = hit(ctx, time, peak, attack, decay);
  source.connect(filter).connect(gain).connect(mix.out);
  source.start(time, Math.random() * 0.5);
  source.stop(time + attack + decay + 0.05);
}

/** A generated room so bells and the choir have space without a sample. */
export function createReverb(ctx: AudioContext, seconds = 2.4): ConvolverNode {
  const length = Math.floor(ctx.sampleRate * seconds);
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    for (let index = 0; index < length; index++) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / length) ** 3;
    }
  }
  const convolver = ctx.createConvolver();
  convolver.buffer = impulse;
  return convolver;
}

// ---------- Music voices ----------

export function pluck(
  mix: Mix,
  time: number,
  midi: number,
  velocity = 1,
): void {
  const hz = midiToHz(midi);
  tone(mix, "triangle", time, hz, hz, 0, 0.22 * velocity, 0.32, 0.15);
  tone(mix, "sine", time, hz * 2, hz * 2, 0, 0.06 * velocity, 0.12);
}

export function bell(mix: Mix, time: number, midi: number, velocity = 1): void {
  const hz = midiToHz(midi);
  tone(mix, "sine", time, hz, hz, 0, 0.16 * velocity, 1.4, 0.5);
  tone(mix, "sine", time, hz * 2.76, hz * 2.76, 0, 0.04 * velocity, 0.5, 0.5);
}

export function bass(
  mix: Mix,
  time: number,
  midi: number,
  length: number,
): void {
  const { ctx } = mix;
  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.value = midiToHz(midi);
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 500;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(SILENT, time);
  gain.gain.exponentialRampToValueAtTime(0.3, time + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.12, time + length * 0.5);
  gain.gain.exponentialRampToValueAtTime(SILENT, time + length);
  osc.connect(filter).connect(gain).connect(mix.out);
  osc.start(time);
  osc.stop(time + length + 0.05);
}

export function pad(
  mix: Mix,
  time: number,
  notes: readonly number[],
  length: number,
  level = 0.05,
): void {
  const { ctx } = mix;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 1100;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(SILENT, time);
  gain.gain.linearRampToValueAtTime(level, time + length * 0.3);
  gain.gain.linearRampToValueAtTime(level * 0.7, time + length * 0.8);
  gain.gain.linearRampToValueAtTime(SILENT, time + length + 0.4);
  filter.connect(gain);
  gain.connect(mix.out);
  const wet = ctx.createGain();
  wet.gain.value = 0.6;
  gain.connect(wet).connect(mix.reverb);
  for (const note of notes) {
    for (const detune of [-7, 7]) {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = midiToHz(note);
      osc.detune.value = detune;
      osc.connect(filter);
      osc.start(time);
      osc.stop(time + length + 0.5);
    }
  }
}

export function kick(mix: Mix, time: number): void {
  tone(mix, "sine", time, 140, 45, 0.12, 0.55, 0.28);
}

export function hat(mix: Mix, time: number, velocity = 1): void {
  filteredNoise(
    mix,
    time,
    "highpass",
    7000,
    7000,
    0.7,
    0.08 * velocity,
    0.002,
    0.04,
  );
}

export function clap(mix: Mix, time: number): void {
  filteredNoise(mix, time, "bandpass", 1500, 1200, 1.2, 0.22, 0.003, 0.12);
}

export function shaker(mix: Mix, time: number, velocity = 1): void {
  filteredNoise(
    mix,
    time,
    "highpass",
    5000,
    6000,
    0.8,
    0.05 * velocity,
    0.01,
    0.05,
  );
}

export function woodblock(mix: Mix, time: number): void {
  tone(mix, "triangle", time, 1800, 1700, 0.03, 0.14, 0.05);
  tone(mix, "sine", time, 900, 900, 0, 0.1, 0.06);
}

// ---------- Effects ----------

export function flap(mix: Mix, time: number): void {
  filteredNoise(mix, time, "bandpass", 1400, 450, 1.2, 0.35, 0.01, 0.14);
  tone(mix, "sine", time, 180, 90, 0.08, 0.14, 0.1);
}

export function laneChange(mix: Mix, time: number): void {
  tone(mix, "triangle", time, 988, 988, 0, 0.14, 0.06);
  tone(mix, "triangle", time + 0.05, 1319, 1319, 0, 0.14, 0.08);
}

export function nearMiss(mix: Mix, time: number): void {
  filteredNoise(mix, time, "bandpass", 2600, 500, 2, 0.3, 0.03, 0.28);
  tone(mix, "sine", time + 0.05, 600, 1200, 0.15, 0.08, 0.2);
}

/** A sawtooth through two moving formants reads as "mee-ow". */
export function meow(mix: Mix, time: number, pitch = 1): void {
  const { ctx } = mix;
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  const f = osc.frequency;
  f.setValueAtTime(500 * pitch, time);
  f.linearRampToValueAtTime(800 * pitch, time + 0.14);
  f.linearRampToValueAtTime(720 * pitch, time + 0.4);
  f.linearRampToValueAtTime(430 * pitch, time + 0.72);
  const vibrato = ctx.createOscillator();
  vibrato.frequency.value = 6;
  const depth = ctx.createGain();
  depth.gain.value = 14 * pitch;
  vibrato.connect(depth).connect(f);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(SILENT, time);
  amp.gain.exponentialRampToValueAtTime(0.5, time + 0.07);
  amp.gain.setValueAtTime(0.5, time + 0.45);
  amp.gain.exponentialRampToValueAtTime(SILENT, time + 0.78);
  const formants: [number[], number, number][] = [
    [[400, 950, 750, 480], 5, 1],
    [[2400, 1700, 1250, 1000], 8, 0.55],
    [[3300, 2800, 2600, 2500], 9, 0.2],
  ];
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 4200;
  for (const [path, q, level] of formants) {
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.Q.value = q;
    band.frequency.setValueAtTime(path[0], time);
    band.frequency.linearRampToValueAtTime(path[1], time + 0.16);
    band.frequency.linearRampToValueAtTime(path[2], time + 0.42);
    band.frequency.linearRampToValueAtTime(path[3], time + 0.72);
    const gain = ctx.createGain();
    gain.gain.value = level;
    osc.connect(band).connect(gain).connect(amp);
  }
  amp.connect(lowpass).connect(mix.out);
  const wet = ctx.createGain();
  wet.gain.value = 0.12;
  lowpass.connect(wet).connect(mix.reverb);
  osc.start(time);
  vibrato.start(time);
  osc.stop(time + 0.85);
  vibrato.stop(time + 0.85);
}

export function swipe(mix: Mix, time: number): void {
  filteredNoise(mix, time, "highpass", 6000, 900, 0.8, 0.45, 0.01, 0.18);
  filteredNoise(mix, time, "bandpass", 4500, 3500, 0.7, 0.12, 0.02, 0.3);
}

export function bonk(mix: Mix, time: number): void {
  tone(mix, "sine", time, 330, 100, 0.16, 0.55, 0.32);
  tone(mix, "triangle", time, 660, 200, 0.16, 0.16, 0.2);
  filteredNoise(mix, time, "lowpass", 2200, 800, 0.7, 0.3, 0.002, 0.04);
}

export function slideWhistle(mix: Mix, time: number): void {
  const { ctx } = mix;
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(1200, time);
  osc.frequency.exponentialRampToValueAtTime(220, time + 0.9);
  const vibrato = ctx.createOscillator();
  vibrato.frequency.value = 7;
  const depth = ctx.createGain();
  depth.gain.value = 18;
  vibrato.connect(depth).connect(osc.frequency);
  const gain = hit(ctx, time, 0.22, 0.03, 0.95);
  osc.connect(gain).connect(mix.out);
  osc.start(time);
  vibrato.start(time);
  osc.stop(time + 1.05);
  vibrato.stop(time + 1.05);
}

/** Choir "aah" chord with a harp run and bells, for every prayer. */
export function angel(mix: Mix, time: number): void {
  const { ctx } = mix;
  const length = 2.6;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(SILENT, time);
  amp.gain.linearRampToValueAtTime(0.07, time + 0.45);
  amp.gain.setValueAtTime(0.07, time + 1.4);
  amp.gain.linearRampToValueAtTime(SILENT, time + length);
  const vowel: [number, number, number][] = [
    [800, 5, 1],
    [1150, 6, 0.6],
    [2900, 8, 0.25],
  ];
  const voices = ctx.createGain();
  for (const [hz, q, level] of vowel) {
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = hz;
    band.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.value = level * 3;
    voices.connect(band).connect(gain).connect(amp);
  }
  for (const note of [60, 64, 67, 72, 76]) {
    for (const detune of [-9, 0, 9]) {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = midiToHz(note);
      osc.detune.value = detune;
      osc.connect(voices);
      osc.start(time);
      osc.stop(time + length + 0.1);
    }
  }
  amp.connect(mix.out);
  const wet = ctx.createGain();
  wet.gain.value = 1.4;
  amp.connect(wet).connect(mix.reverb);
  [72, 74, 76, 79, 81, 84, 86, 88].forEach((note, index) =>
    pluck(mix, time + 0.05 + index * 0.045, note, 0.5),
  );
  [88, 91, 96].forEach((note, index) =>
    bell(mix, time + 0.45 + index * 0.18, note, 0.7),
  );
}

export function chime(mix: Mix, time: number): void {
  bell(mix, time, 84);
  bell(mix, time + 0.12, 91);
}

export function jingle(mix: Mix, time: number): void {
  [72, 76, 79, 84, 88].forEach((note, index) =>
    pluck(mix, time + index * 0.08, note, 0.9),
  );
  bell(mix, time + 0.42, 96);
}

export function fanfare(mix: Mix, time: number): void {
  [67, 72, 76].forEach((note, index) =>
    pluck(mix, time + index * 0.1, note, 1),
  );
  pluck(mix, time + 0.3, 79, 1.2);
  bell(mix, time + 0.3, 91, 0.6);
}

export function blip(mix: Mix, time: number, rising: boolean): void {
  tone(
    mix,
    "sine",
    time,
    rising ? 440 : 660,
    rising ? 660 : 440,
    0.1,
    0.16,
    0.14,
  );
}

export function click(mix: Mix, time: number): void {
  tone(mix, "triangle", time, 1200, 1100, 0.02, 0.1, 0.03);
}

export function ready(mix: Mix, time: number): void {
  bell(mix, time, 79, 0.8);
  bell(mix, time + 0.1, 84, 0.8);
}

/** "Wah wah wah waaah" through a closing low-pass. */
export function wahWah(mix: Mix, time: number): void {
  const { ctx } = mix;
  [62, 61, 60, 59].forEach((note, index) => {
    const start = time + index * 0.38;
    const last = index === 3;
    const length = last ? 1 : 0.32;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = midiToHz(note);
    if (last) {
      const vibrato = ctx.createOscillator();
      vibrato.frequency.value = 5;
      const depth = ctx.createGain();
      depth.gain.value = 5;
      vibrato.connect(depth).connect(osc.frequency);
      vibrato.start(start);
      vibrato.stop(start + length + 0.05);
    }
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = 6;
    filter.frequency.setValueAtTime(400, start);
    filter.frequency.linearRampToValueAtTime(1400, start + 0.08);
    filter.frequency.linearRampToValueAtTime(350, start + length);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(SILENT, start);
    gain.gain.exponentialRampToValueAtTime(0.16, start + 0.03);
    gain.gain.setValueAtTime(0.16, start + length * 0.7);
    gain.gain.exponentialRampToValueAtTime(SILENT, start + length);
    osc.connect(filter).connect(gain).connect(mix.out);
    osc.start(start);
    osc.stop(start + length + 0.05);
  });
}
