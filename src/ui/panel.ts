/**
 * The bottom panel over the map. Three heights cycled by its handle:
 * strip (just the summary row), half, full. Content is whatever the app
 * puts in `content` (the list, or a selected place from M4) and the
 * summary row in `strip` is always visible.
 */
export type PanelHeight = "strip" | "half" | "full";

export interface Panel {
  el: HTMLElement;
  /** The always-visible summary row. */
  strip: HTMLElement;
  /** Scrollable body shown at half and full. */
  content: HTMLElement;
  getHeight(): PanelHeight;
  setHeight(height: PanelHeight): void;
}

const NEXT: Record<PanelHeight, PanelHeight> = { strip: "half", half: "full", full: "strip" };

export function mountPanel(root: HTMLElement, onHeightChange?: (h: PanelHeight) => void): Panel {
  const el = document.createElement("section");
  el.className = "panel";
  el.setAttribute("aria-label", "Places");
  el.innerHTML = `
    <button type="button" class="panel-handle" aria-label="Expand or collapse the list"><span class="grabber"></span></button>
    <div class="panel-strip"></div>
    <div class="panel-content"></div>
  `;
  root.append(el);

  const strip = el.querySelector<HTMLElement>(".panel-strip")!;
  const content = el.querySelector<HTMLElement>(".panel-content")!;
  let height: PanelHeight = "half";
  el.dataset["height"] = height;

  const panel: Panel = {
    el,
    strip,
    content,
    getHeight: () => height,
    setHeight(h) {
      if (h === height) return;
      height = h;
      el.dataset["height"] = h;
      if (h === "strip") content.scrollTop = 0;
      onHeightChange?.(h);
    },
  };

  el.querySelector(".panel-handle")!.addEventListener("click", () => panel.setHeight(NEXT[height]));
  strip.addEventListener("click", (e) => {
    // Tapping the summary row at strip height opens the panel; buttons inside it keep their own behaviour.
    if (height === "strip" && !(e.target as HTMLElement).closest("button")) panel.setHeight("half");
  });
  return panel;
}
