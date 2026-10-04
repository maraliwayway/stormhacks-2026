import { icon, movementFigure } from "./icons";

const ART = "/assets/art/";

function header(back = false): string {
  return `<header class="screen-header">
    <div class="brand"><span class="brand-mark">${icon("wing")}</span><span>FLAPPY ARMS<small>A very uplifting adventure</small></span></div>
    <div class="header-tools">${back ? '<button class="text-button" data-action="back">Back to the nest</button>' : '<span class="event-tag">STORMHACKS 2026</span>'}<button class="icon-button" data-action="fullscreen" aria-label="Enter fullscreen">${icon("expand")}</button></div>
  </header>`;
}

function inputChoice(): string {
  return `<div class="input-choice" role="group" aria-label="Choose your controls">
    <button class="input-option" data-action="camera" data-camera-button aria-pressed="false">${icon("camera")}<span data-camera-label>Use my camera</span></button>
    <button class="input-option" data-action="keyboard" data-keyboard-button aria-pressed="true">${icon("keyboard")}<span>Keyboard</span></button>
  </div><p class="input-status" data-input-status role="status">Keyboard ready. No camera needed.</p>`;
}

function cameraSlot(className: string): string {
  return `<div class="camera-slot ${className}" data-camera-preview>
    <div class="camera-placeholder" data-camera-placeholder>${icon("camera")}<span>Your wings go here</span><small>Enable your camera to see yourself</small></div>
  </div>`;
}

export function menuView(best: number): string {
  return `<div class="paper-screen menu-screen">${header()}
    <main class="menu-main">
      <section class="hero-layout" aria-labelledby="menu-heading">
        <div class="hero-copy">
          <p class="eyebrow"><span class="tiny-spark">✦</span> YOUR ARMS. YOUR ADVENTURE.</p>
          <h1 id="menu-heading" tabindex="-1">Small wings.<br><span>Big adventure.</span></h1>
          <p class="hero-description">Be a pigeon with places to be.<br>Flap, dodge a little mischief, and see how high you can go.</p>
          <div class="hero-actions"><button class="primary-button" data-action="advance">Take flight ${icon("arrow")}</button><span class="key-hint"><kbd>Enter</kbd> to start</span></div><p class="asset-status" data-asset-status role="status" hidden></p>
          <div class="play-your-way"><span class="small-label">PLAY YOUR WAY</span>${inputChoice()}</div>
        </div>
        <div class="hero-art" aria-label="An illustrated pigeon flying between the kitchen and desert">
          <div class="sun-blob"></div><span class="art-spark spark-one">✧</span><span class="art-spark spark-two">✧</span><span class="art-spark spark-three">+</span>
          <div class="hero-postcard postcard-kitchen"><img src="${ART}preview-kitchen.webp" alt=""/><span>A kitchen escape</span></div>
          <div class="hero-postcard postcard-dessert"><img src="${ART}preview-dessert.webp" alt=""/><img class="postcard-cactus" src="${ART}dessert-cactus-light.webp" alt=""/><span>A sandy detour</span></div>
          <img class="hero-pigeon" src="${ART}pigeon-hero.webp" alt="A blue pigeon with one wing raised" fetchpriority="high"/>
          <div class="flight-stamp">FLAP. FLY.<br>REPEAT.</div>
          <span class="hero-art-caption">A small bird with very big plans.</span>
          ${cameraSlot("menu-camera")}
        </div>
      </section>
      <section class="journey" aria-labelledby="journey-heading">
        <div class="journey-heading"><h2 id="journey-heading">One pigeon. Three worlds.</h2><p>Your world loops. Your adventure keeps growing.</p></div>
        <div class="journey-cards">
          <article class="journey-card kitchen-card"><div class="journey-art"><img src="${ART}preview-kitchen.webp" alt="An illustrated kitchen with blue cabinets"/><img class="journey-prop kitchen-prop" src="${ART}kitchen-pot-gold.webp" alt=""/></div><div class="journey-copy"><span class="world-number">01</span><div><h3>The Kitchen</h3><p>Watch out for the cookware.</p></div></div></article>
          <article class="journey-card dessert-card"><div class="journey-art"><img src="${ART}preview-dessert.webp" alt="Warm sand dunes"/><img class="journey-prop cactus-prop" src="${ART}dessert-cactus-dark.webp" alt=""/></div><div class="journey-copy"><span class="world-number">02</span><div><h3>Dessert</h3><p>Sun, sand &amp; sneaky cacti.</p></div></div></article>
          <article class="journey-card heaven-card"><div class="journey-art heaven-preview"><span class="cloud cloud-one"></span><span class="cloud cloud-two"></span><span class="cloud cloud-three"></span><span class="little-halo"></span><span class="sky-spark">✦</span></div><div class="journey-copy"><span class="world-number">03</span><div><h3>Bird Heaven</h3><p>A little room to breathe.</p></div></div></article>
        </div>
      </section>
    </main>
    <footer class="screen-footer"><span>Made for moving. Made for a little joy.</span><span>${best > 0 ? `${icon("star")} YOUR BEST <strong>${Math.floor(best)} m</strong>` : "Every great flight starts with one flap."}</span></footer>
  </div>`;
}

export function controlsView(): string {
  return `<div class="paper-screen controls-screen">${header(true)}
    <main class="controls-main">
      <div class="controls-intro"><div><p class="eyebrow">A QUICK WING CHECK</p><h1 tabindex="-1">You’ve got wings.<br><span>Let’s use them.</span></h1><p class="controls-description">Three little moves. One very happy pigeon.</p></div>
      <aside class="setup-card" aria-label="Control setup"><div class="setup-top"><span class="small-label">YOUR COCKPIT</span><span class="ready-dot" data-ready-label>Keyboard ready</span></div>${cameraSlot("setup-camera")}<div class="keyboard-preview" data-keyboard-preview><img src="${ART}pigeon-rest.webp" alt=""/><span>Ready when you are.</span><small>No camera needed to take flight.</small></div>${inputChoice()}</aside></div>
      <section class="lesson-cards" aria-label="How to fly">
        <article class="lesson-card"><span class="lesson-number">01</span>${movementFigure("flap")}<h2>Flap to rise</h2><p data-flap-copy>Tap Space for each flap.<br>A steady rhythm keeps you flying.</p><div class="lesson-key" data-flap-key><kbd>Space</kbd><span>one tap, one flap</span></div></article>
        <article class="lesson-card"><span class="lesson-number">02</span>${movementFigure("head")}<h2>Find your lane</h2><p data-lane-copy>Tap left or right to move one lane.<br>Stay light on your feet.</p><div class="lesson-key" data-lane-key><kbd>←</kbd><kbd>→</kbd><span>move left or right</span></div></article>
        <article class="lesson-card"><span class="lesson-number">03</span>${movementFigure("dodge")}<h2>Dodge the mischief</h2><p>Leave the marked lane when a cat appears.<br>Keep flapping while you dodge.</p><div class="lesson-note">${icon("warning")} A warning means time to move.</div></article>
      </section>
      <div class="controls-actions"><p class="control-confirm" data-confirm-copy><kbd>Enter</kbd> to fly. <kbd>Esc</kbd> to go back.</p><button class="primary-button" data-action="advance">Let’s fly ${icon("arrow")}</button></div>
    </main><footer class="screen-footer"><span>Take your time. The sky can wait.</span><span><kbd>Esc</kbd> pauses your flight</span></footer>
  </div>`;
}

export function playView(): string {
  return `<main class="play-layout" aria-label="Flappy Arms flight">
    <div class="play-hud">
      <section class="world-hud" aria-label="Current world"><span class="world-hud-number" data-world-number>01</span><div><span class="small-label">NOW EXPLORING</span><strong data-world-name>The Kitchen</strong><div class="world-progress" role="progressbar" aria-label="Progress to next world" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span data-world-progress></span></div></div></section>
      <section class="altitude-hud" aria-label="Flight altitude"><div><strong data-altitude>0</strong><span>m</span></div><span class="best-label">${icon("star")} BEST <b data-best>0 m</b></span></section>
      <div class="hud-tools"><button class="icon-button" data-action="pause" aria-label="Pause game">${icon("pause")}</button><button class="icon-button" data-action="fullscreen" aria-label="Enter fullscreen">${icon("expand")}</button></div>
      ${cameraSlot("hud-camera")}
      <div class="tracking-notice" data-tracking-notice hidden><span>${icon("camera")}<strong>Flight paused</strong><span data-tracking-copy>Step back into the camera view.</span></span><div><button class="text-button" data-action="recalibrate">Recalibrate</button><button class="text-button" data-action="keyboard">Use keyboard</button></div></div>
      <div class="flight-bottom"><span class="flight-mode" data-flight-mode>${icon("keyboard")} Keyboard</span><p class="flight-hint" data-flight-hint role="status">Tap Space to flap. Tap left / right to change lane.</p><span class="worm-total" data-worm-total hidden></span><span class="pause-hint"><kbd>Esc</kbd> pause</span></div>
    </div>
    <div class="dialog-layer" data-dialog-layer></div>
  </main>`;
}

export function pauseView(): string {
  return `<div class="dialog-backdrop"><section class="flight-dialog pause-dialog" role="dialog" aria-modal="true" aria-labelledby="pause-heading"><span class="dialog-emblem">${icon("pause")}</span><p class="eyebrow">WINGS AT REST</p><h1 id="pause-heading" tabindex="-1">A little breather.</h1><p>You’ve earned it. Your pigeon will wait.</p><div class="resting-bird"><img src="${ART}pigeon-rest.webp" alt="A resting pigeon"/></div><button class="primary-button" data-action="resume">Keep flying ${icon("play")}</button><button class="secondary-button" data-action="menu">${icon("home")} Back to the nest</button><div class="pause-input">${inputChoice()}</div><span class="dialog-key-hint" data-pause-confirm><kbd>Esc</kbd> to resume</span></section></div>`;
}

export interface RunResult {
  altitude: number;
  best: number;
  flaps: number;
  newBest: boolean;
  reason: string;
}

export function resultView(result: RunResult): string {
  const copy =
    result.reason === "fall"
      ? "A soft landing. Another adventure?"
      : result.reason === "cat-paw"
        ? "That cat had other plans. You’ve got the next one."
        : "A little bump in the journey. There’s more sky to explore.";
  return `<div class="dialog-backdrop"><section class="flight-dialog result-dialog" role="dialog" aria-modal="true" aria-labelledby="result-heading"><span class="result-ribbon">${icon(result.newBest ? "star" : "wing")} ${result.newBest ? "A NEW PERSONAL BEST!" : "ONE FLIGHT. A LITTLE MORE JOY."}</span><h1 id="result-heading" tabindex="-1">${result.newBest ? "Look at you fly." : "A legendary little flop."}</h1><p>${copy}</p><div class="result-score"><strong>${Math.floor(result.altitude)}</strong><span>metres of adventure</span></div><div class="result-stats"><span>${icon("star")} Best <b>${Math.floor(result.best)} m</b></span><span>${icon("wing")} Flaps <b>${result.flaps}</b></span></div><div class="result-bird"><img src="${ART}pigeon-rest.webp" alt=""/></div><button class="primary-button" data-action="retry">Fly again ${icon("refresh")}</button><button class="secondary-button" data-action="menu">${icon("home")} Back to the nest</button><p class="dialog-key-hint" data-result-confirm><kbd>Space</kbd> to retry. <kbd>Enter</kbd> for the menu.</p></section></div>`;
}
