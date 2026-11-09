import { iconAssetUrl, isIconId } from "../config/icons.ts";
import type { LayerConfig } from "../data/types.ts";
import { clock, DAY, tokyoWallClock } from "../hours/open.ts";
import { activeFacetLayer, effectiveLayers, getSelection, isDefaultSelection, type FilterState } from "../filter/state.ts";
import { tag } from "./chips.ts";

/**
 * The strip's top line: the result count, then an icon per selected
 * layer, then a smaller line of the active selections. Tapping it opens
 * the filter sheet.
 */
export function renderFilterSummary(
  countEl: HTMLElement,
  summaryEl: HTMLElement,
  state: FilterState,
  regionLayers: LayerConfig[],
  countLabel: string,
  /** The list is in distance order, which the tags say since it isn't a filter. */
  byDistance = false,
): void {
  countEl.replaceChildren(countLabel);
  const icons = document.createElement("span");
  icons.className = "layer-icons";
  const on = effectiveLayers(state, regionLayers.map((l) => l.id));
  for (const layer of regionLayers) {
    if (!on.has(layer.id)) continue;
    const img = document.createElement("img");
    img.alt = layer.label;
    img.title = layer.label;
    img.draggable = false;
    img.src = iconAssetUrl(isIconId(layer.icon) ? layer.icon : "coffee", "dom");
    icons.append(img);
  }
  if (icons.childElementCount > 0) countEl.append(icons);

  summaryEl.replaceChildren(...summaryTags(state, regionLayers, byDistance));
  summaryEl.hidden = summaryEl.childElementCount === 0;
}

function summaryTags(state: FilterState, regionLayers: LayerConfig[], byDistance: boolean): HTMLElement[] {
  const tags: HTMLElement[] = [];
  if (byDistance) tags.push(tag("by distance"));
  if (state.text) tags.push(tag(`“${state.text}”`));
  for (const n of state.neighborhoods) tags.push(tag(n));
  if (state.starredOnly) tags.push(tag("★ key branches"));
  if (state.bookmarkedOnly) tags.push(tag("Bookmarked"));
  if (state.openNow) {
    const at = tokyoWallClock(state.openAt);
    tags.push(tag(at ? `Open ${DAY[at.getDay()]} ${clock(at)}` : "Open now"));
  }

  const activeId = activeFacetLayer(state, regionLayers.map((l) => l.id));
  const activeLayer = regionLayers.find((l) => l.id === activeId);
  if (activeLayer) {
    for (const facet of activeLayer.facets) {
      const sel = getSelection(state, activeLayer.id, facet.column);
      if (isDefaultSelection(sel)) continue;
      const label = facet.label ?? facet.column;
      const values = [...sel.values];
      if (values.length > 0) tags.push(tag(`${label}: ${values.join(", ")}`));
      if (!sel.includeUnknown) tags.push(tag(`${label}: known only`));
    }
  }
  return tags;
}

