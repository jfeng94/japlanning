import { layers } from "../config/layers.ts";
import { regionById } from "../config/regions.ts";
import { loadAllLayers, type LoadDeps } from "../data/load.ts";
import { createIdbStore } from "../data/store.ts";
import type { LoadResult, LoadSource } from "../data/types.ts";

/** The real browser dependencies. Built once; the IndexedDB handle is cheap. */
export function browserDeps(): LoadDeps {
  return {
    fetch: (url, init) => fetch(url, init),
    store: createIdbStore(),
    now: () => new Date(),
    bundledBuiltAt: new Date(__BUILD_TIME__),
  };
}

const SOURCE_LABEL: Record<LoadSource, string> = {
  network: "live",
  cache: "cached",
  bundled: "bundled snapshot",
  none: "no data",
};

/**
 * Mount the data status section into `root`: one row per configured layer
 * with count, source, fetch time and warnings, plus a Refresh button that
 * re-runs the load so the cache path can be exercised by hand.
 */
export function mountDataStatus(root: HTMLElement, deps: LoadDeps = browserDeps()): void {
  root.innerHTML = `
    <div class="data-head">
      <h2>Data</h2>
      <button type="button" class="refresh">Refresh</button>
    </div>
    <ul class="layer-list"></ul>
  `;
  const list = root.querySelector<HTMLUListElement>(".layer-list")!;
  const button = root.querySelector<HTMLButtonElement>(".refresh")!;

  const run = async () => {
    button.disabled = true;
    list.replaceChildren(...layers.map((l) => row(l.label, regionById(l.region).label, "loading…")));
    try {
      const results = await loadAllLayers(layers, deps);
      list.replaceChildren(...results.map(renderResult));
    } finally {
      button.disabled = false;
    }
  };
  button.addEventListener("click", () => void run());
  void run();
}

function renderResult(r: LoadResult): HTMLLIElement {
  const layer = layers.find((l) => l.id === r.layerId)!;
  const li = row(layer.label, regionById(layer.region).label);
  const body = li.querySelector(".layer-body")!;

  const summary = document.createElement("p");
  summary.className = "layer-summary";
  const count = r.source === "none" ? "—" : `${r.places.length} places`;
  summary.append(`${count} · `, badge(r.source));
  if (r.fetchedAt) summary.append(` · ${formatWhen(r.fetchedAt)}`);
  body.append(summary);

  if (r.error) {
    const err = document.createElement("p");
    err.className = "layer-error";
    err.textContent = r.source === "none" ? r.error : `fell back because ${r.error}`;
    body.append(err);
  }

  if (r.warnings.length > 0) {
    const details = document.createElement("details");
    const sum = document.createElement("summary");
    sum.textContent = `${r.warnings.length} warning${r.warnings.length === 1 ? "" : "s"}`;
    const ul = document.createElement("ul");
    for (const w of r.warnings) {
      const item = document.createElement("li");
      const where = [w.row !== undefined ? `row ${w.row}` : "", w.column ?? ""].filter(Boolean).join(", ");
      item.textContent = where ? `${where}: ${w.message}` : w.message;
      ul.append(item);
    }
    details.append(sum, ul);
    body.append(details);
  }
  return li;
}

function row(label: string, region: string, note?: string): HTMLLIElement {
  const li = document.createElement("li");
  li.className = "layer-row";
  li.innerHTML = `
    <div class="layer-title"><strong></strong> <span class="layer-region"></span></div>
    <div class="layer-body"></div>
  `;
  li.querySelector("strong")!.textContent = label;
  li.querySelector(".layer-region")!.textContent = region;
  if (note) li.querySelector(".layer-body")!.textContent = note;
  return li;
}

function badge(source: LoadSource): HTMLSpanElement {
  const span = document.createElement("span");
  span.className = "badge";
  span.dataset["source"] = source;
  span.textContent = SOURCE_LABEL[source];
  return span;
}

function formatWhen(d: Date): string {
  const mins = Math.round((Date.now() - d.getTime()) / 60_000);
  const rel = mins < 1 ? "just now" : mins < 60 ? `${mins} min ago` : mins < 60 * 48 ? `${Math.round(mins / 60)} h ago` : `${Math.round(mins / 1440)} d ago`;
  return `${rel} (${d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })})`;
}
