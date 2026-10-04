import type { Level } from "../game/levels";
import type { InputState } from "../input/types";
import { icon } from "./icons";
import {
  type RunResult,
  controlsView,
  menuView,
  pauseView,
  playView,
  resultView,
} from "./views";

export type UiAction =
  | "advance"
  | "back"
  | "retry"
  | "menu"
  | "pause"
  | "resume"
  | "camera"
  | "keyboard"
  | "fullscreen"
  | "recalibrate";
export type CameraStatus = "idle" | "loading" | "ready" | "error";
type View = "menu" | "controls" | "playing" | "paused" | "results";

const WORLD_NAMES = {
  kitchen: "The Kitchen",
  dessert: "Dessert",
  heaven: "Bird Heaven",
};
const WORLD_NUMBERS = { kitchen: "01", dessert: "02", heaven: "03" };

/** Native buttons keep focus, keyboard, touch, and assistive technology in one place. */
class GameUi {
  private root!: HTMLDivElement;
  private actions = new Map<UiAction, Set<() => void>>();
  private view: View = "menu";
  private cameraStatus: CameraStatus = "idle";
  private cameraActive = false;
  private input: Readonly<InputState> | null = null;
  private artReady = false;
  private artFailed = false;
  private inputSignature = "";

  mount(host: HTMLElement): void {
    this.root = document.createElement("div");
    this.root.id = "game-ui";
    host.appendChild(this.root);
    this.root.addEventListener("click", this.onClick);
    window.addEventListener("keydown", this.onKey);
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("visibilitychange", this.onVisibility);
    document.addEventListener("fullscreenchange", this.updateFullscreen);
  }

  onAction(action: UiAction, callback: () => void): () => void {
    const callbacks = this.actions.get(action) ?? new Set();
    callbacks.add(callback);
    this.actions.set(action, callbacks);
    return () => callbacks.delete(callback);
  }

  private emit(action: UiAction): void {
    this.actions.get(action)?.forEach((callback) => callback());
  }

  private onClick = (event: MouseEvent): void => {
    const button = (event.target as Element).closest<HTMLButtonElement>(
      "button[data-action]",
    );
    if (button && !button.disabled) {
      this.emit(button.dataset.action as UiAction);
    }
  };

  private onKey = (event: KeyboardEvent): void => {
    if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }
    if (event.code === "Escape") {
      event.preventDefault();
      if (this.view === "playing") {
        this.emit("pause");
      } else if (this.view === "paused") {
        this.emit("resume");
      } else if (this.view === "controls") {
        this.emit("back");
      }
    }
    if (event.code === "Tab" && this.view === "paused") {
      this.trapFocus(event);
    }
    if (event.code === "Tab" && this.view === "results") {
      this.trapFocus(event);
    }
  };

  private trapFocus(event: KeyboardEvent): void {
    const buttons = Array.from(
      this.root.querySelectorAll<HTMLButtonElement>(
        '[role="dialog"] button:not(:disabled)',
      ),
    );
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (
      event.shiftKey &&
      (document.activeElement === first ||
        !buttons.includes(document.activeElement as HTMLButtonElement))
    ) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  private onBlur = (): void => {
    if (this.view === "playing") {
      this.emit("pause");
    }
  };

  private onVisibility = (): void => {
    if (document.hidden) {
      this.onBlur();
    }
  };

  private updateFullscreen = (): void => {
    for (const button of this.root.querySelectorAll(
      "[data-action=fullscreen]",
    )) {
      button.setAttribute(
        "aria-label",
        document.fullscreenElement ? "Exit fullscreen" : "Enter fullscreen",
      );
    }
  };

  private render(view: View, html: string): void {
    this.view = view;
    this.root.dataset.view = view;
    this.root.innerHTML = html;
    this.root.scrollTop = 0;
    this.inputSignature = "";
    this.updateInputUi();
    this.updateFullscreen();
    this.focusHeading();
  }

  private focusHeading(): void {
    this.root
      .querySelector<HTMLElement>("[role=dialog] h1, .paper-screen h1")
      ?.focus({ preventScroll: true });
  }

  showMenu(best: number): void {
    this.render("menu", menuView(best));
  }

  showControls(): void {
    this.render("controls", controlsView());
  }

  showFlight(): void {
    this.render("playing", playView());
  }

  showPause(): void {
    this.showDialog("paused", pauseView());
  }

  showResults(result: RunResult): void {
    this.showDialog("results", resultView(result));
  }

  private showDialog(view: "paused" | "results", html: string): void {
    this.view = view;
    this.root.dataset.view = view;
    this.root.querySelector<HTMLElement>(".play-hud")!.inert = true;
    this.root.querySelector<HTMLElement>("[data-dialog-layer]")!.innerHTML =
      html;
    this.inputSignature = "";
    this.updateInputUi();
    this.focusHeading();
  }

  hideDialog(): void {
    this.view = "playing";
    this.root.dataset.view = "playing";
    this.root.querySelector<HTMLElement>(".play-hud")!.inert = false;
    this.root.querySelector<HTMLElement>("[data-dialog-layer]")!.innerHTML = "";
    this.inputSignature = "";
    // Return gameplay focus to the page so Space means a flap, not a button click.
    (document.activeElement as HTMLElement | null)?.blur();
    this.updateInputUi();
  }

  setCameraStatus(status: CameraStatus): void {
    this.cameraStatus = status;
    this.updateInputUi();
  }

  setArtReady(ready: boolean): void {
    this.artReady = ready;
    if (ready) {
      this.artFailed = false;
    }
    this.updateInputUi();
  }

  setArtError(): void {
    this.artFailed = true;
    this.artReady = false;
    this.updateInputUi();
  }

  pulseAltitude(): void {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      this.root
        .querySelector("[data-altitude]")
        ?.animate(
          [
            { transform: "scale(1)" },
            { transform: "scale(1.14)" },
            { transform: "scale(1)" },
          ],
          { duration: 280, easing: "ease-out" },
        );
    }
  }

  updateInput(input: Readonly<InputState>, cameraActive: boolean): void {
    this.input = input;
    this.cameraActive = cameraActive;
    this.updateInputUi();
  }

  private text(selector: string, value: string): void {
    for (const node of this.root.querySelectorAll(selector)) {
      if (node.textContent !== value) {
        node.textContent = value;
      }
    }
  }

  private updateInputUi(): void {
    if (!this.root) {
      return;
    }
    const ready = this.input?.tracking && this.input.calibrated;
    const signature = `${this.view}:${this.cameraStatus}:${this.cameraActive}:${ready}:${this.input?.tracking}:${this.artReady}:${this.artFailed}`;
    if (signature === this.inputSignature) {
      return;
    }
    this.inputSignature = signature;
    const assetStatus = this.root.querySelector<HTMLElement>(
      "[data-asset-status]",
    );
    if (assetStatus) {
      assetStatus.hidden = this.artReady;
      assetStatus.textContent = this.artFailed
        ? "The artwork couldn’t load. Refresh the page to try again."
        : "Loading your world…";
    }
    this.root.classList.toggle("camera-active", this.cameraActive);
    this.root.classList.toggle(
      "camera-loading",
      this.cameraStatus === "loading",
    );
    for (const button of this.root.querySelectorAll<HTMLButtonElement>(
      "[data-camera-button]",
    )) {
      button.setAttribute("aria-pressed", String(this.cameraActive));
      button.disabled = this.cameraStatus === "loading";
    }
    for (const button of this.root.querySelectorAll("[data-keyboard-button]")) {
      button.setAttribute("aria-pressed", String(!this.cameraActive));
    }
    const message = this.cameraActive
      ? ready
        ? "Camera ready. Your wings are the controller."
        : "Keep your shoulders in view. Hold still for two seconds to calibrate."
      : this.cameraStatus === "loading"
        ? "Opening your camera. Allow camera access to use your wings."
        : this.cameraStatus === "error"
          ? "Camera unavailable. Keyboard is ready, or try the camera again."
          : "Keyboard ready. No camera needed.";
    this.text("[data-input-status]", message);
    this.text(
      "[data-camera-label]",
      this.cameraStatus === "loading" ? "Opening camera…" : "Use my camera",
    );
    this.text(
      "[data-ready-label]",
      this.cameraActive
        ? ready
          ? "Wings ready"
          : "Finding your wings"
        : "Keyboard ready",
    );
    this.text(
      "[data-flap-copy]",
      this.cameraActive
        ? "Small flaps with both arms make you rise.\nA steady rhythm keeps you flying."
        : "Tap Space for each flap.\nA steady rhythm keeps you flying.",
    );
    this.text(
      "[data-lane-copy]",
      this.cameraActive
        ? "Move your head into LEFT or RIGHT.\nReturn to STAY to reset, keeping your lane."
        : "Tap left or right to move one lane.\nStay light on your feet.",
    );
    const flapKey = this.root.querySelector("[data-flap-key]");
    const laneKey = this.root.querySelector("[data-lane-key]");
    if (flapKey) {
      flapKey.innerHTML = this.cameraActive
        ? "<span>small movements, both arms</span>"
        : "<kbd>Space</kbd><span>one tap, one flap</span>";
    }
    if (laneKey) {
      laneKey.innerHTML = this.cameraActive
        ? "<span>LEFT · STAY · RIGHT</span>"
        : "<kbd>←</kbd><kbd>→</kbd><span>move left or right</span>";
    }
    this.text(
      "[data-confirm-copy]",
      this.cameraActive
        ? ready
          ? "Palms together to fly. Separate hands before selecting again."
          : "Calibrate your camera, or choose Keyboard to fly."
        : "Enter to fly. Esc to go back.",
    );
    this.text(
      "[data-result-confirm]",
      this.cameraActive
        ? "Click Fly again to retry. Palms together for the menu."
        : "Space to retry. Enter for the menu.",
    );
    this.text(
      "[data-pause-confirm]",
      this.cameraActive
        ? "Palms together or press Esc to resume."
        : "Esc to resume",
    );
    for (const button of this.root.querySelectorAll<HTMLButtonElement>(
      "[data-action=advance]",
    )) {
      button.disabled =
        !this.artReady ||
        this.cameraStatus === "loading" ||
        (this.cameraActive && !ready);
    }
    const notice = this.root.querySelector<HTMLElement>(
      "[data-tracking-notice]",
    );
    if (notice) {
      notice.hidden = !this.cameraActive || Boolean(ready);
      this.text(
        "[data-tracking-copy]",
        this.input?.tracking
          ? "Hold still in the camera box to calibrate."
          : "Step back into the camera view.",
      );
    }
    const mode = this.root.querySelector<HTMLElement>("[data-flight-mode]");
    const modeName = this.cameraActive ? "Camera" : "Keyboard";
    if (mode && mode.dataset.mode !== modeName) {
      mode.dataset.mode = modeName;
      mode.innerHTML = `${icon(this.cameraActive ? "camera" : "keyboard")} ${modeName}`;
    }
  }

  updateHud(
    altitude: number,
    best: number,
    level: Level,
    hint: string,
    worms: number | null,
  ): void {
    this.text("[data-altitude]", String(Math.floor(altitude)));
    this.text("[data-best]", `${Math.floor(best)} m`);
    this.text("[data-world-name]", WORLD_NAMES[level.id]);
    this.text("[data-world-number]", WORLD_NUMBERS[level.id]);
    this.text("[data-flight-hint]", hint);
    const warning = /Obstacle|CAT!/.test(hint);
    this.root
      .querySelector("[data-flight-hint]")
      ?.classList.toggle("is-warning", warning);
    const progress = Math.round(
      Math.min(
        1,
        Math.max(0, (altitude - level.start) / (level.end - level.start)),
      ) * 100,
    );
    const bar = this.root.querySelector<HTMLElement>("[data-world-progress]");
    if (bar) {
      bar.style.width = `${progress}%`;
      bar.parentElement!.setAttribute("aria-valuenow", String(progress));
    }
    const wormTotal = this.root.querySelector<HTMLElement>("[data-worm-total]");
    if (wormTotal) {
      wormTotal.hidden = worms === null;
      wormTotal.textContent = `Worms ${worms ?? 0}`;
    }
  }

  destroy(): void {
    window.removeEventListener("keydown", this.onKey);
    window.removeEventListener("blur", this.onBlur);
    document.removeEventListener("visibilitychange", this.onVisibility);
    document.removeEventListener("fullscreenchange", this.updateFullscreen);
    this.root.remove();
    this.actions.clear();
  }
}

export const gameUi = new GameUi();
