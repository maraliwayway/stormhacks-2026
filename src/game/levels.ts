/** Demo distances, kept together for designer and playtest tuning. */
export const LEVELS = [
  { id: 'kitchen', label: 'KITCHEN', start: 0, end: 60 },
  { id: 'dessert', label: 'DESSERT', start: 60, end: 120 },
] as const;
export function levelAt(altitude: number) {
  return LEVELS[altitude >= LEVELS[1].start ? 1 : 0];
}
export function hasWon(altitude: number): boolean {
  return altitude >= LEVELS[1].end;
}
