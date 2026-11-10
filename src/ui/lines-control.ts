import type { IControl } from "maplibre-gl";
import linesIcon from "./icons/lines.webp";

/**
 * The Lines button under fit and locate (docs/proposals/m8-transit.md):
 * a small panel of the region's subway lines, each a chip in its colour
 * and letter; a tap hides or shows that line. All and None at the foot.
 * The app keeps the hidden set on the device and hides the button in a
 * region without lines.
 */
export interface LineChoice {
  id: string;
  code: string;
  label: string;
  colour: string;
}

export interface LinesControl extends IControl {
  /** The region's lines; none hides the button. */
  setLines(lines: LineChoice[]): void;
  setHidden(hidden: ReadonlySet<string>): void;
}


export function createLinesControl(onChange: (hidden: Set<string>) => void): LinesControl {
  const root = document.createElement("div");
  root.className = "maplibregl-ctrl lines-control";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "lines-button";
  button.innerHTML = `<img alt="" draggable="false" src="${linesIcon}">`;
  button.setAttribute("aria-label", "Subway lines");
  button.setAttribute("aria-expanded", "false");
  button.title = "Subway lines";
  const panel = document.createElement("div");
  panel.className = "lines-panel";
  panel.hidden = true;
  root.append(button, panel);

  let lines: LineChoice[] = [];
  let hidden = new Set<string>();

  const open = (on: boolean) => {
    panel.hidden = !on;
    button.setAttribute("aria-expanded", String(on));
    if (on) render();
  };
  button.addEventListener("click", () => open(panel.hidden));
  // A tap anywhere else, or Escape, closes it.
  document.addEventListener("pointerdown", (e) => {
    if (!panel.hidden && !root.contains(e.target as Node)) open(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) open(false);
  });

  const change = (next: Set<string>) => {
    hidden = next;
    render();
    onChange(new Set(hidden));
  };

  function render(): void {
    const chips = lines.map((l) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip line-chip";
      const shown = !hidden.has(l.id);
      chip.setAttribute("aria-pressed", String(shown));
      chip.setAttribute("aria-label", `${l.label}, ${shown ? "shown" : "hidden"}`);
      const badge = document.createElement("span");
      badge.className = "line-badge";
      badge.style.background = l.colour;
      badge.textContent = l.code;
      const name = document.createElement("span");
      name.textContent = l.label.replace(/ Line$/, "");
      chip.append(badge, name);
      chip.addEventListener("click", () => {
        const next = new Set(hidden);
        if (shown) next.add(l.id);
        else next.delete(l.id);
        change(next);
      });
      return chip;
    });
    const all = document.createElement("button");
    all.type = "button";
    all.className = "lines-all";
    all.textContent = "All";
    all.disabled = lines.every((l) => !hidden.has(l.id));
    all.addEventListener("click", () => change(new Set([...hidden].filter((id) => !lines.some((l) => l.id === id)))));
    const none = document.createElement("button");
    none.type = "button";
    none.className = "lines-all";
    none.textContent = "None";
    none.disabled = lines.every((l) => hidden.has(l.id));
    none.addEventListener("click", () => change(new Set([...hidden, ...lines.map((l) => l.id)])));
    const foot = document.createElement("div");
    foot.className = "lines-foot";
    foot.append(all, none);
    const list = document.createElement("div");
    list.className = "lines-list";
    list.append(...chips);
    panel.replaceChildren(list, foot);
  }

  return {
    onAdd: () => root,
    onRemove: () => root.remove(),
    setLines(next) {
      lines = next;
      root.hidden = lines.length === 0;
      if (lines.length === 0) open(false);
      else if (!panel.hidden) render();
    },
    setHidden(next) {
      hidden = new Set(next);
      if (!panel.hidden) render();
    },
  };
}
