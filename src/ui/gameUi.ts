import { type SoundStatus, audio } from "../audio/audio";
import type { Level } from "../game/levels";
import type { InputState } from "../input/types";
import {
  type RunResult,
  menuView,
  pauseView,
  playView,
  resultView,
} from "./views";

export type UiAction =
  | "advance"
  | "retry"
  | "menu"
  | "pause"
  | "resume"
  | "camera"
  | "fullscreen"
  | "recalibrate"
  | "sound";
export type CameraStatus = "idle" | "loading" | "ready" | "error";
type View = "menu" | "playing" | "paused" | "results";

export const WORLD_NAMES: Record<Level["id"], string> = {
  kitchen: "the kitchen",
  dessert: "the desert",
  heaven: "bird heaven",
};
const BANNER_MS = 2200;

/** Native buttons give mouse users a fallback; the camera drives everything else. */
class GameUi {
  private root!: HTMLDivElement;
  private actions = new Map<UiAction, Set<() => void>>();
  private view: View = "menu";
  private cameraStatus: CameraStatus = "idle";
  private input: Readonly<InputState> | null = null;
  private artReady = false;
  private artFailed = false;
  private sound: SoundStatus = "locked";
  private signature = "";

  mount(host: HTMLElement): void {
    this.root = document.createElement("div");
    this.root.id = "game-ui";
    host.appendChild(this.root);
    this.root.addEventListener("click", this.onClick);
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
      button.blur();
      audio.play("click");
      this.emit(button.dataset.action as UiAction);
    }
  };

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
    this.signature = "";
    this.update();
    this.updateFullscreen();
  }

  showMenu(best: number): void {
    this.render("menu", menuView(best));
  }

  showFlight(): void {
    this.render("playing", playView());
  }

  showPause(): void {
    this.showDialog("paused", pauseView());
  }

  showResults(result: RunResult, levelId: Level["id"]): void {
    this.showDialog("results", resultView(result, levelId));
  }

  private showDialog(view: "paused" | "results", html: string): void {
    this.view = view;
    this.root.dataset.view = view;
    this.root.querySelector<HTMLElement>("[data-hud]")!.inert = true;
    this.root.querySelector<HTMLElement>("[data-dialog-layer]")!.innerHTML =
      html;
    this.signature = "";
    this.update();
  }

  hideDialog(): void {
    this.view = "playing";
    this.root.dataset.view = "playing";
    this.root.querySelector<HTMLElement>("[data-hud]")!.inert = false;
    this.root.querySelector<HTMLElement>("[data-dialog-layer]")!.innerHTML = "";
    this.signature = "";
    this.update();
  }

  /** Briefly names the world the bird just flew into. */
  showWorld(levelId: Level["id"]): void {
    const banner = this.root.querySelector<HTMLElement>("[data-world-banner]");
    if (!banner) {
      return;
    }
    banner.textContent = WORLD_NAMES[levelId];
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const hidden = "translateY(-180%)";
    const shown = "translateY(0)";
    banner.getAnimations().forEach((animation) => animation.cancel());
    // The banner drops in from the top edge and leaves the same way.
    banner.animate(
      [
        { transform: hidden },
        { transform: shown, offset: still ? 0 : 0.12 },
        { transform: shown, offset: still ? 1 : 0.8 },
        { transform: hidden },
      ],
      { duration: BANNER_MS, easing: "ease-in-out", fill: "forwards" },
    );
  }

  setCameraStatus(status: CameraStatus): void {
    this.cameraStatus = status;
    this.update();
  }

  setSoundStatus(status: SoundStatus): void {
    this.sound = status;
    this.update();
  }

  setArtReady(ready: boolean): void {
    this.artReady = ready;
    if (ready) {
      this.artFailed = false;
    }
    this.update();
  }

  setArtError(): void {
    this.artFailed = true;
    this.artReady = false;
    this.update();
  }

  pulseAltitude(): void {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      this.root
        .querySelector("[data-altitude]")
        ?.animate(
          [
            { transform: "scale(1)" },
            { transform: "scale(1.18)" },
            { transform: "scale(1)" },
          ],
          { duration: 280, easing: "ease-out" },
        );
    }
  }

  updateInput(input: Readonly<InputState>): void {
    this.input = input;
    this.update();
  }

  private text(selector: string, value: string): void {
    for (const node of this.root.querySelectorAll(selector)) {
      if (node.textContent !== value) {
        node.textContent = value;
      }
    }
  }

  private cameraMessage(): string {
    if (this.cameraStatus === "error") {
      return "We couldn’t open your camera. Allow camera access in your browser, then try again.";
    }
    if (this.cameraStatus !== "ready") {
      return "Looking for your camera…";
    }
    return "";
  }

  private menuStatus(ready: boolean): string {
    if (this.artFailed) {
      return "The artwork didn’t load. Refresh the page.";
    }
    if (this.cameraStatus !== "ready") {
      return this.cameraStatus === "error"
        ? "Flap or Flop needs your camera to play."
        : "Allow camera access when your browser asks.";
    }
    if (!this.input?.tracking) {
      return "Step back until we can see your shoulders.";
    }
    return ready
      ? "That’s you! Ready when you are."
      : "Hold still for a moment…";
  }

  private update(): void {
    if (!this.root) {
      return;
    }
    const ready = Boolean(
      this.cameraStatus === "ready" &&
        this.input?.tracking &&
        this.input.calibrated,
    );
    const signature = `${this.view}:${this.cameraStatus}:${ready}:${this.input?.tracking}:${this.artReady}:${this.artFailed}:${this.sound}`;
    if (signature === this.signature) {
      return;
    }
    this.signature = signature;
    this.root.classList.toggle("camera-ready", this.cameraStatus === "ready");
    this.root.dataset.sound = this.sound;
    for (const button of this.root.querySelectorAll("[data-sound-button]")) {
      button.setAttribute("aria-pressed", String(this.sound !== "muted"));
      button.setAttribute(
        "aria-label",
        this.sound === "muted" ? "Turn sound on" : "Turn sound off",
      );
    }
    for (const hint of this.root.querySelectorAll<HTMLElement>(
      "[data-sound-hint]",
    )) {
      hint.hidden = this.sound !== "locked";
    }
    this.text("[data-camera-message]", this.cameraMessage());
    for (const retry of this.root.querySelectorAll<HTMLElement>(
      "[data-camera-retry]",
    )) {
      retry.hidden = this.cameraStatus !== "error";
    }
    this.text("[data-menu-status]", this.menuStatus(ready));
    const assetStatus = this.root.querySelector<HTMLElement>(
      "[data-asset-status]",
    );
    if (assetStatus) {
      assetStatus.hidden = this.artReady || this.artFailed;
      assetStatus.textContent = "Loading…";
    }
    for (const button of this.root.querySelectorAll<HTMLButtonElement>(
      "[data-action=advance]",
    )) {
      button.disabled = !this.artReady || !ready;
    }
    const notice = this.root.querySelector<HTMLElement>(
      "[data-tracking-notice]",
    );
    if (notice) {
      notice.hidden = this.view !== "playing" || ready;
      this.text(
        "[data-tracking-copy]",
        this.input?.tracking
          ? "Hold still for a moment while we find your wings."
          : "Stand where the camera can see your shoulders.",
      );
    }
  }

  updateHud(
    altitude: number,
    best: number,
    hint: string,
    worms: number | null,
  ): void {
    this.text("[data-altitude]", String(Math.floor(altitude)));
    this.text("[data-best]", String(Math.floor(best)));
    const warning = this.root.querySelector<HTMLElement>("[data-flight-hint]");
    if (warning) {
      warning.hidden = hint === "";
      if (warning.textContent !== hint) {
        warning.textContent = hint;
      }
    }
    const wormTotal = this.root.querySelector<HTMLElement>("[data-worm-total]");
    if (wormTotal) {
      wormTotal.hidden = worms === null;
      wormTotal.textContent = `worms ${worms ?? 0}`;
    }
  }

  destroy(): void {
    window.removeEventListener("blur", this.onBlur);
    document.removeEventListener("visibilitychange", this.onVisibility);
    document.removeEventListener("fullscreenchange", this.updateFullscreen);
    this.root.remove();
    this.actions.clear();
  }
}

export const gameUi = new GameUi();
