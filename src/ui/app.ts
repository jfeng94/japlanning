import { regionColours, type RegionColours } from "../config/area-colors.ts";
import { layers } from "../config/layers.ts";
import { pinRendererKind } from "../config/map.ts";
import { areasOf, regions } from "../config/regions.ts";
import { settings, updateSettings, type Settings } from "../config/settings.ts";
import { createBookmarks, createIdbBookmarkStorage } from "../data/bookmarks.ts";
import { loadAreaShapes, nearestChip, shapesBounds, type AreaShapes } from "../data/area-shapes.ts";
import { areaAt } from "../data/areas.ts";
import { browserDeps } from "../data/browser.ts";
import { loadAllLayersStaged } from "../data/load.ts";
import type { LoadResult, Place, RegionId } from "../data/types.ts";
import { applyFilters, areaLook, areaScope, areaScopeKey, sinkUnknownHours, tapArea, type ApplyOptions, type AreaLook, type HoursInput } from "../filter/apply.ts";
import { inBbox, sortByDistance } from "../geo/distance.ts";
import { formatRadius } from "../geo/nearby.ts";
import { markFor, type Mark } from "../data/marks.ts";
import { evaluateAll, type HoursState } from "../hours/evaluate-all.ts";
import { loadParser, tokyoNow, tokyoWallClock, type OpeningHoursCtor } from "../hours/open.ts";
import { defaultState, hasActiveFilters, hasGroupSelection, layersInPlay, layersInRegion, reduce, type FilterState } from "../filter/state.ts";
import { createStore } from "../filter/store.ts";
import { fromSearchParams, toSearchParams, type UrlContext } from "../filter/url.ts";
import { createWatch, permissionState, type LocateError, type Position } from "../geo/locate.ts";
import { basemapUrl, ensureProtocol, mountMap, watchFlavor } from "../map/map.ts";
import { createAreaLayers, type AreaDrawing } from "../map/area-layers.ts";
import { createNearbyCircle } from "../map/nearby-circle.ts";
import { createIdbBasemapStore, registerStoredBasemaps, unregisterStoredBasemap } from "../offline/basemap.ts";
import { createDownloadManager } from "../offline/downloads.ts";
import { appUsage, formatMb } from "../offline/usage.ts";
import { placesToPins, type PinRenderer } from "../map/pins.ts";
import { createDomPinRenderer } from "../map/pins-dom.ts";
import { createRasterPinRenderer } from "../map/pins-raster.ts";
import { mountFpsMeter } from "./fps-meter.ts";
import { chip } from "./chips.ts";
import { renderDetail, renderDetailStrip } from "./detail.ts";
import { mountDiagnostics } from "./diagnostics.ts";
import { renderAreaPage, renderFiltersPage, renderPageStrip, type FilterPage, type PageContext, type PositionChip } from "./filter-pages.ts";
import { renderFilterSummary } from "./filter-summary.ts";
import { CHEVRON_LEFT, mountHeader, SEARCH_ICON } from "./header.ts";
import areaIcon from "./icons/area.webp";
import filtersIcon from "./icons/filters.webp";
import nextIcon from "./icons/next.webp";
import prevIcon from "./icons/prev.webp";
import { renderList, sortByName } from "./list.ts";
import { renderOfflineSection } from "./offline-section.ts";
import { mountPanel, type PanelHeight } from "./panel.ts";
import { renderSettingsSheet } from "./settings-sheet.ts";
import { createSheet } from "./sheet.ts";
import { showToast } from "./toast.ts";

const REGION_KEY = "japlanning.region";
const SELECTED_PARAM = "s";
/** How far outside an area a tap on the Area page's map still counts as on it, in screen pixels. */
const AREA_TAP_SLOP_PX = 12;

interface UiState {
  selectedId?: string;
  /** A filter page in the strip. It hides the card, which comes back when the page closes. */
  page?: FilterPage;
}
type UiAction =
  /** Show a card; any page closes. */
  | { type: "select"; id: string }
  | { type: "deselect" }
  | { type: "openPage"; page: FilterPage }
  /** The page closes and the card under it, if any, shows again. */
  | { type: "closePage" }
  /** No page, no card: the list. */
  | { type: "reset" };

function uiReduce(state: UiState, action: UiAction): UiState {
  switch (action.type) {
    case "select":
      return state.selectedId === action.id && state.page === undefined ? state : { selectedId: action.id };
    case "deselect":
      if (state.selectedId === undefined) return state;
      return state.page === undefined ? {} : { page: state.page };
    case "openPage":
      return state.page === action.page ? state : { ...state, page: action.page };
    case "closePage":
      if (state.page === undefined) return state;
      return state.selectedId === undefined ? {} : { selectedId: state.selectedId };
    case "reset":
      return state.selectedId === undefined && state.page === undefined ? state : {};
  }
}

/** Our history entries: a card (s) and/or a filter page (p) over the list, always one entry, so Back means "to the list". */
type HistoryState = { s?: string; p?: FilterPage } | null;

/** What the rest of the page (the service worker's registration) can ask of the app. */
export interface AppHandle {
  /** A new build is waiting: offer it as the header's update button. */
  offerUpdate(apply: () => void): void;
}

export function mountApp(root: HTMLElement): AppHandle {
  const ctx: UrlContext = { regions, layers, defaultRegion: regions[0]!.id };
  const startParams = new URLSearchParams(location.search);
  const filters = createStore(initialState(startParams, ctx), reduce);
  const ui = createStore<UiState, UiAction>({}, uiReduce);
  const bookmarks = createBookmarks(createIdbBookmarkStorage());

  let places: Place[] = [];
  let results: LoadResult[] = [];
  let loading = true;
  /** The list's scroll position, kept while the card is open so Back returns to it. */
  let listScrollTop = 0;
  let shownMode: "list" | "detail" | "page" = "list";
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

  /**
   * Recompute every place's open state (the filter, the card and the
   * closed/unknown marks all read it); load the parser first if needed;
   * keep a minute timer so the marks stay current. Always on, not only
   * while the filter is: the closed mark only has a job when the filter
   * is off.
   */
  function refreshHours(): void {
    const state = filters.get();
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
    if (document.visibilityState === "visible") {
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
  const diagSheet = createSheet(root, "Diagnostics", () => diagnostics.refreshCapabilities());
  const settingsSheet = createSheet(root, "Settings", () =>
    renderSettingsSheet(settingsSheet.body, {
      onChange: onSettingsChanged,
      onDiagnostics: () => diagSheet.open(),
      renderOffline: (container) =>
        renderOfflineSection(container, {
          regions,
          basemaps,
          downloads,
          urlFor: basemapUrl,
          // Removed: drop the Blob-backed PMTiles, so the region's next tiles come from the maps site.
          onRemoved: (region) => unregisterStoredBasemap(ensureProtocol(), basemapUrl(region)),
          dataSynced: () => {
            if (results.length === 0) return undefined;
            const at = results.map((r) => r.fetchedAt).filter((d): d is Date => d !== undefined).sort((a, b) => b.getTime() - a.getTime())[0];
            return { places: places.length, ...(at ? { at } : {}) };
          },
          buildSha: __BUILD_SHA__,
        }),
    }),
  );
  const diagnostics = mountDiagnostics(diagSheet.body, () => void reload(), async () => {
    const u = await appUsage(basemaps, regions);
    return [{ label: "Stored by this app", value: `${formatMb(u.maps + u.shell)}: maps ${formatMb(u.maps)}${u.regions.length ? ` (${u.regions.join(", ")})` : ""}, app ${formatMb(u.shell)}`, ok: null }];
  });

  const header = mountHeader(root, regions, {
    onRegion: (region) => filters.dispatch({ type: "setRegion", region }),
    onSearch: (text) => filters.dispatch({ type: "setText", text }),
    onSearchOpen: () => {
      // Searching is a list activity: close an open card and give the list the screen. The card
      // closes through history (async) and then restores the list's height, so make that height full.
      if (ui.get().selectedId !== undefined) {
        listHeight = "full";
        deselect();
      }
      panel.setHeight("full");
    },
    // The keyboard closed with a query in the field: show the map with the results still filtered.
    onSearchBlur: () => {
      if (panel.getHeight() === "full") panel.setHeight("half");
    },
    onSharedLink: (id) => openPlaceById(id),
    onSettings: settingsSheet.open,
  });

  /** Offline basemaps (M7): downloaded whole, kept as Blobs in IndexedDB. */
  const basemaps = createIdbBasemapStore();
  const downloads = createDownloadManager(
    basemaps,
    basemapUrl,
    // Stored: point the protocol at the Blob; the next tiles read it.
    (region) => void registerStoredBasemaps(ensureProtocol(), basemaps, [region], basemapUrl),
    (region, message) => showToast(`${region.label} map download failed: ${message}`, 3000),
  );
  /** Online launch: fetch any region's map that is missing or outdated, current region first, one at a time. */
  async function autoDownloadMaps(): Promise<void> {
    if (!settings().autoDownloadMaps || !navigator.onLine) return;
    const current = filters.get().region;
    const ordered = [...regions].sort((a, b) => Number(b.id === current) - Number(a.id === current));
    for (const region of ordered) {
      if (!region.bbox) continue;
      const status = await basemaps.status(region);
      if (status.kind !== "ready") void downloads.start(region);
    }
  }
  const panel = mountPanel(root, (_h, px) => view.setBottomPadding(px));
  const view = mountMap(
    root.querySelector<HTMLElement>(".map-pane")!,
    regions.find((r) => r.id === filters.get().region)!,
    watchFlavor((flavor) => view.setFlavor(flavor)),
    {
      onFit: onFitButton,
      onLocateRequest: () => watch.start(),
      // Stored archives first, so an offline launch never asks the network for tiles it has.
      prepareBasemaps: (protocol) => registerStoredBasemaps(protocol, basemaps, regions, basemapUrl).then(() => undefined),
    },
  );
  view.setBottomPadding(panel.heightPx());
  if (startParams.get("fps") === "1") mountFpsMeter(view.map);
  const nearbyCircle = createNearbyCircle(view);
  const areaLayers = createAreaLayers(view);
  let pins: PinRenderer = createPinRenderer();
  pins.onSelect(onPinSelect);
  // A tap on the Area page's map picks or drops the area under it, as its chip does; the pins there are inert.
  view.map.on("click", (e) => {
    if (ui.get().page !== "area") return;
    const regionShapes = shapes.get(filters.get().region);
    if (!regionShapes) return;
    const at = { lat: e.lngLat.lat, lng: e.lngLat.lng };
    const chip = nearestChip(regionShapes, at, AREA_TAP_SLOP_PX * metresPerPixel(view.map.getZoom(), at.lat));
    if (chip) onAreaTap(chip);
  });

  function onPinSelect(id: string | undefined): void {
    if (id === undefined) {
      if (ui.get().page === undefined) deselect();
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
      // Here and Nearby have nothing to go on without the position; their chips are hidden too.
      if (filters.get().here) filters.dispatch({ type: "setHere", value: false });
      if (filters.get().nearby !== undefined) filters.dispatch({ type: "setNearby", value: undefined });
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
    if (kind === "denied") {
      // The phone refused, not the app's own setting. The fix is a path in iOS Settings, too long
      // for a toast, so the tap opens Diagnostics, which names it and can test it.
      showToast("The phone is blocking location for this app. Tap for the fix.", 8000, { onClick: () => diagSheet.open() });
    } else {
      showToast(kind === "unavailable" ? "Couldn't get your location." : "No location fix yet. Try again, ideally outdoors.", 3000);
    }
    render(); // Here's label and the order toggle read the watch's state
  }

  // ---- area shapes: Here goes by them; the Area page draws them (Settings can draw them on the normal map too) ----
  const shapes = new Map<RegionId, AreaShapes>();
  const shapesRequested = new Set<RegionId>();
  /** Fetch a region's shapes once, the first time it renders; Here uses nearest centres until they arrive. */
  function ensureShapes(region: RegionId): void {
    if (shapesRequested.has(region) || areasOf(region).chips.length === 0) return;
    shapesRequested.add(region);
    void loadAreaShapes(region).then((s) => {
      if (!s) return;
      shapes.set(region, s);
      render();
    });
  }

  const colours = new Map<RegionId, RegionColours>();
  /** A region's area colours (src/config/area-colors.ts), worked out once. */
  function coloursOf(region: RegionId): RegionColours {
    let c = colours.get(region);
    if (!c) {
      c = regionColours(areasOf(region));
      colours.set(region, c);
    }
    return c;
  }

  /** An area chip, or its shape on the map, tapped: tapArea's outcome for the current state. */
  function onAreaTap(chip: string): void {
    const now = filters.get();
    filters.dispatch(tapArea(now, chip, applyOpts(now)));
  }

  /** The last drawing handed to the map, reused while nothing in it changes, so renders don't re-send the shapes. */
  let lastDrawing: { key: string; drawing: AreaDrawing } | undefined;
  function areaDrawing(state: FilterState, here: PositionChip, regionShapes: AreaShapes, selectedOnly: boolean): AreaDrawing {
    const areas = areasOf(state.region);
    const opts = { hereGroup: here.group, areas };
    const looks = new Map<string, AreaLook>(areas.chips.map((c) => [c.label, areaLook(state, c.label, opts)]));
    const key = `${state.region}|${selectedOnly}|${[...looks].filter(([, l]) => l !== "out").join(",")}`;
    if (lastDrawing?.key === key && lastDrawing.drawing.shapes === regionShapes) return lastDrawing.drawing;
    const drawing = { shapes: regionShapes, looks, colours: coloursOf(state.region).chips, selectedOnly };
    lastDrawing = { key, drawing };
    return drawing;
  }

  // ---- the Area page's map (docs/proposals/filter-pages-and-area-map.md, Part 3) ----
  /** Whether the map is in the Area page's mode. It follows the page however the page opened or closed. */
  let areaMapOn = false;
  /** What the area filter kept as the page opened (areaScopeKey), to tell on leaving whether it changed. */
  let scopeAtOpen = "";
  function syncAreaMap(on: boolean, state: FilterState, here: PositionChip): void {
    if (on === areaMapOn) return;
    areaMapOn = on;
    const scopeOpts = { hereGroup: here.group, areas: areasOf(state.region) };
    if (on) {
      scopeAtOpen = areaScopeKey(state, scopeOpts);
      view.setAreaMode(areaBounds(state.region));
      return;
    }
    // Leaving: back where the camera was if the areas in play are the same; else frame what the filter keeps now.
    // (A new region closes the page too; its key differs, and setRegion's fit replaces this move.)
    const changed = areaScopeKey(state, scopeOpts) !== scopeAtOpen;
    view.setAreaMode(undefined, changed ? keptBounds(state, here) : undefined);
  }

  /** The whole city as far as our places go: the area shapes, or before they load the places, or the basemap's box. */
  function areaBounds(region: RegionId): [number, number, number, number] | undefined {
    const regionShapes = shapes.get(region);
    const fromShapes = regionShapes ? shapesBounds(regionShapes) : undefined;
    if (fromShapes) return fromShapes;
    return placesBounds(places.filter((p) => p.region === region)) ?? regions.find((r) => r.id === region)?.bbox;
  }

  /** The areas in play (picked and added), or with none the results; undefined when there is nothing to frame. */
  function keptBounds(state: FilterState, here: PositionChip): [number, number, number, number] | undefined {
    const scope = areaScope(state, { hereGroup: here.group, areas: areasOf(state.region) });
    const regionShapes = shapes.get(state.region);
    const fromShapes = scope && regionShapes ? shapesBounds(regionShapes, new Set([...scope.chosen, ...scope.added])) : undefined;
    return fromShapes ?? placesBounds(applyFilters(places, state, applyOpts(state, here)));
  }

  function placesBounds(ps: Place[]): [number, number, number, number] | undefined {
    if (ps.length === 0) return undefined;
    const lngs = ps.map((p) => p.lng);
    const lats = ps.map((p) => p.lat);
    return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)];
  }

  /** The Area page's pins: bookmarks, and layers kept for reference (lodging), whatever the filters say. */
  function areaMapPlaces(state: FilterState): Place[] {
    const keep = new Set(layersInRegion(layers, state.region).filter((l) => l.onAreaMap).map((l) => l.id));
    const marked = bookmarks.all();
    return sortByName(places.filter((p) => p.region === state.region && (marked.has(p.id) || keep.has(p.layerId))));
  }

  // ---- Here ----
  /** Here as the sheet and the tags label it, and the area chip it stands for when it resolves to one. */
  function hereChip(state: FilterState): PositionChip {
    if (!position) {
      if (!state.here) return { label: "Here" };
      return { label: watch.active ? "Here · locating…" : "Here · no location" };
    }
    const region = regions.find((r) => r.id === state.region)!;
    const regionPlaces = places.filter((p) => p.region === region.id);
    const group = areaAt(areasOf(region.id), regionPlaces, position, { ...(region.bbox ? { bbox: region.bbox } : {}), shapes: shapes.get(region.id) });
    if (group) return { label: `Here · ${group}`, group };
    return { label: region.bbox && !inBbox(position, region.bbox) ? `Here · outside ${region.label}` : "Here · no area nearby" };
  }

  /** The Here chip: turning it on with no fix starts locating (the permission prompt, if any, comes here). */
  function onHere(on: boolean): void {
    if (on && position === undefined) watch.start();
    filters.dispatch({ type: "setHere", value: on });
  }

  // ---- Nearby: places within a radius of you ----
  function nearbyChip(state: FilterState): PositionChip {
    if (state.nearby === undefined) return { label: "Nearby" };
    if (!position) return { label: watch.active ? "Nearby · locating…" : "Nearby · no location" };
    return { label: `Nearby · ${formatRadius(state.nearby)}` };
  }

  /** The Nearby chip: on at the radius last used on this device; with no fix it starts locating. */
  function onNearby(on: boolean): void {
    if (on && position === undefined) watch.start();
    filters.dispatch({ type: "setNearby", value: on ? settings().nearbyM : undefined });
  }

  /** The radius while the slider is dragged: the circle follows it before the filter does. */
  let previewRadius: number | undefined;
  function onRadius(m: number, final: boolean): void {
    if (!final) {
      previewRadius = m;
      nearbyCircle.set(position, m);
      return;
    }
    previewRadius = undefined;
    updateSettings({ nearbyM: m });
    filters.dispatch({ type: "setNearby", value: m });
  }

  /** Everything applyFilters needs beyond the state. */
  function applyOpts(state: FilterState, here: PositionChip = hereChip(state)): ApplyOptions {
    return {
      bookmarks: bookmarks.all(),
      hours: hoursInput(),
      areas: areasOf(state.region),
      ...(state.here && here.group !== undefined ? { hereGroup: here.group } : {}),
      ...(position ? { position } : {}),
    };
  }

  // ---- list order (the footer toggle) ----
  /** The order the list is in: Nearest needs a fix; while one is on the way it reads "Nearest…" and stays A–Z. */
  function orderShown(): "name" | "distance" | "waiting" {
    if (settings().sort !== "distance") return "name";
    if (position) return "distance";
    return settings().location && watch.active ? "waiting" : "name";
  }

  /** A–Z ⇄ Nearest. Writes the sort setting, so the choice persists across launches. */
  function toggleOrder(): void {
    if (orderShown() !== "name") {
      updateSettings({ sort: "name" });
    } else if (!settings().location) {
      showToast("Turn on Location in Settings to sort by distance.", 3000);
      return;
    } else {
      updateSettings({ sort: "distance" });
      if (position === undefined) watch.start();
    }
    render();
  }

  /** No fix any more: distances go, and a distance-ordered list falls back to names. */
  function dropPosition(): void {
    view.locate.setFix(undefined);
    if (position === undefined) return;
    position = undefined;
    render();
  }

  // The panel's two contents. The header (strip) travels with the panel: the
  // results summary in list mode, the place's name and actions in card mode.
  // Both carry the panel's open/collapse chevron in their upper right, as a page carries its X.
  const listStrip = el(
    "div",
    "strip-list",
    `<div class="strip-list-main"><p class="results-count"></p><p class="filter-summary" hidden></p><p class="status" role="status" hidden></p></div>`,
  );
  listStrip.append(panel.toggleButton());
  const detailToggle = panel.toggleButton();
  const detailStrip = el("div", "strip-detail");
  const pageStrip = el("div", "strip-page");
  // The footer is pinned to the bottom of the screen at every height:
  // Filters, Area and Search on the right always; on the left the list
  // order toggle in list mode, Back in card mode; Prev/Next in the middle
  // while a card is open; nothing else while a page is open
  // (docs/proposals/strip-footer.md, filter-pages-and-area-map.md).
  panel.footer.innerHTML = `
    <div class="footer-left">
      <button type="button" class="icon-button back-button" aria-label="Back to the list">${CHEVRON_LEFT}</button>
      <button type="button" class="order-toggle"></button>
    </div>
    <div class="footer-middle">
      <button type="button" class="arrow-button prev-button" aria-label="Previous place"><img alt="" draggable="false" src="${prevIcon}"></button>
      <button type="button" class="arrow-button next-button" aria-label="Next place"><img alt="" draggable="false" src="${nextIcon}"></button>
    </div>
    <div class="footer-right">
      <button type="button" class="icon-button filters-button" aria-label="Filters" aria-pressed="false"><img alt="" draggable="false" src="${filtersIcon}"><span class="dot" hidden></span></button>
      <button type="button" class="icon-button area-button" aria-label="Area" aria-pressed="false"><img alt="" draggable="false" src="${areaIcon}"><span class="dot" hidden></span></button>
      <button type="button" class="icon-button search-toggle" aria-label="Search">${SEARCH_ICON}<span class="dot" hidden></span></button>
    </div>`;
  const searchToggle = panel.footer.querySelector<HTMLButtonElement>(".search-toggle")!;
  const filtersButton = panel.footer.querySelector<HTMLButtonElement>(".filters-button")!;
  const areaButton = panel.footer.querySelector<HTMLButtonElement>(".area-button")!;
  const backButton = panel.footer.querySelector<HTMLButtonElement>(".back-button")!;
  const prevButton = panel.footer.querySelector<HTMLButtonElement>(".prev-button")!;
  const nextButton = panel.footer.querySelector<HTMLButtonElement>(".next-button")!;
  const orderToggle = panel.footer.querySelector<HTMLButtonElement>(".order-toggle")!;
  orderToggle.addEventListener("click", toggleOrder);
  searchToggle.addEventListener("click", () => {
    // Search is a list activity: a page gives way first, synchronously, so iOS still raises the keyboard.
    leaveToList();
    header.openSearch();
  });
  filtersButton.addEventListener("click", () => togglePage("filters"));
  areaButton.addEventListener("click", () => togglePage("area"));
  backButton.addEventListener("click", () => deselect());
  prevButton.addEventListener("click", () => step(-1));
  nextButton.addEventListener("click", () => step(1));
  const listBody = el("div", "body-list", `<ul class="place-list"></ul><div class="empty-state" hidden></div>`);
  const detailBody = el("div", "body-detail");
  const pageBody = el("div", "body-page");
  panel.strip.append(listStrip, detailStrip, pageStrip);
  panel.content.append(listBody, detailBody, pageBody);
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
    const state = filters.get();
    const visible = applyFilters(places, state, applyOpts(state)).some((p) => p.id === place.id);
    if (!visible) filters.dispatch({ type: "clearFilters" });
  }

  /** The list as last rendered, in order, for Prev/Next. */
  let lastShown: Place[] = [];
  /** The panel height the list had when a card opened, restored on Back. */
  let listHeight: PanelHeight | undefined;

  /** Prev/Next in the footer: the neighbour in the current list; the entry is replaced, so Back still means "to the list". */
  function step(delta: 1 | -1): void {
    const current = ui.get().selectedId;
    const i = lastShown.findIndex((p) => p.id === current);
    const target = i >= 0 ? lastShown[i + delta] : undefined;
    if (target) select(target.id);
  }

  /**
   * Opening the detail pushes one history entry; switching place while
   * open replaces it, so back always means "to the list". From a filter
   * page (a pin tapped under it), the page gives way to the card and its
   * entry becomes the card's.
   */
  function select(id: string): void {
    const { selectedId: current, page } = ui.get();
    if (page !== undefined && current === id) return closePage(); // the hidden card's own pin: it comes back
    if (page === undefined && current === id) return;
    if (page !== undefined) {
      listHeight ??= beforePage?.height; // Back from this card returns the list to the height it had
      endPage();
    }
    const st = history.state as HistoryState;
    const ours = st?.p !== undefined || (current !== undefined && st?.[SELECTED_PARAM] === current);
    ui.dispatch({ type: "select", id });
    const next = { [SELECTED_PARAM]: id };
    if (ours) history.replaceState(next, "", urlFor(filters.get(), id));
    else history.pushState(next, "", urlFor(filters.get(), id));
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
    const st = history.state as HistoryState;
    const id = st?.[SELECTED_PARAM];
    if (ui.get().page !== undefined && st?.p === undefined) {
      // Back while a page is open (Android, a browser): to the list, as Back from a card does.
      const height = ui.get().selectedId === undefined ? beforePage?.height : undefined;
      endPage();
      ui.dispatch({ type: "reset" });
      if (height) panel.setHeight(height);
    }
    if (id && places.some((p) => p.id === id)) {
      ui.dispatch({ type: "select", id });
    } else {
      ui.dispatch({ type: "deselect" });
      // The entry we returned to may still carry s= in its URL (a link opened directly).
      history.replaceState(history.state, "", urlFor(filters.get()));
    }
  });

  /** The card the panel was last arranged for. A page hides a card without closing it, so it doesn't count. */
  let arrangedFor: string | undefined;
  ui.subscribe(({ selectedId, page }) => {
    if (page === undefined && selectedId !== arrangedFor) {
      const place = selectedId ? places.find((p) => p.id === selectedId) : undefined;
      if (place) {
        // A card opens at half so the place is visible on the map behind it; remember the list's height for Back.
        // Height first: it changes the map padding, which would cancel an ease already under way.
        if (listHeight === undefined) listHeight = panel.getHeight();
        panel.setHeight("half");
        view.focus(place.lng, place.lat);
      } else if (listHeight !== undefined) {
        // Back to the list at the height it had (a map-browsing "strip" becomes half so the list shows).
        panel.setHeight(listHeight === "strip" ? "half" : listHeight);
        listHeight = undefined;
      }
      arrangedFor = selectedId;
    }
    render();
  });

  // ---- filter pages (docs/proposals/filter-pages-and-area-map.md) ----

  /** The height the panel had when a page opened, restored when it closes. */
  let beforePage: { height: PanelHeight } | undefined;

  /** A footer button: open its page, switch to it from the other page, or close it if it's the one open. */
  function togglePage(target: FilterPage): void {
    const { page } = ui.get();
    if (page === target) return closePage();
    if (page === undefined) return openPage(target);
    history.replaceState({ ...(history.state as HistoryState), p: target }, "", location.href);
    ui.dispatch({ type: "openPage", page: target });
    // The Filters page can be dragged to Full; the Area page keeps the map in view at Half.
    if (target === "area") panel.setHeight("half");
    panel.lockHeight(target === "area");
  }

  /** A page opens at Half over the list or the card, sharing the card's one history entry. */
  function openPage(target: FilterPage): void {
    beforePage = { height: panel.getHeight() };
    const st = history.state as HistoryState;
    const ours = st?.[SELECTED_PARAM] !== undefined && st[SELECTED_PARAM] === ui.get().selectedId;
    if (ours) history.replaceState({ ...st, p: target }, "", location.href);
    else history.pushState({ p: target }, "", location.href);
    ui.dispatch({ type: "openPage", page: target });
    panel.setHeight("half");
    // The Area page keeps the map in view; Full would cover it.
    panel.lockHeight(target === "area");
  }

  /** Close the open page: back to the card it hid if that place still matches, else to the list. */
  function closePage(): void {
    const { page, selectedId } = ui.get();
    if (page === undefined) return;
    if (selectedId === undefined || !lastShown.some((p) => p.id === selectedId)) return leaveToList();
    const height = beforePage?.height;
    endPage();
    ui.dispatch({ type: "closePage" });
    history.replaceState({ [SELECTED_PARAM]: selectedId }, "", urlFor(filters.get(), selectedId));
    if (height) panel.setHeight(height);
  }

  /** Close the open page and any card it hid, back to the list at the height it had. */
  function leaveToList(): void {
    const { page, selectedId } = ui.get();
    if (page === undefined) return;
    // A hidden card remembered the list's height when it opened, and restores it as it closes (ui.subscribe).
    const height = selectedId === undefined ? beforePage?.height : undefined;
    endPage();
    ui.dispatch({ type: "reset" });
    if (height) panel.setHeight(height);
    if ((history.state as HistoryState)?.p !== undefined) history.back(); // the popstate finds the list already showing
    else history.replaceState(null, "", urlFor(filters.get()));
  }

  /** The page's own bookkeeping, before the UI moves on. */
  function endPage(): void {
    panel.lockHeight(false);
    beforePage = undefined;
  }

  // ---- rendering ----

  function renderPage(page: FilterPage, state: FilterState, here: PositionChip): void {
    const ctx: PageContext = {
      layers: layersInRegion(layers, state.region),
      areas: areasOf(state.region),
      ...(settings().location ? { here, nearby: nearbyChip(state) } : {}),
      colours: coloursOf(state.region),
      onHere,
      onNearby,
      onRadius,
      onAreaTap,
      canClear: hasGroupSelection(state, page),
      onClear: () => filters.dispatch({ type: "clearGroup", group: page }),
      dispatch: filters.dispatch,
    };
    if (page === "filters") renderFiltersPage(pageBody, state, ctx);
    else renderAreaPage(pageBody, state, ctx);
  }

  function render(): void {
    const state = filters.get();
    const { page, selectedId } = ui.get();
    const regionLayers = layersInRegion(layers, state.region);
    const here = hereChip(state);

    header.update({
      region: regions.find((r) => r.id === state.region)!,
      text: state.text,
    });
    searchToggle.querySelector<HTMLElement>(".dot")!.hidden = state.text === "";
    // Each page's button: a dot when it has a selection, pressed while it's open.
    for (const [button, group] of [
      [filtersButton, "filters"],
      [areaButton, "area"],
    ] as const) {
      button.querySelector<HTMLElement>(".dot")!.hidden = !hasGroupSelection(state, group);
      button.setAttribute("aria-pressed", String(page === group));
    }
    // A region without areas (Hakone today) has no Area page; no special case.
    areaButton.hidden = areasOf(state.region).chips.length === 0;
    // The Area page drives the map: the whole city, quiet, with every area in its chip's colour.
    // Elsewhere the map shows only the areas in play, lightly. Nearby's circle belongs to the Filters page.
    const areaMap = page === "area";
    nearbyCircle.set(!areaMap && state.nearby !== undefined ? position : undefined, previewRadius ?? state.nearby);
    ensureShapes(state.region);
    const regionShapes = shapes.get(state.region);
    areaLayers.set(regionShapes ? areaDrawing(state, here, regionShapes, !areaMap) : undefined);
    syncAreaMap(areaMap, state, here);

    const total = places.filter((p) => p.region === state.region).length;
    const matching = applyFilters(places, state, applyOpts(state, here));
    const order = orderShown();
    orderToggle.textContent = order === "distance" ? "Nearest" : order === "waiting" ? "Nearest…" : "A–Z";
    orderToggle.setAttribute("aria-label", `List order: ${order === "name" ? "A to Z" : "nearest first"}. Tap to switch.`);
    const sorted = order === "distance" && position ? sortByDistance(matching, position) : sortByName(matching);
    const shown = state.openNow ? sinkUnknownHours(sorted, hoursInput()) : sorted;
    const selected = selectedId ? shown.find((p) => p.id === selectedId) : undefined;
    const count = loading && places.length === 0 ? "Loading…" : countLabel(shown.length, total);
    // Returning to the list: remember which place was open so its row can fade in from a highlight.
    flashId = shownMode === "detail" && !selected ? shownDetailId : undefined;

    renderFilterSummary(
      resultsCount,
      filterSummary,
      state,
      regionLayers,
      count,
      here.label,
    );
    if (page !== undefined) {
      renderPageStrip(pageStrip, page, count, () => closePage());
      renderPage(page, state, here);
    }
    renderStatus(status, results, loading);
    renderList(placeList, shown, {
      layers: regionLayers,
      showLayer: layersInPlay(state, regionLayers).length > 1,
      selectedId,
      marks: marksFor(shown),
      flashId,
      hoursMarks: state.openNow ? hoursMarks(shown) : undefined,
      from: position,
      onSelect: (id) => {
        openedFrom = "list";
        select(id);
      },
    });
    renderEmptyState(emptyState, state, shown.length, total, loading);

    lastShown = shown;
    if (selected) {
      renderDetail(detailBody, selected, regionLayers.find((l) => l.id === selected.layerId), {
        origin: location.origin,
        at: hoursAt(state),
        from: position,
        onShowOnMap: () => view.focus(selected.lng, selected.lat),
      });
      renderDetailStrip(detailStrip, selected, {
        isBookmarked: (id) => bookmarks.has(id),
        onToggleBookmark: (id) => bookmarks.toggle(id),
        toggle: detailToggle,
      });
      const i = shown.findIndex((p) => p.id === selected.id);
      prevButton.disabled = i <= 0;
      nextButton.disabled = i < 0 || i >= shown.length - 1;
    }
    // One scroll container holds all three contents: save the list's position
    // on the way out of it (before the list is hidden, or the browser clamps it
    // to the next content's height), open a card or a page at its top, restore
    // the list's position on the way back.
    const mode = page !== undefined ? "page" : selected ? "detail" : "list";
    if (mode !== shownMode && shownMode === "list") listScrollTop = panel.content.scrollTop;
    panel.el.dataset["mode"] = mode;
    if (mode !== shownMode) {
      if (mode !== "list") {
        panel.content.scrollTop = 0;
      } else if (shownMode === "page" || openedFrom === "list") {
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

    // On the Area page the pins are a reference, not the results: bookmarks (and lodging), and taps go to the areas.
    // Its question is where, not when, so a bookmark there wears the bookmark badge even when the shop is closed.
    const pinned = areaMap ? areaMapPlaces(state) : shown;
    const pinMarks = areaMap ? new Map(pinned.filter((p) => bookmarks.has(p.id)).map((p) => [p.id, "bookmark" as const])) : marksFor(pinned);
    pins.update(placesToPins(pinned, regionLayers, pinMarks));
    pins.setSelected(areaMap ? undefined : selectedId);
    pins.setInteractive(!areaMap);
    panel.relayout(); // the strip's height depends on what the summary shows
  }

  /** With open-now on: rows from layers without hours are there untouched, and say so. */
  function hoursMarks(shown: Place[]): Map<string, string> {
    const marks = new Map<string, string>();
    for (const p of shown) {
      if (!layersWithHours.has(p.layerId)) marks.set(p.id, "no hours");
    }
    return marks;
  }

  /** The one marker per place, shared by rows and pins. */
  function marksFor(shown: Place[]): Map<string, Mark> {
    const marks = new Map<string, Mark>();
    const bookmarked = bookmarks.all();
    const state = filters.get();
    const seekingOpen = state.openNow || state.openAt !== undefined;
    for (const p of shown) {
      const hours = hoursStates && layersWithHours.has(p.layerId) ? (hoursStates.get(p.id) ?? "unknown") : undefined;
      const mark = markFor({ hours, bookmarked: bookmarked.has(p.id), starred: p.starred, seekingOpen });
      if (mark) marks.set(p.id, mark);
    }
    return marks;
  }

  /** The fit button: the results, or on the Area page the whole city again, after a pan or a zoom. */
  function onFitButton(): void {
    if (areaMapOn) view.setAreaMode(areaBounds(filters.get().region));
    else fitToResults();
  }

  function fitToResults(): void {
    if (areaMapOn) return; // the Area page frames the city (data arriving late must not move it)
    const state = filters.get();
    const shown = applyFilters(places, state, applyOpts(state));
    view.fitPoints(shown.map((p) => [p.lng, p.lat]));
  }

  function renderEmptyState(target: HTMLElement, state: FilterState, shown: number, total: number, busy: boolean): void {
    target.replaceChildren();
    target.hidden = true;
    if (busy && places.length === 0) return;
    if (layersInRegion(layers, state.region).length === 0) {
      target.append(note(`${regionLabel(state.region)} has no layers yet. Add one to src/config/layers.ts.`));
    } else if (total === 0) {
      // Either nothing loaded at all, or the data has no rows for this region yet.
      target.append(
        note(places.length === 0 ? "No data loaded. Check Diagnostics." : `No places in ${regionLabel(state.region)} yet. Add rows with Region = ${state.region} to the data file.`),
      );
    } else if (shown === 0) {
      const noBookmarks = state.bookmarkedOnly && !places.some((p) => p.region === state.region && bookmarks.has(p.id));
      target.append(
        note(noBookmarks ? `No bookmarks in ${regionLabel(state.region)} yet. Bookmark a place from its card.` : "Nothing matches these filters."),
      );
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
      // Data is in; now the big files, once per launch, in the background.
      if (!autoDownloadTried) {
        autoDownloadTried = true;
        void autoDownloadMaps();
      }
    }
  }
  let autoDownloadTried = false;

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
    switch (pinRendererKind()) {
      case "dom":
        return createDomPinRenderer(view);
      case "raster":
        return createRasterPinRenderer(view, colors);
    }
  }

  filters.subscribe((state) => {
    const regionChanged = state.region !== lastRegion;
    lastRegion = state.region;
    rememberRegion(state.region);
    if (ui.get().page !== undefined) {
      // A page stays open while its filters change (the card it hid is checked when it closes); a new region closes it.
      if (regionChanged) leaveToList();
    } else if (ui.get().selectedId !== undefined) {
      deselect();
    }
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
  dbg["panel"] = { get listScrollTop() { return listScrollTop; }, get shownMode() { return shownMode; }, content: panel.content, setHeight: panel.setHeight };
  dbg["basemaps"] = basemaps;
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

  return { offerUpdate: (apply) => header.offerUpdate(apply) };
}

function initialState(params: URLSearchParams, ctx: UrlContext): FilterState {
  if ([...params.keys()].some((k) => k !== SELECTED_PARAM && k !== "pins")) return fromSearchParams(params, ctx);
  return defaultState(rememberedRegion() ?? ctx.defaultRegion);
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

/** Metres one screen pixel covers at a zoom and latitude (MapLibre draws the world 512 px wide at zoom 0). */
function metresPerPixel(zoom: number, lat: number): number {
  return (40_075_016.686 * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** zoom);
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
