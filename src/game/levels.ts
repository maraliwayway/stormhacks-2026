/** Distances within one endless circuit, kept together for playtest tuning. */
export const LEVELS = [
  { id: 'kitchen', label: 'KITCHEN', start: 0, end: 60 },
  { id: 'dessert', label: 'DESSERT', start: 60, end: 120 },
  { id: 'heaven', label: 'BIRD HEAVEN', start: 120, end: 150 },
] as const;
export const LOOP_METRES = LEVELS[LEVELS.length - 1].end;

/** Absolute bounds identify each visit without resetting altitude or the world. */
export function levelAt(altitude: number) {
  const metres = Math.max(0, altitude);
  const lap = Math.floor(metres / LOOP_METRES);
  const localAltitude = metres % LOOP_METRES;
  const level = LEVELS.find(level => localAltitude < level.end)!;
  return { ...level, start: lap * LOOP_METRES + level.start, end: lap * LOOP_METRES + level.end };
}
