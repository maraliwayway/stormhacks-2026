export type IconName = "expand" | "palms" | "pause" | "sound" | "soundOff";

/** Drawn for this game: filled ink shapes rather than a stock line-icon set. */
const PATHS: Record<IconName, string> = {
  palms:
    '<path fill="currentColor" d="M11.2 21.5V7.6c0-2.6-.9-4.6-2.3-4.6-1.2 0-1.9 1.2-1.9 3.2v6.3l-2.8 3.1v5.9h7Zm1.6 0V7.6c0-2.6.9-4.6 2.3-4.6 1.2 0 1.9 1.2 1.9 3.2v6.3l2.8 3.1v5.9h-7Z"/>',
  expand:
    '<path fill="currentColor" d="M3 3h7v3H6v4H3V3Zm11 0h7v7h-3V6h-4V3ZM3 14h3v4h4v3H3v-7Zm15 0h3v7h-7v-3h4v-4Z"/>',
  pause:
    '<rect x="5" y="4" width="5" height="16" rx="1.6" fill="currentColor"/><rect x="14" y="4" width="5" height="16" rx="1.6" fill="currentColor"/>',
  sound:
    '<path fill="currentColor" d="M3 9h4l5-4.5v15L7 15H3V9Z"/><path fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" d="M15.5 9c1.4 1.6 1.4 4.4 0 6M18.5 6.2c3 3.2 3 8.4 0 11.6"/>',
  soundOff:
    '<path fill="currentColor" d="M3 9h4l5-4.5v15L7 15H3V9Z"/><path fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" d="m15.5 9.5 5 5m0-5-5 5"/>',
};

export function icon(name: IconName, className = ""): string {
  return `<svg class="icon icon-${name} ${className}" viewBox="0 0 24 24" aria-hidden="true">${PATHS[name]}</svg>`;
}

const FIGURE_ARROWS = {
  flap: '<path d="m25 44 2 19m-5-6 5 6 6-5m121-14-2 19m-6-5 6 5 5-6" class="figure-arrow"/>',
  // Two up-chevrons on each side: faster strokes, faster climb.
  fast: '<path d="m18 46 9-9 9 9m-18 12 9-9 9 9m108-12 9-9 9 9m-18 12 9-9 9 9" class="figure-arrow"/>',
  head: '<path d="M46 18H27m6-5-6 5 6 5m101-5h19m-6-5 6 5-6 5" class="figure-arrow"/>',
};

/** The same little figure demonstrates the actual movements before a first run. */
export function movementFigure(
  kind: "flap" | "fast" | "head" | "dodge",
): string {
  if (kind === "dodge") {
    return `<svg viewBox="0 0 180 120" class="movement-figure" aria-hidden="true"><path d="M60 6v108M120 6v108" class="figure-lanes"/><path d="M72 36 75 12l13 12M108 36l-3-24-13 12" class="figure-cat"/><circle cx="90" cy="42" r="20" class="figure-cat"/><path d="M83 38v5m14-5v5" class="figure-limbs"/><path d="M94 92h36" class="figure-arrow"/><path d="m122 84 9 8-9 8" class="figure-arrow"/><ellipse cx="152" cy="92" rx="15" ry="12" class="figure-body"/></svg>`;
  }
  return `<svg viewBox="0 0 180 120" class="movement-figure figure-${kind}" aria-hidden="true"><path d="M33 103h114" class="figure-ground"/><g class="figure-person"><circle cx="90" cy="27" r="12" class="figure-head"/><path d="M90 45v35m0 0-18 22m18-22 18 22" class="figure-limbs"/><path d="m90 49-29 8-21-25" class="figure-limbs figure-arm-left"/><path d="m90 49 29 8 21-25" class="figure-limbs figure-arm-right"/></g>${FIGURE_ARROWS[kind]}</svg>`;
}
