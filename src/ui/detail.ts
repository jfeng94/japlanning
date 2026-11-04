import type { LayerConfig, Place } from "../data/types.ts";
import { tag } from "./chips.ts";
import { directionsUrl } from "./links.ts";

/**
 * The selected place in the panel. M3 ships the container and this
 * placeholder (name, where it is, Directions); M4 fills in the full card.
 */
export function renderDetail(body: HTMLElement, place: Place, layer: LayerConfig | undefined, onBack: () => void): void {
  body.replaceChildren();

  const head = document.createElement("div");
  head.className = "detail-head";
  const back = document.createElement("button");
  back.type = "button";
  back.className = "back-button";
  back.setAttribute("aria-label", "Back to the list");
  back.textContent = "‹";
  back.addEventListener("click", onBack);
  const title = document.createElement("h2");
  title.className = "detail-title";
  if (place.starred) title.append(tag("★", "star"));
  title.append(place.name);
  head.append(back, title);

  const meta = document.createElement("p");
  meta.className = "detail-meta";
  meta.textContent = [layer?.label, place.neighborhood].filter(Boolean).join(" · ");

  const actions = document.createElement("div");
  actions.className = "detail-actions";
  actions.append(directionsLink(place));

  const todo = document.createElement("p");
  todo.className = "note";
  todo.textContent = "Hours, address, notes and Copy arrive in M4.";

  body.append(head, meta, actions, todo);
}

/** The strip's content while a place is selected: name and Directions. */
export function renderDetailStrip(strip: HTMLElement, place: Place): void {
  strip.replaceChildren();
  const name = document.createElement("p");
  name.className = "results-count";
  name.textContent = place.name;
  strip.append(name, directionsLink(place, "small"));
}

function directionsLink(place: Place, size: "normal" | "small" = "normal"): HTMLAnchorElement {
  const a = document.createElement("a");
  a.className = `action-button${size === "small" ? " action-button--small" : ""}`;
  a.href = directionsUrl(place);
  a.target = "_blank";
  a.rel = "noopener";
  a.textContent = "Directions";
  return a;
}
