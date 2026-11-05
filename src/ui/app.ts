import { layers } from "../config/layers.ts";
import { pinRendererKind } from "../config/map.ts";
import { regions } from "../config/regions.ts";
import { settings, updateSettings, type Settings } from "../config/settings.ts";
import { createBookmarks, createIdbBookmarkStorage } from "../data/bookmarks.ts";
import { browserDeps } from "../data/browser.ts";
import { loadAllLayersStaged } from "../data/load.ts";
import type { LoadResult, Place, RegionId } from "../data/types.ts";
import { applyFilters, sinkUnknownHours, type HoursInput } from "../filter/apply.ts";
import { sortByDistance } from "../geo/distance.ts";
import { evaluateAll, type HoursState } from "../hours/evaluate-all.ts";
import { loadParser, tokyoNow, tokyoWallClock, type OpeningHoursCtor } from "../hours/open.ts";
import {
  defaultState,
  effectiveLayers,
  hasActiveFilters,
  layersInRegion,
  reduce,
  type FilterAction,
  type FilterState,
} from "../filter/state.ts";
import { createStore } from "../filter/store.ts";
import { fromSearchParams, toSearchParams, type UrlContext } from "../filter/url.ts";
import { createWatch, permissionState, type LocateError, type Position } from "../geo/locate.ts";
import { mountMap, watchFlavor } from "../map/map.ts";
import { placesToPins, type PinRenderer } from "../map/pins.ts";
import { createDomPinRenderer } from "../map/pins-dom.ts";
import { createSdfPinRenderer } from "../map/pins-sdf.ts";
import { chip } from "./chips.ts";
import { renderDetail, renderDetailStrip } from "./detail.ts";
import { mountDiagnostics } from "./diagnostics.ts";
import { renderFilterSheet } from "./filter-sheet.ts";
import { renderFilterSummary } from "./filter-summary.ts";
import { mountHeader } from "./header.ts";
import { renderList, sortByName } from "./list.ts";
import { mountPanel } from "./panel.ts";
import { renderSettingsSheet } from "./settings-sheet.ts";
import { createSheet } from "./sheet.ts";
import { showToast } from "./toast.ts";

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
  const bookmarks = createBookmarks(createIdbBookmarkStorage());

  let places: Place[] = [];
  let results: LoadResult[] = [];
  let loading = true;
  /** The list's scroll position, kept while the card is open so Back returns to it. */
  let listScrollTop = 0;
  let shownMode: "list" | "detail" = "list";
  let shownDetailId: string | undefined;
  /** Set for the one render that returns to the list, so the closed place's row can flash. */
  let flashId: string | undefined;
  /** Where the open card came from: a list row keeps the list's position on return; anything else scrolls to the row. */
  let openedFrom: "list" | "elsewhere" = "list";

  // ---- hours (open now) ----
  const layersWithHours = new Set<string>(layers.filter((l) => l.hasHours).map((l) => l.id));
  let parser: OpeningHoursCtor | undefined;
  let hoursStates: Map<string, HoursState> | undefined;
  let hoursTimer: ReturnType<typeof setInterval> | undefined;

  /** The Tokyo wall-clock moment the filter and the card evaluate at. */
  const hoursAt = (state: FilterState): Date | undefined => tokyoWallClock(state.openAt);
  const hoursInput = (): HoursInput | undefined => (hoursStates ? { states: hoursStates, layersWithHours } : undefined);

  /** Recompute every place's open state; load the parser first if needed; keep a minute timer while the filter is on. */
  function refreshHours(): void {
    const state = filters.get();
    if (!state.openNow) {
      hoursStates = undefined;
      if (hoursTimer) clearInterval(hoursTimer);
      hoursTimer = undefined;
      return;
    }
    if (!parser) {
      void loadParser().then((p) => {
        parser = p;
        refreshHours();
        render();
      });
      return;
    }
    hoursStates = evaluateAll(parser, places, hoursAt(state) ?? tokyoNow());
    hoursTimer ??= setInterval(() => {
      refreshHours();
      render();
    }, 60_000);
  }
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && filters.get().openNow) {
      refreshHours();
      render();
    }
  });
  /** A place id from the URL to select once its data has loaded. */
  let pendingSelection: string | undefined = startParams.get(SELECTED_PARAM) ?? undefined;
  let fittedOnce = false;

  // Layout: header row, the map pane filling the rest, the panel over it, sheets over everything.
  root.innerHTML = `
    <main class="panes">
      <section class="map-pane" aria-label="Map"></section>
      <a class="osm-credit" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a>
    </main>
  `;
  const filterSheet = createSheet(root, "Filters", () => renderSheet());
  const diagSheet = createSheet(root, "Diagnostics");
  const settingsSheet = createSheet(root, "Settings", () =>
    renderSettingsSheet(settingsSheet.body, { onChange: onSettingsChanged, onDiagnostics: () => diagSheet.open() }),
  );
  const diagnostics = mountDiagnostics(diagSheet.body, () => void reload());

  const header = mountHeader(root, regions, {
    onRegion: (region) => filters.dispatch({ type: "setRegion", region }),
    onSearch: (text) => filters.dispatch({ type: "setText", text }),
    onSharedLink: (id) => openPlaceById(id),
    onFilters: filterSheet.open,
    onSettings: settingsSheet.open,
  });

  const panel = mountPanel(root, (_h, px) => view.setBottomPadding(px));
  const view = mountMap(
    root.querySelector<HTMLElement>(".map-pane")!,
    regions.find((r) => r.id === filters.get().region)!,
    watchFlavor((flavor) => view.setFlavor(flavor)),
    { onFit: fitToResults, onLocateRequest: () => watch.start() },
  );
  view.setBottomPadding(panel.heightPx());
  let pins: PinRenderer = createPinRenderer();
  pins.onSelect(onPinSelect);

  function onPinSelect(id: string | undefined): void {
    if (id === undefined) {
      deselect();
    } else {
      openedFrom = "elsewhere";
      select(id);
    }
  }

  /** Pin settings need the renderer rebuilt; location starts or stops the watch; anything else (sort) is a plain re-render. */
  const pinKey = (s: Settings) => `${s.pinRenderer}/${s.pinStyle}/${s.pinLabelMinZoom}`;
  let appliedPins = pinKey(settings());
  let appliedLocation = settings().location;
  function onSettingsChanged(next: Settings): void {
    if (next.location !== appliedLocation) {
      appliedLocation = next.location;
      applyLocationSetting(next.location);
    }
    if (pinKey(next) === appliedPins) {
      render();
      return;
    }
    appliedPins = pinKey(next);
    pins.destroy();
    pins = createPinRenderer();
    pins.onSelect(onPinSelect);
    render();
  }

  // ---- location ----
  /** The device's last fix, while the watch is on. */
  let position: Position | undefined;
  const watch = createWatch(() => navigator.geolocation, { onFix: onPosition, onError: onLocateError });

  /**
   * Location on: show the button, and start watching by ourselves only when
   * the browser already holds a grant, so the app never prompts unasked (the
   * first tap on the button does). Off: stop, drop the fix, hide the button.
   */
  function applyLocationSetting(on: boolean): void {
    view.locate.setVisible(on);
    if (on) {
      void permissionState().then((state) => {
        if (state === "granted" && settings().location) watch.start();
      });
    } else {
      watch.stop();
      dropPosition();
    }
  }
  applyLocationSetting(settings().location);
  /** Fixes arrive every second or so while walking; the list re-sorts at most this often. */
  const POSITION_RENDER_MS = 3000;
  let lastPositionRender = 0;
  let positionTimer: ReturnType<typeof setTimeout> | undefined;
  let firstFixHandled = false;

  function onPosition(next: Position): void {
    const first = position === undefined;
    position = next;
    view.locate.setFix(next);
    if (!firstFixHandled) {
      firstFixHandled = true;
      if (settings().autoDistanceSort && settings().sort !== "distance") updateSettings({ sort: "distance" });
    }
    const due = lastPositionRender + POSITION_RENDER_MS - Date.now();
    if (first || due <= 0) renderForPosition();
    else positionTimer ??= setTimeout(renderForPosition, due);
  }

  function renderForPosition(): void {
    if (positionTimer) clearTimeout(positionTimer);
    positionTimer = undefined;
    lastPositionRender = Date.now();
    render();
  }

  function onLocateError(kind: LocateError): void {
    if (kind === "denied") dropPosition();
    // A failed request leaves the button idle again rather than "waiting" forever.
    if (position === undefined) view.locate.setFix(undefined);
    const text: Record<LocateError, string> = {
      denied: "Location is off for this app. Allow it in the phone's Settings.",
      unavailable: "Couldn't get your location.",
      timeout: "No location fix yet. Try again, ideally outdoors.",
    };
    showToast(text[kind], 3000);
  }

  /** No fix any more: distances go, and a distance-ordered list falls back to names. */
  function dropPosition(): void {
    view.locate.setFix(undefined);
    if (position === undefined) return;
    position = undefined;
    render();
  }

  // The panel's two contents. The strip is always visible; the body shows at half and full.
  const listStrip = el(
    "button",
    "strip-list",
    `<p class="results-count"></p><p class="filter-summary" hidden></p><p class="status" role="status" hidden></p>`,
  );
  (listStrip as HTMLButtonElement).type = "button";
  listStrip.setAttribute("aria-label", "Open filters");
  listStrip.addEventListener("click", filterSheet.open);
  const detailStrip = el("div", "strip-detail");
  const listBody = el("div", "body-list", `<ul class="place-list"></ul><div class="empty-state" hidden></div>`);
  const detailBody = el("div", "body-detail");
  panel.strip.append(listStrip, detailStrip);
  panel.content.append(listBody, detailBody);
  const resultsCount = listStrip.querySelector<HTMLElement>(".results-count")!;
  const filterSummary = listStrip.querySelector<HTMLElement>(".filter-summary")!;
  const status = listStrip.querySelector<HTMLElement>(".status")!;
  const placeList = listBody.querySelector<HTMLUListElement>(".place-list")!;
  const emptyState = listBody.querySelector<HTMLElement>(".empty-state")!;

  // ---- selection: one state for "selected" and "detail open" ----

  /**
   * A place by id from anywhere (pasted link, startup): switch region if it
   * lives elsewhere, drop filters that would hide it, select it, and show the
   * card at half height.
   */
  function openPlaceById(id: string): boolean {
    const place = places.find((p) => p.id === id);
    if (!place) {
      showToast(places.length === 0 ? "Still loading…" : "Place not found");
      return false;
    }
    revealPlace(place);
    openedFrom = "elsewhere";
    select(id);
    panel.setHeight("half");
    return true;
  }

  /** Make sure `place` is in the current results: right region, and no filter or layer selection excluding it. */
  function revealPlace(place: Place): void {
    if (place.region !== filters.get().region) filters.dispatch({ type: "setRegion", region: place.region });
    const visible = applyFilters(places, filters.get(), { bookmarks: bookmarks.all(), hours: hoursInput() }).some((p) => p.id === place.id);
    if (!visible) {
      filters.dispatch({ type: "clearFilters" });
      filters.dispatch({ type: "setLayers", layers: [] });
    }
  }

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
      bookmarks: bookmarks.all(),
      hours: hoursInput(),
      dispatch: filters.dispatch,
      sort: settings().sort,
      hasPosition: position !== undefined,
      onSort: (sort) => {
        updateSettings({ sort });
        render();
      },
    });
  }

  function render(): void {
    const state = filters.get();
    const regionLayers = layersInRegion(layers, state.region);
    if (filterSheet.isOpen()) renderSheet();

    header.update({
      region: regions.find((r) => r.id === state.region)!,
      text: state.text,
      filtersActive: hasActiveFilters(state),
    });

    const layersOn = effectiveLayers(state, regionLayers.map((l) => l.id));
    const total = places.filter((p) => p.region === state.region && layersOn.has(p.layerId)).length;
    const matching = applyFilters(places, state, { bookmarks: bookmarks.all(), hours: hoursInput() });
    const byDistance = settings().sort === "distance" && position !== undefined;
    const sorted = byDistance && position ? sortByDistance(matching, position) : sortByName(matching);
    const shown = state.openNow ? sinkUnknownHours(sorted, hoursInput()) : sorted;
    const selectedId = ui.get().selectedId;
    const selected = selectedId ? shown.find((p) => p.id === selectedId) : undefined;
    // Returning to the list: remember which place was open so its row can fade in from a highlight.
    flashId = shownMode === "detail" && !selected ? shownDetailId : undefined;

    renderFilterSummary(
      resultsCount,
      filterSummary,
      state,
      regionLayers,
      loading && places.length === 0 ? "Loading…" : countLabel(shown.length, total),
      byDistance,
    );
    renderStatus(status, results, loading);
    renderList(placeList, shown, {
      layers: regionLayers,
      showLayer: layersOn.size > 1,
      selectedId,
      bookmarks: bookmarks.all(),
      flashId,
      hoursMarks: state.openNow ? hoursMarks(shown) : undefined,
      from: position,
      onSelect: (id) => {
        openedFrom = "list";
        select(id);
      },
    });
    renderEmptyState(emptyState, state, shown.length, total, loading);

    if (selected) {
      renderDetail(detailBody, selected, regionLayers.find((l) => l.id === selected.layerId), {
        onBack: deselect,
        origin: location.origin,
        onShowOnMap: () => view.focus(selected.lng, selected.lat),
        isBookmarked: (id) => bookmarks.has(id),
        onToggleBookmark: (id) => bookmarks.toggle(id),
        at: hoursAt(state),
        from: position,
      });
      renderDetailStrip(detailStrip, selected);
    }
    // One scroll container holds both contents: save the list's position on the
    // way into the card (before the list is hidden, or the browser clamps it to
    // the card's height), open the card at its top, restore on the way back.
    const mode = selected ? "detail" : "list";
    if (mode !== shownMode && mode === "detail") listScrollTop = panel.content.scrollTop;
    panel.el.dataset["mode"] = mode;
    if (mode !== shownMode) {
      if (mode === "detail") {
        panel.content.scrollTop = 0;
      } else if (openedFrom === "list") {
        panel.content.scrollTop = listScrollTop;
      } else {
        // Opened from a pin or a link: bring the closed place's row into view so the highlight is seen.
        const row = flashId ? placeList.querySelector<HTMLElement>(`.place-row[data-id="${CSS.escape(flashId)}"]`) : null;
        const content = panel.content;
        content.scrollTop = row ? Math.max(0, row.offsetTop - (content.clientHeight - row.offsetHeight) / 2) : listScrollTop;
      }
      shownMode = mode;
    } else if (mode === "detail" && selected && selected.id !== shownDetailId) {
      panel.content.scrollTop = 0; // switched to another place while open
    }
    shownDetailId = selected?.id;

    pins.update(placesToPins(shown, regionLayers, bookmarks.all()));
    pins.setSelected(selectedId);
    panel.relayout(); // the strip's height depends on what the summary shows
  }

  /** Why a row is in an open-now list when it isn't simply "open". */
  function hoursMarks(shown: Place[]): Map<string, string> {
    const marks = new Map<string, string>();
    for (const p of shown) {
      if (!layersWithHours.has(p.layerId)) marks.set(p.id, "no hours");
      else if ((hoursStates?.get(p.id) ?? "unknown") === "unknown") marks.set(p.id, "hours unknown");
    }
    return marks;
  }

  function fitToResults(): void {
    const shown = applyFilters(places, filters.get(), { bookmarks: bookmarks.all(), hours: hoursInput() });
    view.fitPoints(shown.map((p) => [p.lng, p.lat]));
  }

  function renderEmptyState(target: HTMLElement, state: FilterState, shown: number, total: number, busy: boolean): void {
    target.replaceChildren();
    target.hidden = true;
    if (busy && places.length === 0) return;
    if (layersInRegion(layers, state.region).length === 0) {
      target.append(note(`${regionLabel(state.region)} has no layers yet. Add a sheet to src/config/layers.ts.`));
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
        refreshHours();
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
      const place = places.find((p) => p.id === id);
      if (place) {
        pendingSelection = undefined;
        revealPlace(place);
        openedFrom = "elsewhere";
        // Not marked as pushed: this entry is the page itself, so back must leave the app, not the detail.
        ui.dispatch({ type: "select", id });
        history.replaceState(history.state, "", urlFor(filters.get(), id));
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
    refreshHours();
    render();
  });
  let lastRegion: RegionId = filters.get().region;

  bookmarks.subscribe(render);
  refreshHours(); // a URL with open=1 starts the parser load straight away

  // Debug handle beside the map's: inspect panel scroll bookkeeping from the console.
  const dbg = (window as unknown as { __japlanning?: Record<string, unknown> }).__japlanning ?? {};
  dbg["panel"] = { get listScrollTop() { return listScrollTop; }, get shownMode() { return shownMode; }, content: panel.content };
  dbg["location"] = { get position() { return position; }, watch, get state() { return view.locate.state; } };
  (window as unknown as { __japlanning: Record<string, unknown> }).__japlanning = dbg;

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

/** Just the matching count; the total stops meaning much once every layer has pins. */
function countLabel(shown: number, total: number): string {
  if (total === 0) return "";
  return `${shown} place${shown === 1 ? "" : "s"}`;
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
