import { layers } from "../config/layers.ts";
import { regions } from "../config/regions.ts";
import { browserDeps } from "../data/browser.ts";
import { loadAllLayersStaged } from "../data/load.ts";
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
import { pinRendererKind } from "../config/map.ts";
import { mountMap, watchFlavor } from "../map/map.ts";
import { placesToPins, type PinRenderer } from "../map/pins.ts";
import { createSdfPinRenderer } from "../map/pins-sdf.ts";
import { mountHeader } from "./header.ts";
import { renderList, sortByName } from "./list.ts";
import { mountPanel, type PanelHeight } from "./panel.ts";
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

  // Layout: header row, the map pane filling the rest, the panel over it, sheets over everything.
  root.innerHTML = `<main class="panes"><section class="map-pane" aria-label="Map"></section></main>`;
  const filterSheet = createSheet(root, "Filters", () => renderSheet());
  const diagSheet = createSheet(root, "Diagnostics");
  const diagnostics = mountDiagnostics(diagSheet.body, () => void reload());

  const header = mountHeader(root, regions, {
    onRegion: (region) => filters.dispatch({ type: "setRegion", region }),
    onLayers: filterSheet.open,
    onSearch: (text) => filters.dispatch({ type: "setText", text }),
    onFilters: filterSheet.open,
    onDiagnostics: diagSheet.open,
  });

  const panel = mountPanel(root, (h) => view.setBottomPadding(panelPadding(h)));
  const view = mountMap(
    root.querySelector<HTMLElement>(".map-pane")!,
    regions.find((r) => r.id === filters.get().region)!,
    watchFlavor((flavor) => view.setFlavor(flavor)),
  );
  view.setBottomPadding(panelPadding(panel.getHeight()));
  const pins: PinRenderer = createPinRenderer();
  pins.onSelect((id) => ui.dispatch(id === undefined ? { type: "deselect" } : { type: "select", id }));

  panel.strip.innerHTML = `<p class="results-count"></p><p class="status" role="status" hidden></p>`;
  panel.content.innerHTML = `<ul class="place-list"></ul><div class="empty-state" hidden></div>`;
  const resultsCount = panel.strip.querySelector<HTMLElement>(".results-count")!;
  const status = panel.strip.querySelector<HTMLElement>(".status")!;
  const placeList = panel.content.querySelector<HTMLUListElement>(".place-list")!;
  const emptyState = panel.content.querySelector<HTMLElement>(".empty-state")!;

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

    header.update({
      region: regions.find((r) => r.id === state.region)!,
      layersLabel: layersLabel(state, regionLayers.length),
      text: state.text,
      filtersActive: hasActiveFilters(state),
    });

    const total = places.filter((p) => p.region === state.region && state.layers.has(p.layerId)).length;
    const shown = sortByName(applyFilters(places, state));
    resultsCount.textContent = loading && places.length === 0 ? "Loading…" : countLabel(shown.length, total);
    renderStatus(status, results, loading);

    renderList(placeList, shown, {
      layers: regionLayers,
      showLayer: state.layers.size > 1,
      selectedId: ui.get().selectedId,
      onSelect: (id) => ui.dispatch({ type: "select", id }),
    });
    pins.update(placesToPins(shown, regionLayers));
    pins.setSelected(ui.get().selectedId);

    renderEmptyState(emptyState, state, shown.length, total, loading);
  }

  function layersLabel(state: FilterState, available: number): string {
    if (available === 0) return "No layers";
    const selected = [...state.layers].map((id) => layers.find((l) => l.id === id)?.label ?? id);
    if (selected.length === 0) return "No layers";
    if (selected.length === 1) return selected[0]!;
    if (selected.length === available) return "All layers";
    return `${selected.length} layers`;
  }

  function renderEmptyState(el: HTMLElement, state: FilterState, shown: number, total: number, busy: boolean): void {
    el.replaceChildren();
    el.hidden = true;
    if (busy && places.length === 0) return;
    if (layersInRegion(layers, state.region).length === 0) {
      el.append(note(`${regionLabel(state.region)} has no layers yet. Add a sheet to src/config/layers.ts.`));
    } else if (state.layers.size === 0) {
      el.append(note("Pick at least one layer."), chip("Choose layers", { onClick: filterSheet.open }));
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

  /** Staged: whatever is on the device renders first, the network result replaces it. */
  async function reload(): Promise<void> {
    loading = true;
    diagnostics.update(results, true);
    render();
    try {
      await loadAllLayersStaged(layers, browserDeps(), (latest, done) => {
        results = latest;
        places = latest.flatMap((r) => r.places);
        loading = !done;
        diagnostics.update(results, loading);
        render();
      });
    } finally {
      loading = false;
      diagnostics.update(results, false);
      render();
    }
  }

  function createPinRenderer(): PinRenderer {
    const css = getComputedStyle(document.documentElement);
    const colors = { label: css.getPropertyValue("--fg").trim(), halo: css.getPropertyValue("--bg-raised").trim() };
    const kind = pinRendererKind();
    // The DOM renderer arrives in step 3b; until then every choice is the SDF one.
    return kind === "dom" ? createSdfPinRenderer(view, colors) : createSdfPinRenderer(view, colors);
  }

  filters.subscribe((state) => {
    syncUrl(state, ctx);
    rememberRegion(state.region);
    view.setRegion(regions.find((r) => r.id === state.region)!);
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

/**
 * One line in the panel strip: nothing when everything is live,
 * otherwise the one thing worth knowing (updating, offline, or no data).
 */
function renderStatus(el: HTMLElement, results: LoadResult[], loading: boolean): void {
  let text = "";
  const stale = results.filter((r) => r.source === "cache" || r.source === "bundled");
  const missing = results.filter((r) => r.source === "none");
  if (loading) {
    text = results.length === 0 ? "Loading…" : "Updating…";
  } else if (missing.length > 0) {
    text = `No data for ${missing.map((r) => layers.find((l) => l.id === r.layerId)?.label ?? r.layerId).join(", ")}`;
  } else if (stale.length > 0) {
    const oldest = stale.reduce<Date | undefined>(
      (min, r) => (r.fetchedAt && (!min || r.fetchedAt < min) ? r.fetchedAt : min),
      undefined,
    );
    text = oldest ? `Offline · showing data from ${relativeTime(oldest)}` : "Offline · showing saved data";
  }
  el.textContent = text;
  el.hidden = text === "";
  el.classList.toggle("is-warning", missing.length > 0);
}

function relativeTime(d: Date): string {
  const mins = Math.round((Date.now() - d.getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 60 * 48) return `${Math.round(mins / 60)} h ago`;
  return `${Math.round(mins / 1440)} d ago`;
}

/** How much of the viewport the panel covers at each height; mirrors the CSS. */
function panelPadding(h: PanelHeight): number {
  const vh = window.innerHeight;
  if (h === "strip") return 90;
  if (h === "half") return vh * 0.46;
  return vh * 0.85;
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
