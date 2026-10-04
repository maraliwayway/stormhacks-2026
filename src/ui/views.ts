import { icon, movementFigure } from "./icons";

const ART = "/assets/art/";

function cameraSlot(mode: "large" | "mini"): string {
  return `<div class="camera-slot camera-slot-${mode}" data-camera-preview="${mode}">
    <div class="camera-placeholder" data-camera-placeholder>
      <img src="${ART}pigeon-rest.webp" alt="" />
      <p data-camera-message>Looking for your camera…</p>
      <button class="button" data-action="camera" data-camera-retry hidden>Try again</button>
    </div>
  </div>`;
}

function soundButton(): string {
  return `<button class="round-button" data-action="sound" data-sound-button aria-label="Sound on" aria-pressed="true">${icon("sound")}${icon("soundOff")}</button>`;
}

function tip(
  figure: "flap" | "head" | "dodge",
  title: string,
  body: string,
): string {
  return `<li class="tip">${movementFigure(figure)}<span><b>${title}</b>${body}</span></li>`;
}

export function menuView(best: number): string {
  return `<section class="screen title-screen" aria-labelledby="title-heading">
    <header class="title-bar">
      <div class="brand">
        <h1 id="title-heading" class="logo" tabindex="-1"><img src="${ART}pigeon-flight-3.webp" alt="" />flap or flop</h1>
        <p class="tagline">Dodge obstacles and stay out of cat lanes.</p>
      </div>
      <div class="corner">
        <div class="corner-buttons">${soundButton()}<button class="round-button" data-action="fullscreen" aria-label="Enter fullscreen">${icon("expand")}</button></div>
        <p class="sound-hint" data-sound-hint hidden>Click anywhere for sound</p>
      </div>
    </header>
    <div class="mirror">
      ${cameraSlot("large")}
      <p class="mirror-status" data-menu-status role="status">Looking for your camera…</p>
      <button class="button button-go" data-action="advance" disabled>${icon("palms")}<span>Palms together to fly</span></button>
      <p class="asset-status" data-asset-status role="status" hidden></p>
    </div>
    <ul class="tips" aria-label="How to play">
      ${tip("flap", "Flap your arms", "to fly up")}
      ${tip("head", "Lean your head", "to switch lanes")}
      ${tip("dodge", "Cat face?", "leave its lane")}
    </ul>
    <p class="best-score">${best > 0 ? `best <b>${Math.floor(best)} m</b>` : ""}</p>
  </section>`;
}

export function playView(): string {
  return `<section class="screen play-screen" aria-label="Flight">
    <div class="hud" data-hud>
      <div class="score" aria-label="Altitude"><p class="score-value"><strong data-altitude>0</strong><span>m</span></p><small>best <b data-best>0</b></small></div>
      <div class="corner-buttons hud-buttons">${soundButton()}<button class="round-button" data-action="pause" aria-label="Pause">${icon("pause")}</button></div>
      <div class="mini-mirror">${cameraSlot("mini")}</div>
      <p class="warning" data-flight-hint role="status" hidden></p>
      <p class="world-banner" data-world-banner aria-live="polite"></p>
      <span class="worm-total" data-worm-total hidden></span>
    </div>
    <div class="lost-tracking" data-tracking-notice hidden>
      <div class="card">
        <h2>Come back into view</h2>
        <p data-tracking-copy>Stand where the camera can see your shoulders.</p>
        ${cameraSlot("large")}
        <button class="button" data-action="recalibrate">Recalibrate</button>
      </div>
    </div>
    <div class="dialog-layer" data-dialog-layer></div>
  </section>`;
}

export function pauseView(): string {
  return `<div class="dialog-backdrop"><section class="card dialog" role="dialog" aria-modal="true" aria-labelledby="pause-heading">
    <h2 id="pause-heading" tabindex="-1">paused</h2>
    <p class="dialog-hint">${icon("palms")} Palms together to keep flying</p>
    <div class="dialog-actions">
      <button class="button button-go" data-action="resume">Resume</button>
      <button class="button button-plain" data-action="menu">Quit</button>
    </div>
  </section></div>`;
}

export interface RunResult {
  altitude: number;
  best: number;
  flaps: number;
  newBest: boolean;
  reason: string;
}

const REASONS: Record<string, string> = {
  fall: "You ran out of flaps.",
  "cat-paw": "The cat got you.",
  pot: "You flew into the cookware.",
  knife: "You flew into the cookware.",
  pin: "You flew into the cookware.",
};

export function resultView(result: RunResult, levelId = "kitchen"): string {
  const reason =
    result.reason !== "fall" && result.reason !== "cat-paw"
      ? levelId === "dessert"
        ? "You hit a cactus."
        : levelId === "heaven"
          ? "You flew into a storm cloud."
          : REASONS[result.reason]
      : REASONS[result.reason];
  return `<div class="dialog-backdrop"><section class="card dialog results" role="dialog" aria-modal="true" aria-labelledby="result-heading">
    <h2 id="result-heading" tabindex="-1">game over!</h2>
    <p class="reason">${reason ?? "Ouch."}</p>
    <div class="final-score"><strong>${Math.floor(result.altitude)}</strong><span>m</span></div>
    ${result.newBest ? '<p class="new-best">new best!</p>' : `<p class="final-best">best ${Math.floor(result.best)} m</p>`}
    <p class="dialog-hint">${icon("palms")} Palms together to play again</p>
    <div class="dialog-actions">
      <button class="button button-go" data-action="retry">Play again</button>
      <button class="button button-plain" data-action="menu">Menu</button>
    </div>
  </section></div>`;
}
