import type { LayerConfig, Place } from "../data/types.ts";
import { distanceM, formatDistance, type LatLng } from "../geo/distance.ts";
import { tag } from "./chips.ts";
import bookmarkIcon from "./icons/bookmark.webp";
import unknownIcon from "./icons/unknown.webp";

export interface ListOptions {
  layers: LayerConfig[];
  /** Show the layer name on each row (when more than one layer is selected). */
  showLayer: boolean;
  selectedId?: string;
  /** Bookmarked place ids; rows get a mark. */
  bookmarks?: ReadonlySet<string>;
  /** The place whose card was just closed: its row is highlighted and fades. */
  flashId?: string;
  /** With the open-now filter on: why a row is there when it isn't simply open ("no hours", "hours unknown"). */
  hoursMarks?: ReadonlyMap<string, string>;
  /** The device's position; rows show their distance from it. */
  from?: LatLng;
  onSelect: (id: string) => void;
}

/** Render rows for `places` (already filtered and sorted) into `ul`. */
export function renderList(ul: HTMLUListElement, places: Place[], opts: ListOptions): void {
  const byId = new Map(opts.layers.map((l) => [l.id, l]));
  ul.replaceChildren(
    ...places.map((p) => {
      const layer = byId.get(p.layerId);
      const li = document.createElement("li");
      li.className = "place-row";
      if (p.id === opts.flashId) li.classList.add("is-flash");
      li.dataset["id"] = p.id;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "place-button";
      button.setAttribute("aria-pressed", String(p.id === opts.selectedId));
      button.addEventListener("click", () => opts.onSelect(p.id));

      const title = document.createElement("div");
      title.className = "place-title";
      // One marker before the name, like the pins: hours unknown (open-now on) beats the seal, which beats the ★.
      const hoursMark = opts.hoursMarks?.get(p.id);
      if (hoursMark === "hours unknown") {
        title.append(markImg(unknownIcon, "Hours unknown", "row-mark row-mark--unknown"));
      } else if (opts.bookmarks?.has(p.id)) {
        title.append(markImg(bookmarkIcon, "Bookmarked", "row-mark row-mark--bookmark"));
      } else if (p.starred) {
        title.append(tag("★", "star"));
      }
      const name = document.createElement("span");
      name.className = "place-name";
      name.textContent = p.name;
      title.append(name);
      if (p.branch) {
        const branch = document.createElement("span");
        branch.className = "place-branch";
        branch.textContent = p.branch;
        title.append(branch);
      }

      const meta = document.createElement("div");
      meta.className = "place-meta";
      if (opts.showLayer && layer) {
        const dot = document.createElement("span");
        dot.className = "chip-dot";
        dot.style.background = layer.color;
        meta.append(dot, `${layer.label} · `);
      }
      meta.append(p.neighborhood ?? "");
      if (opts.from) {
        const distance = document.createElement("span");
        distance.className = "place-distance";
        distance.textContent = formatDistance(distanceM(opts.from, p));
        meta.append(p.neighborhood ? " · " : "", distance);
      }
      // "no hours" (a layer without hours) stays a text tag; "hours unknown" is the marker above.
      if (hoursMark && hoursMark !== "hours unknown") meta.append(" ", tag(hoursMark, "tag tag--flag"));

      const chips = document.createElement("div");
      chips.className = "place-chips";
      for (const column of rowFacets(layer)) {
        for (const v of p.facets[column] ?? []) chips.append(tag(v));
      }

      button.append(title, meta);
      if (chips.childElementCount > 0) button.append(chips);
      li.append(button);
      return li;
    }),
  );
}

function markImg(src: string, alt: string, className: string): HTMLImageElement {
  const img = document.createElement("img");
  img.className = className;
  img.src = src;
  img.alt = alt;
  img.title = alt;
  img.draggable = false;
  return img;
}

function rowFacets(layer: LayerConfig | undefined): string[] {
  if (!layer) return [];
  return layer.rowFacets ?? layer.facets.slice(0, 2).map((f) => f.column);
}

/** By name, then branch, so a brand's branches sit together in a steady order. */
export function sortByName(places: Place[]): Place[] {
  const cmp = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" });
  return [...places].sort((a, b) => cmp(a.name, b.name) || cmp(a.branch ?? "", b.branch ?? ""));
}
