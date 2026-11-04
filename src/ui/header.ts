import type { RegionConfig, RegionId } from "../data/types.ts";
import filtersIcon from "./icons/filters.webp";
import settingsIcon from "./icons/settings.webp";
import { createMenu } from "./menu.ts";

export interface HeaderHandlers {
  onRegion: (region: RegionId) => void;
  onLayers: () => void;
  onSearch: (text: string) => void;
  onFilters: () => void;
  onSettings: () => void;
}

export interface HeaderState {
  region: RegionConfig;
  /** "Coffee", "2 layers", "No layers". */
  layersLabel: string;
  text: string;
  filtersActive: boolean;
}

export interface Header {
  el: HTMLElement;
  update(state: HeaderState): void;
}

const SEARCH_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15.5 15.5 20 20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;

/**
 * One row: region menu, layers button, then search, Filters and
 * Settings as icon buttons. Search expands into a field across the row
 * and collapses on Cancel. Diagnostics lives in the Settings sheet.
 */
export function mountHeader(root: HTMLElement, regions: RegionConfig[], h: HeaderHandlers): Header {
  const el = document.createElement("header");
  el.className = "topbar";
  el.innerHTML = `
    <div class="topbar-main">
      <button type="button" class="menu-button region-button"><span class="label"></span><span class="caret">▾</span></button>
      <button type="button" class="menu-button layers-button"><span class="label"></span><span class="caret">▾</span></button>
      <span class="spacer"></span>
      <button type="button" class="icon-button search-toggle" aria-label="Search">${SEARCH_ICON}<span class="dot" hidden></span></button>
      <button type="button" class="icon-button filters-button" aria-label="Filters"><img alt="" draggable="false"><span class="dot" hidden></span></button>
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
  const layersButton = $(".layers-button");
  const layersLabel = $(".layers-button .label");
  const searchToggle = $(".search-toggle");
  const searchDot = $(".search-toggle .dot");
  const filtersButton = $(".filters-button");
  const filtersDot = $(".filters-button .dot");
  const settingsButton = $(".settings-button");
  const mainRow = $(".topbar-main");
  const searchRow = $(".topbar-search");
  const input = $<HTMLInputElement>(".search");

  $<HTMLImageElement>(".filters-button img").src = filtersIcon;
  $<HTMLImageElement>(".settings-button img").src = settingsIcon;

  let current: HeaderState | undefined;

  createMenu(regionButton, () =>
    regions.map((r) => ({
      label: r.label,
      selected: r.id === current?.region.id,
      onPick: () => h.onRegion(r.id),
    })),
  );

  layersButton.addEventListener("click", h.onLayers);
  filtersButton.addEventListener("click", h.onFilters);
  settingsButton.addEventListener("click", h.onSettings);

  const showSearch = (show: boolean) => {
    searchRow.hidden = !show;
    mainRow.hidden = show;
    if (show) input.focus();
  };
  searchToggle.addEventListener("click", () => showSearch(true));
  $(".search-cancel").addEventListener("click", () => {
    input.value = "";
    h.onSearch("");
    showSearch(false);
  });
  input.addEventListener("input", () => h.onSearch(input.value));
  input.addEventListener("keydown", (e) => {
    // Return/Done on the phone keyboard just dismisses the keyboard; keep the query.
    if (e.key === "Enter") input.blur();
  });

  return {
    el,
    update(state) {
      current = state;
      regionLabel.textContent = state.region.label;
      layersLabel.textContent = state.layersLabel;
      if (input.value !== state.text) input.value = state.text;
      searchDot.hidden = state.text === "";
      filtersDot.hidden = !state.filtersActive;
      filtersButton.classList.toggle("is-active", state.filtersActive);
      // A query cleared from elsewhere (region change, Clear) collapses the field.
      if (state.text === "" && !searchRow.hidden && document.activeElement !== input) showSearch(false);
    },
  };
}
