import { layers } from "../config/layers.ts";
import { regions } from "../config/regions.ts";
import { browserDeps } from "../data/browser.ts";
import { loadAllLayers } from "../data/load.ts";
import type { LoadResult, Place, RegionId } from "../data/types.ts";
import { applyFilters } from "../filter/apply.ts";
import {
  defaultState,
  hasActiveFilters,
  layersInRegion,
  reduce,
  type FilterAction,
  type FilterState,
} from "../filter/state.ts";
import { createStore } from "../filter/store.ts";
import { fromSearchParams, toSearchParams, type UrlContext } from "../filter/url.ts";
import { chip } from "./chips.ts";
import { mountDiagnostics } from "./diagnostics.ts";
import { renderFilterSheet } from "./filter-sheet.ts";
import { renderList, sortByName } from "./list.ts";
import { createSheet } from "./sheet.ts";

const REGION_KEY = "japlanning.region";

interface UiState {
  selectedId?: string;
}
type UiAction = { type: "select"; id: string } | { type: "deselect" };

function uiReduce(state: UiState, action: UiAction): UiState {
  if (action.type === "deselect") return state.selectedId === undefined ? state : {};
  return state.selectedId === action.id ? {} : { selectedId: action.id };
}

export function mountApp(root: HTMLElement): void {
  const ctx: UrlContext = { regions, layers, defaultRegion: regions[0]!.id };
  const filters = createStore(initialState(ctx), (s: FilterState, a: FilterAction) => reduce(s, a, layers));
  const ui = createStore<UiState, UiAction>({}, uiReduce);

  let places: Place[] = [];
  let results: LoadResult[] = [];
  let loading = true;

  root.innerHTML = `
    <header class="topbar">
      <div class="topbar-row">
        <div class="region-switch" role="group" aria-label="Region"></div>
        <button type="button" class="icon-button info" aria-label="Diagnostics">i</button>
      </div>
      <div class="layer-chips" role="group" aria-label="Layers"></div>
      <div class="topbar-row">
        <input type="search" class="search" placeholder="Search names, areas, notes" autocomplete="off" aria-label="Search" />
        <button type="button" class="filters-button">Filters</button>
      </div>
    </header>
    <main class="panes">
      <section class="list-pane" aria-label="Places">
        <p class="results-count"></p>
        <ul class="place-list"></ul>
        <div class="empty-state" hidden></div>
      </section>
      <section class="map-pane" aria-label="Map"></section>
    </main>
  `;
  const $ = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const regionSwitch = $(".region-switch");
  const layerChips = $(".layer-chips");
  const search = $<HTMLInputElement>(".search");
  const filtersButton = $<HTMLButtonElement>(".filters-button");
  const resultsCount = $(".results-count");
  const placeList = $<HTMLUListElement>(".place-list");
  const emptyState = $(".empty-state");

  const filterSheet = createSheet(root, "Filters", () => renderSheet());
  const diagSheet = createSheet(root, "Diagnostics");
  const diagnostics = mountDiagnostics(diagSheet.body, () => void reload());

  search.addEventListener("input", () => filters.dispatch({ type: "setText", text: search.value }));
  filtersButton.addEventListener("click", filterSheet.open);
  $(".info").addEventListener("click", diagSheet.open);

  function renderSheet(): void {
    const state = filters.get();
    renderFilterSheet(filterSheet.body, state, {
      region: regions.find((r) => r.id === state.region)!,
      layers: layersInRegion(layers, state.region),
      places,
      dispatch: filters.dispatch,
    });
  }

  function render(): void {
    const state = filters.get();
    const regionLayers = layersInRegion(layers, state.region);
    if (filterSheet.isOpen()) renderSheet();

    regionSwitch.replaceChildren(
      ...regions.map((r) =>
        chip(r.label, {
          pressed: r.id === state.region,
          className: "segment",
          onClick: () => filters.dispatch({ type: "setRegion", region: r.id }),
        }),
      ),
    );

    if (regionLayers.length === 0) {
      layerChips.replaceChildren(note(`No layers for ${regionLabel(state.region)} yet.`));
    } else {
      layerChips.replaceChildren(
        ...regionLayers.map((l) =>
          chip(l.label, {
            pressed: state.layers.has(l.id),
            color: l.color,
            count: places.filter((p) => p.layerId === l.id).length,
            onClick: () => filters.dispatch({ type: "toggleLayer", layer: l.id }),
          }),
        ),
      );
    }

    if (search.value !== state.text) search.value = state.text;
    filtersButton.classList.toggle("is-active", hasActiveFilters(state));

    const total = places.filter((p) => p.region === state.region && state.layers.has(p.layerId)).length;
    const shown = sortByName(applyFilters(places, state));
    resultsCount.textContent = loading && places.length === 0 ? "Loading…" : countLabel(shown.length, total);

    renderList(placeList, shown, {
      layers: regionLayers,
      showLayer: state.layers.size > 1,
      selectedId: ui.get().selectedId,
      onSelect: (id) => ui.dispatch({ type: "select", id }),
    });

    renderEmptyState(emptyState, state, shown.length, total, loading);
  }

  function renderEmptyState(el: HTMLElement, state: FilterState, shown: number, total: number, busy: boolean): void {
    el.replaceChildren();
    el.hidden = true;
    if (busy && places.length === 0) return;
    if (layersInRegion(layers, state.region).length === 0) {
      el.append(note(`${regionLabel(state.region)} has no layers yet. Add a sheet to src/config/layers.ts.`));
    } else if (state.layers.size === 0) {
      el.append(note("Pick at least one layer above."));
    } else if (total === 0) {
      el.append(note("No data loaded for these layers. Check Diagnostics."));
    } else if (shown === 0) {
      el.append(note("Nothing matches these filters."));
      if (hasActiveFilters(state)) {
        el.append(chip("Clear filters", { onClick: () => filters.dispatch({ type: "clearFilters" }) }));
      }
    } else {
      return;
    }
    el.hidden = false;
  }

  async function reload(): Promise<void> {
    loading = true;
    diagnostics.update(results, true);
    render();
    try {
      results = await loadAllLayers(layers, browserDeps());
      places = results.flatMap((r) => r.places);
    } finally {
      loading = false;
      diagnostics.update(results, false);
      render();
    }
  }

  filters.subscribe((state) => {
    syncUrl(state, ctx);
    rememberRegion(state.region);
    ui.dispatch({ type: "deselect" });
    render();
  });
  ui.subscribe(render);

  render();
  void reload();
}

function initialState(ctx: UrlContext): FilterState {
  const params = new URLSearchParams(location.search);
  if ([...params.keys()].length > 0) return fromSearchParams(params, ctx);
  return defaultState(rememberedRegion() ?? ctx.defaultRegion, ctx.layers);
}

function syncUrl(state: FilterState, ctx: UrlContext): void {
  const q = toSearchParams(state, ctx).toString();
  const url = q ? `${location.pathname}?${q}` : location.pathname;
  if (url !== location.pathname + location.search) history.replaceState(null, "", url);
}

function rememberedRegion(): RegionId | undefined {
  try {
    const v = localStorage.getItem(REGION_KEY);
    return regions.some((r) => r.id === v) ? (v as RegionId) : undefined;
  } catch {
    return undefined;
  }
}

function rememberRegion(region: RegionId): void {
  try {
    localStorage.setItem(REGION_KEY, region);
  } catch {
    /* private mode or storage blocked; the URL still carries it */
  }
}

function regionLabel(id: RegionId): string {
  return regions.find((r) => r.id === id)?.label ?? id;
}

function countLabel(shown: number, total: number): string {
  if (total === 0) return "";
  return shown === total ? `${total} place${total === 1 ? "" : "s"}` : `${shown} of ${total} places`;
}

function note(text: string): HTMLParagraphElement {
  const p = document.createElement("p");
  p.className = "note";
  p.textContent = text;
  return p;
}
