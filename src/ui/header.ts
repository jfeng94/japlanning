import type { RegionConfig, RegionId } from "../data/types.ts";
import settingsIcon from "./icons/settings.webp";
import updateIcon from "./icons/update.webp";
import { parseSharedLink } from "./links.ts";
import { createMenu } from "./menu.ts";

export interface HeaderHandlers {
  onRegion: (region: RegionId) => void;
  onSearch: (text: string) => void;
  /** The search field was opened (the list should take the screen so results have room). */
  onSearchOpen?: () => void;
  /** The search field lost focus with text in it (the keyboard closed): the map can show again. */
  onSearchBlur?: () => void;
  /** A shared link or bare place id was pasted into search. */
  onSharedLink: (placeId: string) => void;
  onSettings: () => void;
}

export interface HeaderState {
  region: RegionConfig;
  text: string;
}

export interface Header {
  el: HTMLElement;
  update(state: HeaderState): void;
  /** Expand the search field across the top bar (the strip's search button calls this). */
  openSearch(): void;
  /** A new build is installed and waiting: show the update button beside Settings; a tap applies it. */
  offerUpdate(apply: () => void): void;
}

export const CHEVRON_LEFT = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
export const CHEVRON_RIGHT = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
export const SEARCH_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15.5 15.5 20 20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;

/**
 * One row: the region menu, then (only while a new build is waiting) the
 * update button, then Settings. Search and the filter pages live in the
 * panel's footer, near the thumb; the search field itself still expands
 * across this row and collapses on Cancel.
 */
export function mountHeader(root: HTMLElement, regions: RegionConfig[], h: HeaderHandlers): Header {
  const el = document.createElement("header");
  el.className = "topbar";
  el.innerHTML = `
    <div class="topbar-main">
      <button type="button" class="menu-button region-button"><span class="label"></span><span class="caret">▾</span></button>
      <span class="spacer"></span>
      <button type="button" class="icon-button update-button" aria-label="Update ready. Tap to reload." title="Update ready" hidden><img alt="" draggable="false"></button>
      <button type="button" class="icon-button settings-button" aria-label="Settings"><img alt="" draggable="false"></button>
    </div>
    <div class="topbar-search" hidden>
      <input type="search" class="search" placeholder="Search names, areas, notes" autocomplete="off" aria-label="Search" />
      <button type="button" class="search-cancel">Cancel</button>
    </div>
  `;
  root.prepend(el);

  const $ = <T extends HTMLElement>(sel: string) => el.querySelector<T>(sel)!;
  const regionButton = $(".region-button");
  const regionLabel = $(".region-button .label");
  const settingsButton = $(".settings-button");
  const updateButton = $<HTMLButtonElement>(".update-button");
  const mainRow = $(".topbar-main");
  const searchRow = $(".topbar-search");
  const input = $<HTMLInputElement>(".search");

  $<HTMLImageElement>(".settings-button img").src = settingsIcon;
  $<HTMLImageElement>(".update-button img").src = updateIcon;

  // The update waits here until it's wanted, instead of a toast that interrupts.
  let applyUpdate: (() => void) | undefined;
  updateButton.addEventListener("click", () => {
    updateButton.disabled = true; // one tap: the page reloads once the new build takes over
    applyUpdate?.();
  });

  let current: HeaderState | undefined;

  createMenu(regionButton, () =>
    regions.map((r) => ({
      label: r.label,
      selected: r.id === current?.region.id,
      onPick: () => h.onRegion(r.id),
    })),
  );

  settingsButton.addEventListener("click", h.onSettings);

  const showSearch = (show: boolean) => {
    searchRow.hidden = !show;
    mainRow.hidden = show;
    if (show) input.focus();
  };
  $(".search-cancel").addEventListener("click", () => {
    input.value = "";
    h.onSearch("");
    showSearch(false);
  });
  input.addEventListener("input", () => {
    // iOS opens links in the browser, not the installed app, so a pasted link is the way in.
    const placeId = parseSharedLink(input.value, location.hostname);
    if (placeId) {
      input.value = "";
      showSearch(false);
      h.onSharedLink(placeId);
      return;
    }
    h.onSearch(input.value);
  });
  input.addEventListener("blur", () => {
    if (input.value !== "") h.onSearchBlur?.();
  });
  input.addEventListener("keydown", (e) => {
    // Return/Done on the phone keyboard just dismisses the keyboard; keep the query.
    if (e.key === "Enter") input.blur();
  });

  return {
    el,
    update(state) {
      current = state;
      regionLabel.textContent = state.region.label;
      if (input.value !== state.text) input.value = state.text;
      // A query cleared from elsewhere (region change, Clear) collapses the field.
      if (state.text === "" && !searchRow.hidden && document.activeElement !== input) showSearch(false);
    },
    openSearch() {
      showSearch(true);
      h.onSearchOpen?.();
    },
    offerUpdate(apply) {
      applyUpdate = apply;
      updateButton.disabled = false;
      updateButton.hidden = false;
    },
  };
}
