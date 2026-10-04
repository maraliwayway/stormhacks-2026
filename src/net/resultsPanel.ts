/**
 * Owner: Dev 3. Adds the voice caption and leaderboard to the team's native results dialog,
 * and a "Top flyers" board to the menu header, without editing src/ui.
 * A MutationObserver notices when those screens render. User text is only ever set via textContent.
 */
import { voiceDirector } from "../audio/voiceDirector";
import type { SpokenLine } from "../audio/voiceDirector";
import { backendLink } from "./backendLink";
import {
  type LeaderboardEntry,
  NAME_MAX,
  type RunPlacement,
  leaderboard,
} from "./leaderboard";
import "./resultsPanel.css";

const PANEL_HTML = `<section class="dev3-panel" aria-label="Voice and leaderboard">
  <figure class="dev3-quote" data-dev3-quote hidden>
    <figcaption><span data-dev3-speaker></span><span class="dev3-live" data-dev3-live hidden>LIVE ROAST</span></figcaption>
    <blockquote data-dev3-text></blockquote>
  </figure>
  <div class="dev3-board" data-dev3-board hidden>
    <p class="dev3-rank"><b data-dev3-rank></b> <span data-dev3-rank-copy></span></p>
    <form class="dev3-sign" data-dev3-sign>
      <label for="dev3-name">Signed as</label>
      <input id="dev3-name" name="name" maxlength="${NAME_MAX}" autocomplete="off" spellcheck="false" required />
      <button type="submit" class="button button-go dev3-save">Save</button>
    </form>
  </div>
</section>`;

export function rankCopy(rank: number): string {
  if (rank === 1) {
    return "Top of the flock!";
  }
  if (rank <= 3) {
    return "On the podium.";
  }
  return rank <= 10 ? "In the top ten." : "on the flyers board.";
}

export function formatMetres(altitude: number): string {
  return `${Math.floor(altitude)} m`;
}

function renderQuote(panel: HTMLElement, line: SpokenLine | null): void {
  const quote = panel.querySelector<HTMLElement>("[data-dev3-quote]")!;
  quote.hidden = !line;
  if (!line) {
    return;
  }
  panel.querySelector("[data-dev3-speaker]")!.textContent = line.speaker;
  panel.querySelector<HTMLElement>("[data-dev3-live]")!.hidden = !line.live;
  panel.querySelector("[data-dev3-text]")!.textContent = `“${line.text}”`;
}

function renderPlacement(
  panel: HTMLElement,
  placement: RunPlacement | null,
): void {
  const board = panel.querySelector<HTMLElement>("[data-dev3-board]")!;
  board.hidden = !placement;
  if (!placement) {
    return;
  }
  panel.querySelector("[data-dev3-rank]")!.textContent = `#${placement.rank}`;
  panel.querySelector("[data-dev3-rank-copy]")!.textContent = rankCopy(
    placement.rank,
  );
  const input = panel.querySelector<HTMLInputElement>("#dev3-name")!;
  if (document.activeElement !== input) {
    input.value =
      placement.entries.find((entry) => entry.id === placement.id)?.name ??
      leaderboard.callSign;
  }
}

function attachPanel(dialog: HTMLElement): void {
  const holder = document.createElement("div");
  holder.innerHTML = PANEL_HTML;
  const panel = holder.firstElementChild as HTMLElement;
  const anchor = dialog.querySelector(".final-score");
  dialog.insertBefore(
    panel,
    anchor?.nextSibling ?? dialog.querySelector(".dialog-actions"),
  );
  renderQuote(panel, voiceDirector.lastDeathLine);
  renderPlacement(panel, leaderboard.latest);
  const form = panel.querySelector<HTMLFormElement>("[data-dev3-sign]")!;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = form.querySelector<HTMLInputElement>("input")!;
    const save = form.querySelector<HTMLButtonElement>("button")!;
    save.disabled = true;
    const saved = await leaderboard.rename(input.value);
    save.disabled = false;
    save.textContent = saved ? "Saved" : "Try again";
    input.blur();
  });
}

function renderTop(
  list: HTMLOListElement,
  entries: LeaderboardEntry[] | null,
): void {
  list.replaceChildren();
  const rows = entries ?? [];
  if (rows.length === 0) {
    const empty = document.createElement("li");
    empty.className = "dev3-empty";
    empty.textContent = entries
      ? "No flights yet. Be the first legend."
      : "The leaderboard is offline.";
    list.append(empty);
    return;
  }
  for (const entry of rows) {
    const row = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = entry.name;
    const metres = document.createElement("b");
    metres.textContent = formatMetres(entry.altitude);
    row.append(name, metres);
    list.append(row);
  }
}

function attachTopFlyers(tools: HTMLElement): void {
  const wrap = document.createElement("div");
  wrap.className = "dev3-top";
  wrap.innerHTML = `<button type="button" class="button dev3-top-button" aria-expanded="false" aria-controls="dev3-top-list">Top flyers</button>
    <div class="dev3-popover" id="dev3-top-list" hidden><p class="small-label">Top flyers</p><ol></ol></div>`;
  tools.prepend(wrap);
  const button = wrap.querySelector<HTMLButtonElement>("button")!;
  const popover = wrap.querySelector<HTMLElement>(".dev3-popover")!;
  const close = (): void => {
    popover.hidden = true;
    button.setAttribute("aria-expanded", "false");
  };
  button.addEventListener("click", async () => {
    if (!popover.hidden) {
      close();
      return;
    }
    popover.hidden = false;
    button.setAttribute("aria-expanded", "true");
    const list = popover.querySelector("ol")!;
    list.innerHTML = '<li class="dev3-empty">Loading…</li>';
    renderTop(list, await leaderboard.top());
  });
  wrap.addEventListener("keydown", (event) => {
    if (event.code === "Escape") {
      close();
      button.focus();
    }
  });
}

/** One document listener closes the board on any outside click, however often the menu re-renders. */
function closeTopFlyersOutside(event: PointerEvent): void {
  for (const wrap of document.querySelectorAll<HTMLElement>(".dev3-top")) {
    if (!wrap.contains(event.target as Node)) {
      wrap.querySelector<HTMLElement>(".dev3-popover")!.hidden = true;
      wrap.querySelector("button")?.setAttribute("aria-expanded", "false");
    }
  }
}

function scan(root: HTMLElement): void {
  const dialog = root.querySelector<HTMLElement>(".results");
  if (dialog && !dialog.querySelector(".dev3-panel")) {
    attachPanel(dialog);
  }
  const tools = root.querySelector<HTMLElement>(".title-screen .corner-buttons");
  if (tools && backendLink.configured && !tools.querySelector(".dev3-top")) {
    attachTopFlyers(tools);
  }
}

export function installResultsPanel(host: HTMLElement): () => void {
  const panel = (): HTMLElement | null => host.querySelector(".dev3-panel");
  const observer = new MutationObserver(() => scan(host));
  observer.observe(host, { childList: true, subtree: true });
  document.addEventListener("pointerdown", closeTopFlyersOutside, true);
  scan(host);
  const remove = [
    voiceDirector.onDeathLine((line) => {
      const current = panel();
      if (current) {
        renderQuote(current, line);
      }
    }),
    leaderboard.subscribe((placement) => {
      const current = panel();
      if (current) {
        renderPlacement(current, placement);
      }
    }),
  ];
  return () => {
    observer.disconnect();
    document.removeEventListener("pointerdown", closeTopFlyersOutside, true);
    for (const off of remove) {
      off();
    }
  };
}
