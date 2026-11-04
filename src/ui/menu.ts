/** A small popover menu under an anchor button. One open at a time; closes on pick, outside tap or Escape. */

export interface MenuItem {
  label: string;
  selected?: boolean;
  /** Draw a divider above this item. */
  separator?: boolean;
  onPick: () => void;
}

export interface Menu {
  toggle(): void;
  close(): void;
}

let openMenu: Menu | undefined;

export function createMenu(anchor: HTMLElement, items: () => MenuItem[]): Menu {
  const el = document.createElement("div");
  el.className = "menu";
  el.setAttribute("role", "menu");
  el.hidden = true;
  anchor.insertAdjacentElement("afterend", el);
  anchor.setAttribute("aria-haspopup", "menu");
  anchor.setAttribute("aria-expanded", "false");

  const menu: Menu = {
    toggle() {
      if (el.hidden) open();
      else menu.close();
    },
    close() {
      if (el.hidden) return;
      el.hidden = true;
      anchor.setAttribute("aria-expanded", "false");
      if (openMenu === menu) openMenu = undefined;
      document.removeEventListener("pointerdown", onOutside, true);
    },
  };

  function open(): void {
    openMenu?.close();
    el.replaceChildren(
      ...items().map((item) => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "menu-item";
        b.setAttribute("role", "menuitem");
        if (item.selected) b.setAttribute("aria-current", "true");
        if (item.separator) b.classList.add("menu-item--separated");
        b.textContent = item.label;
        b.addEventListener("click", () => {
          menu.close();
          item.onPick();
        });
        return b;
      }),
    );
    el.hidden = false;
    anchor.setAttribute("aria-expanded", "true");
    openMenu = menu;
    // Capture phase so a tap on the anchor itself doesn't immediately reopen.
    document.addEventListener("pointerdown", onOutside, true);
  }

  function onOutside(e: PointerEvent): void {
    const t = e.target as Node;
    if (!el.contains(t) && !anchor.contains(t)) menu.close();
  }

  anchor.addEventListener("click", menu.toggle);
  return menu;
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") openMenu?.close();
});
