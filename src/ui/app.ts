import { layers } from "../config/layers.ts";
import { pinRendererKind } from "../config/map.ts";
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
import { mountMap, watchFlavor } from "../map/map.ts";
import { placesToPins, type PinRenderer } from "../map/pins.ts";
import { createDomPinRenderer } from "../map/pins-dom.ts";
import { createSdfPinRenderer } from "../map/pins-sdf.ts";
import { chip } from "./chips.ts";
import { renderDetail, renderDetailStrip } from "./detail.ts";
import { mountDiagnostics } from "./diagnostics.ts";
import { renderFilterSheet } from "./filter-sheet.ts";
import { mountHeader } from "./header.ts";
import { renderList, sortByName } from "./list.ts";
import { mountPanel } from "./panel.ts";
import { renderSettingsSheet } from "./settings-sheet.ts";
import { createSheet } from "./sheet.ts";

const REGION_KEY = "japlanning.region";
const SELECTED_PARAM = "s";

interface UiState {
  selectedId?: string;
}
type UiAction = { type: "select"; id: string } | { type: "deselect" };

function uiReduce(state: UiState, action: UiAction): UiState {
  if (action.type === "deselect") return state.selectedId === undefined ? state : {};
  return state.selectedId === action.id ? state : { selectedId: action.id };
}

export function mountApp(root: HTMLElement): void {
  const ctx: UrlContext = { regions, layers, defaultRegion: regions[0]!.id };
  const startParams = new URLSearchParams(location.search);
  const filters = createStore(initialState(startParams, ctx), (s: FilterState, a: FilterAction) => reduce(s, a, layers));
  const ui = createStore<UiState, UiAction>({}, uiReduce);

  let places: Place[] = [];
  let results: LoadResult[] = [];
  let loading = true;
  /** A place id from the URL to select once its data has loaded. */
  let pendingSelection: string | undefined = startParams.get(SELECTED_PARAM) ?? undefined;
  let fittedOnce = false;

  // Layout: header row, the map pane filling the rest, the panel over it, sheets over everything.
  root.innerHTML = `
    <main class="panes">
      <section class="map-pane" aria-label="Map"></section>
      <a class="osm-credit" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a>
      <button type="button" class="fit-button" aria-label="Fit map to results" title="Fit to results">
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4"/>
          <circle cx="12" cy="12" r="2.5"/>
        </svg>
      </button>
    </main>
  `;
  const filterSheet = createSheet(root, "Filters", () => renderSheet());
  const diagSheet = createSheet(root, "Diagnostics");
  const settingsSheet = createSheet(root, "Settings", () =>
    renderSettingsSheet(settingsSheet.body, { onChange: () => swapPinRenderer(), onDiagnostics: () => diagSheet.open() }),
  );
  const diagnostics = mountDiagnostics(diagSheet.body, () => void reload());

  const header = mountHeader(root, regions, {
    onRegion: (region) => filters.dispatch({ type: "setRegion", region }),
    onLayers: filterSheet.open,
    onSearch: (text) => filters.dispatch({ type: "setText", text }),
    onFilters: filterSheet.open,
    onSettings: settingsSheet.open,
  });

  const panel = mountPanel(root, (_h, px) => view.setBottomPadding(px));
  const view = mountMap(
    root.querySelector<HTMLElement>(".map-pane")!,
    regions.find((r) => r.id === filters.get().region)!,
    watchFlavor((flavor) => view.setFlavor(flavor)),
  );
  view.setBottomPadding(panel.heightPx());
  let pins: PinRenderer = createPinRenderer();
  pins.onSelect((id) => (id === undefined ? deselect() : select(id)));

  /** Settings changed: tear the renderer down and build it again from the new settings. */
  function swapPinRenderer(): void {
    pins.destroy();
    pins = createPinRenderer();
    pins.onSelect((id) => (id === undefined ? deselect() : select(id)));
    render();
  }
  root.querySelector(".fit-button")!.addEventListener("click", () => fitToResults());

  // The panel's two contents. The strip is always visible; the body shows at half and full.
  const listStrip = el("div", "strip-list", `<p class="results-count"></p><p class="status" role="status" hidden></p>`);
  const detailStrip = el("div", "strip-detail");
  const listBody = el("div", "body-list", `<ul class="place-list"></ul><div class="empty-state" hidden></div>`);
  const detailBody = el("div", "body-detail");
  panel.strip.append(listStrip, detailStrip);
  panel.content.append(listBody, detailBody);
  const resultsCount = listStrip.querySelector<HTMLElement>(".results-count")!;
  const status = listStrip.querySelector<HTMLElement>(".status")!;
  const placeList = listBody.querySelector<HTMLUListElement>(".place-list")!;
  const emptyState = listBody.querySelector<HTMLElement>(".empty-state")!;

  // ---- selection: one state for "selected" and "detail open" ----

  /** Opening the detail pushes one history entry; switching place while open replaces it, so back always means "to the list". */
  function select(id: string): void {
    const current = ui.get().selectedId;
    if (current === id) return;
    ui.dispatch({ type: "select", id });
    const alreadyOpen = current !== undefined && (history.state as { s?: string } | null)?.[SELECTED_PARAM] === current;
    const state = { [SELECTED_PARAM]: id };
    if (alreadyOpen) history.replaceState(state, "", urlFor(filters.get(), id));
    else history.pushState(state, "", urlFor(filters.get(), id));
  }

  /**
   * Back arrow, map tap, filter change. If this app pushed the entry, go
   * back so the stack stays clean; otherwise (a place opened straight from
   * the URL) just clear it in place.
   */
  function deselect(): void {
    if (ui.get().selectedId === undefined) return;
    const pushed = (history.state as { s?: string } | null)?.[SELECTED_PARAM] === ui.get().selectedId;
    if (pushed) {
      history.back(); // popstate finishes the job
    } else {
      ui.dispatch({ type: "deselect" });
      history.replaceState(null, "", urlFor(filters.get()));
    }
  }

  window.addEventListener("popstate", () => {
    const id = (history.state as { s?: string } | null)?.[SELECTED_PARAM];
    if (id && places.some((p) => p.id === id)) {
      ui.dispatch({ type: "select", id });
    } else {
      ui.dispatch({ type: "deselect" });
      // The entry we returned to may still carry s= in its URL (a link opened directly).
      history.replaceState(history.state, "", urlFor(filters.get()));
    }
  });

  ui.subscribe(({ selectedId }) => {
    const place = selectedId ? places.find((p) => p.id === selectedId) : undefined;
    if (place) {
      view.focus(place.lng, place.lat);
      if (panel.getHeight() === "strip") panel.setHeight("half");
    }
    render();
  });

  // ---- rendering ----

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
    const selectedId = ui.get().selectedId;
    const selected = selectedId ? shown.find((p) => p.id === selectedId) : undefined;

    resultsCount.textContent = loading && places.length === 0 ? "Loading…" : countLabel(shown.length, total);
    renderStatus(status, results, loading);
    renderList(placeList, shown, {
      layers: regionLayers,
      showLayer: state.layers.size > 1,
      selectedId,
      onSelect: select,
    });
    renderEmptyState(emptyState, state, shown.length, total, loading);

    if (selected) {
      renderDetail(detailBody, selected, regionLayers.find((l) => l.id === selected.layerId), deselect);
      renderDetailStrip(detailStrip, selected);
    }
    panel.el.dataset["mode"] = selected ? "detail" : "list";

    pins.update(placesToPins(shown, regionLayers));
    pins.setSelected(selectedId);
  }

  function fitToResults(): void {
    const shown = applyFilters(places, filters.get());
    view.fitPoints(shown.map((p) => [p.lng, p.lat]));
  }

  function layersLabel(state: FilterState, available: number): string {
    if (available === 0) return "No layers";
    const selected = [...state.layers].map((id) => layers.find((l) => l.id === id)?.label ?? id);
    if (selected.length === 0) return "No layers";
    if (selected.length === 1) return selected[0]!;
    if (selected.length === available) return "All layers";
    return `${selected.length} layers`;
  }

  function renderEmptyState(target: HTMLElement, state: FilterState, shown: number, total: number, busy: boolean): void {
    target.replaceChildren();
    target.hidden = true;
    if (busy && places.length === 0) return;
    if (layersInRegion(layers, state.region).length === 0) {
      target.append(note(`${regionLabel(state.region)} has no layers yet. Add a sheet to src/config/layers.ts.`));
    } else if (state.layers.size === 0) {
      target.append(note("Pick at least one layer."), chip("Choose layers", { onClick: filterSheet.open }));
    } else if (total === 0) {
      target.append(note("No data loaded for these layers. Check Diagnostics."));
    } else if (shown === 0) {
      target.append(note("Nothing matches these filters."));
      if (hasActiveFilters(state)) {
        target.append(chip("Clear filters", { onClick: () => filters.dispatch({ type: "clearFilters" }) }));
      }
    } else {
      return;
    }
    target.hidden = false;
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
        onDataArrived();
      });
    } finally {
      loading = false;
      diagnostics.update(results, false);
      render();
    }
  }

  /** First data: honour a place id from the URL, else fit the map to the results. */
  function onDataArrived(): void {
    if (pendingSelection) {
      const id = pendingSelection;
      if (places.some((p) => p.id === id)) {
        pendingSelection = undefined;
        // Not marked as pushed: this entry is the page itself, so back must leave the app, not the detail.
        ui.dispatch({ type: "select", id });
        fittedOnce = true;
      }
    }
    if (!fittedOnce && places.length > 0) {
      fittedOnce = true;
      fitToResults();
    }
  }

  function createPinRenderer(): PinRenderer {
    const colors = () => {
      const css = getComputedStyle(document.documentElement);
      return { label: css.getPropertyValue("--fg").trim(), halo: css.getPropertyValue("--bg-raised").trim() };
    };
    return pinRendererKind() === "dom" ? createDomPinRenderer(view) : createSdfPinRenderer(view, colors);
  }

  filters.subscribe((state) => {
    const regionChanged = state.region !== lastRegion;
    lastRegion = state.region;
    rememberRegion(state.region);
    if (ui.get().selectedId !== undefined) deselect();
    history.replaceState(history.state, "", urlFor(state, ui.get().selectedId));
    view.setRegion(regions.find((r) => r.id === state.region)!);
    if (regionChanged) fittedOnce = true; // setRegion fitted the bbox; don't refit to results
    render();
  });
  let lastRegion: RegionId = filters.get().region;

  render();
  void reload();

  function urlFor(state: FilterState, selectedId?: string): string {
    const params = toSearchParams(state, ctx);
    if (selectedId) params.set(SELECTED_PARAM, selectedId);
    const q = params.toString();
    return q ? `${location.pathname}?${q}` : location.pathname;
  }
}

function initialState(params: URLSearchParams, ctx: UrlContext): FilterState {
  if ([...params.keys()].some((k) => k !== SELECTED_PARAM && k !== "pins")) return fromSearchParams(params, ctx);
  return defaultState(rememberedRegion() ?? ctx.defaultRegion, ctx.layers);
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
function renderStatus(target: HTMLElement, results: LoadResult[], loading: boolean): void {
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
  target.textContent = text;
  target.hidden = text === "";
  target.classList.toggle("is-warning", missing.length > 0);
}

function relativeTime(d: Date): string {
  const mins = Math.round((Date.now() - d.getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 60 * 48) return `${Math.round(mins / 60)} h ago`;
  return `${Math.round(mins / 1440)} d ago`;
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

function el(tagName: string, className: string, html = ""): HTMLElement {
  const node = document.createElement(tagName);
  node.className = className;
  node.innerHTML = html;
  return node;
}
