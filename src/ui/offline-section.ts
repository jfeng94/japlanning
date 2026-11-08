import type { RegionConfig } from "../data/types.ts";
import type { BasemapStatus, BasemapStore } from "../offline/basemap.ts";
import type { DownloadManager } from "../offline/downloads.ts";
import { appUsage, formatMb } from "../offline/usage.ts";
import { chip } from "./chips.ts";

/**
 * The Offline section of the Settings sheet (M7): what the device holds
 * and the per-region basemaps. Downloads normally start by themselves on
 * an online launch (the "Download maps automatically" setting); the
 * buttons here start, cancel or delete one by hand.
 */

export interface OfflineDeps {
  regions: readonly RegionConfig[];
  basemaps: BasemapStore;
  downloads: DownloadManager;
  urlFor: (region: RegionConfig) => string;
  /** A region's archive was removed: the map should stop reading it. */
  onRemoved: (region: RegionConfig) => void;
  /** The data on the device: how many places and when they were last fetched. */
  dataSynced: () => { places: number; at?: Date } | undefined;
  buildSha: string;
}

/** Sizes from a HEAD request, so a row can say "49 MB" before a download. */
const sizes = new Map<string, number>();
/** The live subscription of the section currently rendered, dropped on the next render. */
const subscriptions = new WeakMap<HTMLElement, () => void>();

export function renderOfflineSection(container: HTMLElement, deps: OfflineDeps): void {
  subscriptions.get(container)?.();
  container.replaceChildren();
  const title = document.createElement("h3");
  title.textContent = "Offline";
  const note = document.createElement("p");
  note.className = "note";
  note.textContent = "The app, the places and your bookmarks stay on this device. Each region's map is downloaded once and again only when a newer one is published.";
  container.append(title, note);

  const facts = document.createElement("dl");
  facts.className = "offline-facts";
  container.append(facts);
  const fact = (label: string, value: string): HTMLElement => {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
    facts.append(dt, dd);
    return dd;
  };
  fact("App", navigator.serviceWorker?.controller ? `cached, build ${deps.buildSha}` : `build ${deps.buildSha}, not cached yet`);
  const data = deps.dataSynced();
  fact("Places", data ? `${data.places}, synced ${data.at ? formatWhen(data.at) : "from the bundled copy"}` : "not loaded yet");
  const stored = fact("Stored", "adding up…");
  void appUsage(deps.basemaps, deps.regions).then((u) => {
    stored.textContent = `${formatMb(u.maps + u.shell)} (maps ${formatMb(u.maps)}, app ${formatMb(u.shell)})`;
  });
  void persistedLine().then((v) => fact("Storage", v));

  const rows = new Map<string, HTMLElement>();
  for (const region of deps.regions) {
    if (!region.bbox) continue;
    const row = document.createElement("div");
    row.className = "offline-region";
    container.append(row);
    rows.set(region.id, row);
    void renderRegion(row, region, deps);
  }
  // Progress and completion redraw the rows while the sheet is open.
  const unsubscribe = deps.downloads.subscribe(() => {
    for (const region of deps.regions) {
      const row = rows.get(region.id);
      if (row) void renderRegion(row, region, deps);
    }
  });
  subscriptions.set(container, unsubscribe);
}

async function renderRegion(row: HTMLElement, region: RegionConfig, deps: OfflineDeps): Promise<void> {
  const status = await deps.basemaps.status(region);
  const active = deps.downloads.active(region.id);
  row.replaceChildren();

  const head = document.createElement("div");
  head.className = "offline-region-head";
  const name = document.createElement("strong");
  name.textContent = region.label;
  const state = document.createElement("span");
  state.className = "offline-state";
  state.textContent = active ? progressText(active.fraction) : statusText(status, sizes.get(region.id));
  head.append(name, state);
  row.append(head);

  const actions = document.createElement("div");
  actions.className = "sheet-actions sheet-actions--wrap";
  if (active) {
    actions.append(chip("Cancel", { className: "clear", onClick: () => deps.downloads.cancel(region.id) }));
  } else {
    if (status.kind !== "ready") {
      actions.append(chip(status.kind === "stale" ? "Update map" : "Download map", { onClick: () => void deps.downloads.start(region) }));
    }
    if (status.kind !== "none") {
      actions.append(
        chip("Delete", {
          className: "clear",
          onClick: () =>
            void deps.basemaps.remove(region).then(() => {
              deps.onRemoved(region);
              void renderRegion(row, region, deps);
            }),
        }),
      );
    }
  }
  row.append(actions);

  // Size ahead of a download, when online; a failure just leaves the size out.
  if (status.kind === "none" && !sizes.has(region.id) && !active && navigator.onLine) {
    try {
      const res = await fetch(deps.urlFor(region), { method: "HEAD", cache: "no-store" });
      const n = Number(res.headers.get("content-length"));
      if (res.ok && n > 0) {
        sizes.set(region.id, n);
        state.textContent = statusText(status, n);
      }
    } catch {
      /* offline or blocked */
    }
  }
}

function statusText(status: BasemapStatus, size: number | undefined): string {
  if (status.kind === "none") return size ? `not on this device · ${formatMb(size)}` : "not on this device";
  const when = formatWhen(new Date(status.meta.savedAt));
  const mb = formatMb(status.meta.bytes);
  return status.kind === "ready" ? `ready · ${mb} · ${when}` : `update available · ${mb} on device from ${when}`;
}

function progressText(fraction: number): string {
  return Number.isFinite(fraction) ? `downloading ${Math.round(fraction * 100)}%` : "downloading…";
}

async function persistedLine(): Promise<string> {
  try {
    if (typeof navigator.storage?.persisted !== "function") return "persistence not supported here";
    return (await navigator.storage.persisted()) ? "persisted (the browser will keep it)" : "not persisted yet (asked with the first map download)";
  } catch {
    return "unknown";
  }
}

function formatWhen(d: Date): string {
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
