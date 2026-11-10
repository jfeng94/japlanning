import { iconAssetUrl, isIconId } from "../config/icons.ts";
import type { LayerConfig } from "../data/types.ts";
import { categoriesOf, layersInPlay, type FilterState } from "../filter/state.ts";
import { formatRadius } from "../geo/nearby.ts";
import { clock, DAY, tokyoWallClock } from "../hours/open.ts";
import { tag } from "./chips.ts";

/**
 * The strip's top line: the result count and an icon per layer in play,
 * then a smaller line of tags for what is selected: the search, the
 * categories, the areas, the flags. List order is the footer's toggle, so
 * it has no tag.
 */
export function renderFilterSummary(
  countEl: HTMLElement,
  summaryEl: HTMLElement,
  state: FilterState,
  regionLayers: LayerConfig[],
  countLabel: string,
  /** Here as the sheet labels it ("Here · Shibuya"), shown while Here is on. */
  hereLabel = "Here",
): void {
  countEl.replaceChildren(countLabel);
  const icons = document.createElement("span");
  icons.className = "layer-icons";
  for (const layer of layersInPlay(state, regionLayers)) {
    const img = document.createElement("img");
    img.alt = layer.label;
    img.title = layer.label;
    img.draggable = false;
    img.src = iconAssetUrl(isIconId(layer.icon) ? layer.icon : "coffee");
    icons.append(img);
  }
  if (icons.childElementCount > 0) countEl.append(icons);

  summaryEl.replaceChildren(...summaryTags(state, regionLayers, hereLabel));
  summaryEl.hidden = summaryEl.childElementCount === 0;
}

function summaryTags(state: FilterState, regionLayers: LayerConfig[], hereLabel: string): HTMLElement[] {
  const tags: HTMLElement[] = [];
  if (state.text) tags.push(tag(`“${state.text}”`));

  // A layer with every kind on reads as the layer; otherwise its kinds one by one.
  for (const layer of regionLayers) {
    const own = categoriesOf(layer);
    const on = own.filter((c) => state.categories.has(c));
    if (on.length === 0) continue;
    if (on.length === own.length) tags.push(tag(layer.label));
    else for (const c of on) tags.push(tag(c.slice(layer.id.length + 1)));
  }

  if (state.here) tags.push(tag(hereLabel));
  for (const a of state.areas) tags.push(tag(a));
  if (state.adjacent && (state.here || state.areas.size > 0)) tags.push(tag("+ adjacent"));
  if (state.nearby !== undefined) tags.push(tag(`Within ${formatRadius(state.nearby)}`));

  if (state.openNow) {
    const at = tokyoWallClock(state.openAt);
    tags.push(tag(at ? `Open ${DAY[at.getDay()]} ${clock(at)}` : "Open now"));
  }
  if (state.bookmarkedOnly) tags.push(tag("Bookmarked"));
  if (state.starredOnly) tags.push(tag("Key branches"));
  return tags;
}
