/** Small helpers for the toggle-button "chip" controls used throughout the UI. */

export interface ChipOptions {
  pressed?: boolean;
  /** A colour swatch dot before the label (layer chips). */
  color?: string;
  onClick?: () => void;
  className?: string;
}

export function chip(label: string, opts: ChipOptions = {}): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.className = `chip${opts.className ? ` ${opts.className}` : ""}`;
  if (opts.pressed !== undefined) b.setAttribute("aria-pressed", String(opts.pressed));
  if (opts.color) {
    const dot = document.createElement("span");
    dot.className = "chip-dot";
    dot.style.background = opts.color;
    b.append(dot);
  }
  const text = document.createElement("span");
  text.textContent = label;
  b.append(text);
  if (opts.onClick) b.addEventListener("click", opts.onClick);
  return b;
}

/** A static (non-button) chip for displaying a value on a row. */
export function tag(label: string, className = "tag"): HTMLSpanElement {
  const s = document.createElement("span");
  s.className = className;
  s.textContent = label;
  return s;
}
