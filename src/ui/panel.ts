/**
 * The bottom panel over the map. Three snap heights: strip (the header
 * sitting on the footer, nothing between), half, full. Drag the handle or the strip up and down and
 * it follows the finger, then snaps to the nearest height, or in the
 * flick's direction. A tap on the handle still cycles. Content is
 * whatever the app puts in `content`; the strip (header) and the footer
 * are always visible. The footer is the fixed end at the bottom of the
 * screen, for the actions the thumb reaches for; the header travels with
 * the panel (docs/proposals/strip-footer.md).
 *
 * Heights are set in pixels from JS (not CSS) so the drag and the snap
 * share one source of truth.
 */
export type PanelHeight = "strip" | "half" | "full";

export interface Panel {
  el: HTMLElement;
  /** The always-visible header row (travels with the panel). */
  strip: HTMLElement;
  /** Scrollable body shown at half and full. */
  content: HTMLElement;
  /** The always-visible footer row, pinned to the bottom of the screen. */
  footer: HTMLElement;
  getHeight(): PanelHeight;
  setHeight(height: PanelHeight): void;
  /** Current height in CSS pixels (the snap target while settling). */
  heightPx(): number;
  /** Re-measure after the strip's content changed (its height depends on it). */
  relayout(): void;
  /** Hold the current height: drags and handle taps do nothing (the Area page keeps the map in view). */
  lockHeight(locked: boolean): void;
  /**
   * A chevron for a header's upper right (2026-11-10): ^ while collapsed
   * opens the panel to half; V at half or full collapses it. Its face and
   * label follow the height however it changed, drags included.
   */
  toggleButton(): HTMLButtonElement;
}

const CHEVRON_DOWN = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>`;

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
    <div class="panel-footer"></div>
  `;
  root.append(el);

  const drag = el.querySelector<HTMLElement>(".panel-drag")!;
  const handle = el.querySelector<HTMLButtonElement>(".panel-handle")!;
  const strip = el.querySelector<HTMLElement>(".panel-strip")!;
  const content = el.querySelector<HTMLElement>(".panel-content")!;
  const footer = el.querySelector<HTMLElement>(".panel-footer")!;
  let height: PanelHeight = "half";
  let locked = false;
  const toggles: HTMLButtonElement[] = [];
  const labelToggle = (b: HTMLButtonElement) => b.setAttribute("aria-label", height === "strip" ? "Open the panel" : "Collapse the panel");

  const safeBottom = () => parseFloat(getComputedStyle(el).paddingBottom) || 0;
  const headerPx = () => root.querySelector<HTMLElement>(".topbar")?.offsetHeight ?? 52;
  const px: Record<PanelHeight, () => number> = {
    strip: () => drag.offsetHeight + footer.offsetHeight + safeBottom(),
    half: () => Math.round(window.innerHeight * HALF_FRACTION),
    full: () => window.innerHeight - headerPx() - FULL_GAP,
  };

  function apply(h: PanelHeight, notify = true): void {
    height = h;
    el.dataset["height"] = h;
    el.style.height = `${px[h]()}px`;
    if (h === "strip") content.scrollTop = 0;
    for (const b of toggles) labelToggle(b);
    if (notify) onHeightChange?.(h, px[h]());
  }

  const panel: Panel = {
    el,
    strip,
    content,
    footer,
    getHeight: () => height,
    setHeight(h) {
      if (h !== height) apply(h);
    },
    heightPx: () => px[height](),
    relayout() {
      if (pointerId !== undefined) return; // mid-drag: the finger owns the height
      const target = `${px[height]()}px`;
      if (el.style.height !== target) apply(height);
    },
    lockHeight(on) {
      locked = on;
      el.classList.toggle("is-locked", on);
    },
    toggleButton() {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "panel-toggle";
      b.innerHTML = CHEVRON_DOWN; // CSS turns it up while collapsed
      labelToggle(b);
      b.addEventListener("click", () => {
        if (!locked) apply(height === "strip" ? "half" : "strip");
      });
      toggles.push(b);
      return b;
    },
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
    if (e.button !== 0 || locked) return;
    pointerId = e.pointerId;
    startY = lastY = e.clientY;
    lastT = e.timeStamp;
    startHeight = el.getBoundingClientRect().height;
    velocity = 0;
    moved = false;
    el.classList.add("is-dragging");
  });

  // On the window, like the release below: until the drag captures the pointer, a fast
  // mouse can leave the strip in its very first move, and that move has to start the drag.
  window.addEventListener("pointermove", (e) => {
    if (e.pointerId !== pointerId) return;
    const dy = startY - e.clientY; // up is positive
    if (!moved) {
      if (Math.abs(dy) <= TAP_SLOP_PX) return;
      // A drag after all: from here the panel owns the pointer, even off the strip. Not
      // before: Chromium sends the click of a captured pointer to the capturing element,
      // so a tap on one of the strip's buttons (Bookmark, a page's X) would never reach it.
      moved = true;
      drag.setPointerCapture(e.pointerId);
    }
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
      const target = e.target instanceof Element ? e.target : null;
      const onButton = target?.closest("button, a");
      if (target && handle.contains(target)) apply(NEXT[height]);
      else if (height === "strip" && !onButton) apply("half");
      return;
    }
    const current = el.getBoundingClientRect().height;
    apply(snapTarget(current, velocity));
  };
  // On the window too: until a drag captures the pointer, a press that slides off the
  // strip ends somewhere else, and the panel must still hear it.
  window.addEventListener("pointerup", end);
  window.addEventListener("pointercancel", end);
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
