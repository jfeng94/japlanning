import type { RegionConfig } from "../data/types.ts";
import type { BasemapStatus, BasemapStore } from "../offline/basemap.ts";
import { chip } from "./chips.ts";

/**
 * The Offline section of the Settings sheet (M7): what the device holds
 * and the per-region basemap downloads. The app shell and the data are
 * cached without asking (small); a basemap is tens of MB, so it is a tap,
 * and an update is a tap too.
 */

export interface OfflineDeps {
  regions: readonly RegionConfig[];
  basemaps: BasemapStore;
  urlFor: (region: RegionConfig) => string;
  /** A region's archive landed or was removed: the map should re-read what is stored. */
  onChanged: (region: RegionConfig) => void;
  /** The data on the device: how many places and when they were last fetched. */
  dataSynced: () => { places: number; at?: Date } | undefined;
  buildSha: string;
}

interface Download {
  fraction: number;
  controller: AbortController;
}

/** In-flight downloads survive a re-render of the sheet. */
const downloads = new Map<string, Download>();
/** Sizes from a HEAD request, so the row can say "52 MB" before a download. */
const sizes = new Map<string, number>();

export function renderOfflineSection(container: HTMLElement, deps: OfflineDeps): void {
  container.replaceChildren();
  const title = document.createElement("h3");
  title.textContent = "Offline";
  const note = document.createElement("p");
  note.className = "note";
  note.textContent = "The app, the places and your bookmarks stay on this device. Each region's map is a one-time download.";
  container.append(title, note);

  const facts = document.createElement("dl");
  facts.className = "offline-facts";
  container.append(facts);
  const fact = (label: string, value: string) => {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
    facts.append(dt, dd);
  };
  fact("App", navigator.serviceWorker?.controller ? `cached, build ${deps.buildSha}` : `build ${deps.buildSha}, not cached yet`);
  const data = deps.dataSynced();
  fact("Places", data ? `${data.places}, synced ${data.at ? formatWhen(data.at) : "from the bundled copy"}` : "not loaded yet");
  void persistedLine().then((v) => fact("Storage", v));

  for (const region of deps.regions) {
    if (!region.bbox) continue;
    const row = document.createElement("div");
    row.className = "offline-region";
    container.append(row);
    void renderRegion(row, region, deps);
  }
}

async function renderRegion(row: HTMLElement, region: RegionConfig, deps: OfflineDeps): Promise<void> {
  const rerender = () => void renderRegion(row, region, deps);
  const status = await deps.basemaps.status(region);
  const active = downloads.get(region.id);
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
    actions.append(chip("Cancel", { className: "clear", onClick: () => active.controller.abort() }));
  } else {
    if (status.kind !== "ready") {
      actions.append(
        chip(status.kind === "stale" ? "Update map" : "Download map", {
          onClick: () => void download(region, deps, rerender),
        }),
      );
    }
    if (status.kind !== "none") {
      actions.append(
        chip("Delete", {
          className: "clear",
          onClick: () => void deps.basemaps.remove(region).then(() => {
            deps.onChanged(region);
            rerender();
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

async function download(region: RegionConfig, deps: OfflineDeps, rerender: () => void): Promise<void> {
  // Ask the browser to keep our storage; it is a no-op where unsupported, and a "no" still lets us download.
  try {
    await navigator.storage?.persist?.();
  } catch {
    /* ignore */
  }
  const controller = new AbortController();
  const entry: Download = { fraction: 0, controller };
  downloads.set(region.id, entry);
  rerender();
  try {
    await deps.basemaps.download(
      region,
      deps.urlFor(region),
      (fraction) => {
        entry.fraction = fraction;
        rerender();
      },
      controller.signal,
    );
    deps.onChanged(region);
  } catch (e) {
    if (!(e instanceof DOMException && e.name === "AbortError")) {
      const { showToast } = await import("./toast.ts");
      showToast(`Download failed: ${e instanceof Error ? e.message : String(e)}`, 3000);
    }
  } finally {
    downloads.delete(region.id);
    rerender();
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
    return (await navigator.storage.persisted()) ? "persisted (the browser will keep it)" : "not persisted yet (asked on the first map download)";
  } catch {
    return "unknown";
  }
}

function formatMb(bytes: number): string {
  return `${(bytes / 1_048_576).toFixed(bytes >= 10_485_760 ? 0 : 1)} MB`;
}

function formatWhen(d: Date): string {
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
