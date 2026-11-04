/**
 * The bottom panel over the map. Three snap heights: strip (just the
 * summary row), half, full. Drag the handle or the strip up and down and
 * it follows the finger, then snaps to the nearest height, or in the
 * flick's direction. A tap on the handle still cycles. Content is
 * whatever the app puts in `content`; the strip is always visible.
 *
 * Heights are set in pixels from JS (not CSS) so the drag and the snap
 * share one source of truth.
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
  /** Current height in CSS pixels (the snap target while settling). */
  heightPx(): number;
}

const NEXT: Record<PanelHeight, PanelHeight> = { strip: "half", half: "full", full: "strip" };
const ORDER: PanelHeight[] = ["strip", "half", "full"];
const HALF_FRACTION = 0.46;
const FULL_GAP = 8;
const TAP_SLOP_PX = 6;
const FLICK_PX_PER_MS = 0.4;

export function mountPanel(root: HTMLElement, onHeightChange?: (h: PanelHeight, px: number) => void): Panel {
  const el = document.createElement("section");
  el.className = "panel";
  el.setAttribute("aria-label", "Places");
  el.innerHTML = `
    <div class="panel-drag">
      <button type="button" class="panel-handle" aria-label="Expand or collapse the list"><span class="grabber"></span></button>
      <div class="panel-strip"></div>
    </div>
    <div class="panel-content"></div>
  `;
  root.append(el);

  const drag = el.querySelector<HTMLElement>(".panel-drag")!;
  const handle = el.querySelector<HTMLButtonElement>(".panel-handle")!;
  const strip = el.querySelector<HTMLElement>(".panel-strip")!;
  const content = el.querySelector<HTMLElement>(".panel-content")!;
  let height: PanelHeight = "half";

  const safeBottom = () => parseFloat(getComputedStyle(el).paddingBottom) || 0;
  const headerPx = () => root.querySelector<HTMLElement>(".topbar")?.offsetHeight ?? 52;
  const px: Record<PanelHeight, () => number> = {
    strip: () => drag.offsetHeight + safeBottom(),
    half: () => Math.round(window.innerHeight * HALF_FRACTION),
    full: () => window.innerHeight - headerPx() - FULL_GAP,
  };

  function apply(h: PanelHeight, notify = true): void {
    height = h;
    el.dataset["height"] = h;
    el.style.height = `${px[h]()}px`;
    if (h === "strip") content.scrollTop = 0;
    if (notify) onHeightChange?.(h, px[h]());
  }

  const panel: Panel = {
    el,
    strip,
    content,
    getHeight: () => height,
    setHeight(h) {
      if (h !== height) apply(h);
    },
    heightPx: () => px[height](),
  };

  // ---- drag ----
  let pointerId: number | undefined;
  let startY = 0;
  let startHeight = 0;
  let lastY = 0;
  let lastT = 0;
  let velocity = 0;
  let moved = false;

  drag.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    pointerId = e.pointerId;
    startY = lastY = e.clientY;
    lastT = e.timeStamp;
    startHeight = el.getBoundingClientRect().height;
    velocity = 0;
    moved = false;
    drag.setPointerCapture(e.pointerId);
    el.classList.add("is-dragging");
  });

  drag.addEventListener("pointermove", (e) => {
    if (e.pointerId !== pointerId) return;
    const dy = startY - e.clientY; // up is positive
    if (!moved && Math.abs(dy) > TAP_SLOP_PX) moved = true;
    if (!moved) return;
    const dt = Math.max(1, e.timeStamp - lastT);
    velocity = (lastY - e.clientY) / dt; // px per ms, up positive
    lastY = e.clientY;
    lastT = e.timeStamp;
    const h = Math.min(px.full(), Math.max(px.strip(), startHeight + dy));
    el.style.height = `${h}px`;
    el.dataset["height"] = ""; // between snaps: content stays visible
  });

  const end = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return;
    pointerId = undefined;
    el.classList.remove("is-dragging");
    if (!moved) {
      // A tap: the handle cycles; the strip (not its buttons) opens from strip height.
      el.dataset["height"] = height;
      el.style.height = `${px[height]()}px`;
      const onButton = (e.target as HTMLElement).closest("button, a");
      if (e.target === handle || handle.contains(e.target as Node)) apply(NEXT[height]);
      else if (height === "strip" && !onButton) apply("half");
      return;
    }
    const current = el.getBoundingClientRect().height;
    apply(snapTarget(current, velocity));
  };
  drag.addEventListener("pointerup", end);
  drag.addEventListener("pointercancel", end);
  // Taps are handled on pointerup; swallow the synthetic click so the handle doesn't cycle twice.
  handle.addEventListener("click", (e) => e.preventDefault());

  /** Flick in a direction goes one step that way; otherwise the nearest snap. */
  function snapTarget(current: number, v: number): PanelHeight {
    if (Math.abs(v) > FLICK_PX_PER_MS) {
      const i = ORDER.indexOf(height);
      const next = ORDER[Math.min(ORDER.length - 1, Math.max(0, i + (v > 0 ? 1 : -1)))]!;
      // Only if the flick actually moved toward it; else fall through to nearest.
      if ((v > 0 && px[next]() >= current) || (v < 0 && px[next]() <= current)) return next;
    }
    let best: PanelHeight = "half";
    let bestDist = Infinity;
    for (const h of ORDER) {
      const d = Math.abs(px[h]() - current);
      if (d < bestDist) {
        bestDist = d;
        best = h;
      }
    }
    return best;
  }

  window.addEventListener("resize", () => apply(height, false));
  apply(height, false);
  return panel;
}
