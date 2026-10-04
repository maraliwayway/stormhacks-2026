export type IconName =
  | "wing"
  | "arrow"
  | "camera"
  | "keyboard"
  | "expand"
  | "pause"
  | "play"
  | "home"
  | "refresh"
  | "star"
  | "check"
  | "warning";

const PATHS: Record<IconName, string> = {
  wing: '<path d="M5 17c0-7 6-12 15-13l-2 6-5 1 3 2-5 2 2 2-5 1-3 3v-4Z"/><path d="m5 18 9-9"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  camera:
    '<path d="m8 5-2 3H3v12h18V8h-3l-2-3H8Z"/><circle cx="12" cy="13" r="4"/>',
  keyboard:
    '<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M6 9h1m4 0h1m4 0h1M6 12h1m4 0h1m4 0h1M7 16h10"/>',
  expand: '<path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/>',
  pause: '<path d="M8 5v14m8-14v14"/>',
  play: '<path d="m8 4 12 8-12 8V4Z"/>',
  home: '<path d="m3 10 9-7 9 7v11h-6v-7H9v7H3V10Z"/>',
  refresh: '<path d="M20 10a8 8 0 1 0-1 7M20 3v7h-7"/>',
  star: '<path d="m12 3 3 6 6 1-4.5 4.5 1 6.5-5.5-3-5.5 3 1-6.5L3 10l6-1 3-6Z"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  warning: '<path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5m0 3v.2"/>',
};

export function icon(name: IconName, className = ""): string {
  return `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name]}</svg>`;
}

/** The same little figure demonstrates the actual movements before a first run. */
export function movementFigure(kind: "flap" | "head" | "dodge"): string {
  if (kind === "dodge") {
    return `<svg viewBox="0 0 180 120" class="movement-figure" aria-hidden="true"><path d="M35 12v95M90 12v95M145 12v95" class="figure-lanes"/><path d="M90 66c15 0 19-19 39-19" class="figure-arrow"/><path d="m119 40 10 7-10 7" class="figure-arrow"/><rect x="73" y="19" width="34" height="20" rx="6" class="figure-obstacle"/><ellipse cx="90" cy="82" rx="19" ry="15" class="figure-body"/><path d="m108 78 12 5-12 5" class="figure-beak"/><circle cx="99" cy="77" r="2.5" class="figure-eye"/></svg>`;
  }
  return `<svg viewBox="0 0 180 120" class="movement-figure figure-${kind}" aria-hidden="true"><path d="M33 103h114" class="figure-ground"/><g class="figure-person"><circle cx="90" cy="27" r="12" class="figure-head"/><path d="M90 45v35m0 0-18 22m18-22 18 22" class="figure-limbs"/><path d="m90 49-29 8-21-25" class="figure-limbs figure-arm-left"/><path d="m90 49 29 8 21-25" class="figure-limbs figure-arm-right"/></g>${kind === "flap" ? '<path d="m25 44 2 19m-5-6 5 6 6-5m121-14-2 19m-6-5 6 5 5-6" class="figure-arrow"/>' : '<path d="M46 18H27m6-5-6 5 6 5m101-5h19m-6-5 6 5-6 5" class="figure-arrow"/>'}</svg>`;
}
