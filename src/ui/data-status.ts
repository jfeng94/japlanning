import { layers } from "../config/layers.ts";
import { regionById } from "../config/regions.ts";
import type { LoadResult, LoadSource } from "../data/types.ts";

const SOURCE_LABEL: Record<LoadSource, string> = {
  network: "live",
  cache: "cached",
  bundled: "bundled snapshot",
  none: "no data",
};

/**
 * One row per configured layer: count, source badge, fetch time, the reason
 * a better source was skipped, and an expandable warning list. Pure
 * rendering; the app owns loading.
 */
export function renderDataStatus(list: HTMLElement, results: LoadResult[], loading: boolean): void {
  if (loading && results.length === 0) {
    list.replaceChildren(...layers.map((l) => row(l.label, l.region ? regionById(l.region).label : "all regions", "loading…")));
    return;
  }
  list.replaceChildren(...results.map(renderResult));
}

function renderResult(r: LoadResult): HTMLLIElement {
  const layer = layers.find((l) => l.id === r.layerId);
  const li = row(layer?.label ?? r.layerId, layer?.region ? regionById(layer.region).label : layer ? "all regions" : "");
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

export function formatWhen(d: Date): string {
  const mins = Math.round((Date.now() - d.getTime()) / 60_000);
  const rel =
    mins < 1 ? "just now" : mins < 60 ? `${mins} min ago` : mins < 60 * 48 ? `${Math.round(mins / 60)} h ago` : `${Math.round(mins / 1440)} d ago`;
  return `${rel} (${d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })})`;
}
