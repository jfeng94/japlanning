import type { LayerConfig, Place } from "../data/types.ts";
import { tag } from "./chips.ts";
import bookmarkIcon from "./icons/bookmark.webp";

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
      if (p.starred) title.append(tag("★", "star"));
      if (opts.bookmarks?.has(p.id)) {
        const mark = document.createElement("img");
        mark.className = "row-bookmark";
        mark.src = bookmarkIcon;
        mark.alt = "Bookmarked";
        mark.draggable = false;
        title.append(mark);
      }
      const name = document.createElement("span");
      name.className = "place-name";
      name.textContent = p.name;
      title.append(name);

      const meta = document.createElement("div");
      meta.className = "place-meta";
      if (opts.showLayer && layer) {
        const dot = document.createElement("span");
        dot.className = "chip-dot";
        dot.style.background = layer.color;
        meta.append(dot, `${layer.label} · `);
      }
      meta.append(p.neighborhood ?? "");
      const mark = opts.hoursMarks?.get(p.id);
      if (mark) meta.append(" ", tag(mark, "tag tag--flag"));

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

function rowFacets(layer: LayerConfig | undefined): string[] {
  if (!layer) return [];
  return layer.rowFacets ?? layer.facets.slice(0, 2).map((f) => f.column);
}

export function sortByName(places: Place[]): Place[] {
  return [...places].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}
