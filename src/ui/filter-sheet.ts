import type { LayerConfig, Place, RegionConfig } from "../data/types.ts";
import { facetCounts, neighborhoodCounts } from "../filter/apply.ts";
import { activeFacetLayer, getSelection, hasActiveFilters, type FilterAction, type FilterState } from "../filter/state.ts";
import { chip } from "./chips.ts";

export interface FilterSheetContext {
  region: RegionConfig;
  /** The region's layers. */
  layers: LayerConfig[];
  places: Place[];
  dispatch: (action: FilterAction) => void;
}

/**
 * Rebuild the filter sheet body for a state. Neighborhood chips, the
 * starred toggle, then one section per facet of the active layer with a
 * count on every value and an include-unknown checkbox. Cheap enough to
 * rebuild on every change at this data size.
 */
export function renderFilterSheet(body: HTMLElement, state: FilterState, ctx: FilterSheetContext): void {
  const { region, places, dispatch } = ctx;
  body.replaceChildren();

  if (ctx.layers.length > 0) {
    body.append(
      section(
        "Layers",
        ctx.layers.map((l) =>
          chip(l.label, {
            pressed: state.layers.has(l.id),
            color: l.color,
            count: places.filter((p) => p.layerId === l.id).length,
            onClick: () => dispatch({ type: "toggleLayer", layer: l.id }),
          }),
        ),
      ),
    );
  }

  if (region.neighborhoods.length > 0) {
    const counts = neighborhoodCounts(places, state, region.neighborhoods);
    body.append(
      section(
        "Neighborhood",
        region.neighborhoods.map((n) =>
          chip(n, {
            pressed: state.neighborhoods.has(n),
            count: counts.get(n) ?? 0,
            disabled: (counts.get(n) ?? 0) === 0 && !state.neighborhoods.has(n),
            onClick: () => dispatch({ type: "toggleNeighborhood", neighborhood: n }),
          }),
        ),
      ),
    );
  }

  body.append(
    section("Flags", [
      chip("★ Key branches only", {
        pressed: state.starredOnly,
        onClick: () => dispatch({ type: "setStarredOnly", value: !state.starredOnly }),
      }),
    ]),
  );

  const activeId = activeFacetLayer(state);
  const layer = ctx.layers.find((l) => l.id === activeId);
  if (layer) {
    const counts = facetCounts(places, state, layer);
    for (const facet of layer.facets) {
      const count = counts.get(facet.column);
      if (!count) continue;
      const sel = getSelection(state, layer.id, facet.column);
      const chips = [...count.values].map(([value, n]) =>
        chip(value, {
          pressed: sel.values.has(value),
          count: n,
          disabled: n === 0 && !sel.values.has(value),
          onClick: () => dispatch({ type: "toggleFacetValue", layer: layer.id, column: facet.column, value }),
        }),
      );
      const sec = section(facet.label ?? facet.column, chips);
      if (count.unknown > 0 || !sel.includeUnknown) {
        sec.append(
          unknownToggle(count.unknown, sel.includeUnknown, (value) =>
            dispatch({ type: "setIncludeUnknown", layer: layer.id, column: facet.column, value }),
          ),
        );
      }
      body.append(sec);
    }
  } else if (state.layers.size > 1) {
    body.append(note("Pick a single layer to filter by its details."));
  }

  if (hasActiveFilters(state)) {
    const clear = chip("Clear all filters", { className: "clear", onClick: () => dispatch({ type: "clearFilters" }) });
    const wrap = document.createElement("div");
    wrap.className = "sheet-actions";
    wrap.append(clear);
    body.append(wrap);
  }
}

function section(title: string, chips: HTMLElement[]): HTMLElement {
  const sec = document.createElement("section");
  sec.className = "filter-section";
  const h = document.createElement("h3");
  h.textContent = title;
  const row = document.createElement("div");
  row.className = "chip-row";
  row.append(...chips);
  sec.append(h, row);
  return sec;
}

function unknownToggle(n: number, checked: boolean, onChange: (value: boolean) => void): HTMLLabelElement {
  const label = document.createElement("label");
  label.className = "unknown-toggle";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = checked;
  input.addEventListener("change", () => onChange(input.checked));
  label.append(input, ` Include unknown (${n})`);
  return label;
}

function note(text: string): HTMLParagraphElement {
  const p = document.createElement("p");
  p.className = "note";
  p.textContent = text;
  return p;
}
