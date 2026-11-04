/**
 * A slide-up panel over the page. Plain fixed elements with a class
 * toggle rather than <dialog>, whose focus trapping and scroll locking
 * misbehave in iOS WebKit. Only one sheet is open at a time.
 */
export interface Sheet {
  body: HTMLElement;
  open(): void;
  close(): void;
  isOpen(): boolean;
}

const openSheets = new Set<Sheet>();

// Escape closes whatever is open; registered once for all sheets.
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") for (const s of openSheets) s.close();
});

export function createSheet(root: HTMLElement, title: string, onOpen?: () => void): Sheet {
  const backdrop = document.createElement("div");
  backdrop.className = "sheet-backdrop";

  const aside = document.createElement("aside");
  aside.className = "sheet";
  aside.setAttribute("role", "dialog");
  aside.setAttribute("aria-label", title);
  aside.innerHTML = `
    <div class="sheet-head">
      <h2></h2>
      <button type="button" class="sheet-close">Done</button>
    </div>
    <div class="sheet-body"></div>
  `;
  aside.querySelector("h2")!.textContent = title;
  root.append(backdrop, aside);

  const body = aside.querySelector<HTMLElement>(".sheet-body")!;
  let isOpen = false;

  const sheet: Sheet = {
    body,
    isOpen: () => isOpen,
    open() {
      for (const other of openSheets) other.close();
      isOpen = true;
      openSheets.add(sheet);
      backdrop.classList.add("is-open");
      aside.classList.add("is-open");
      document.body.classList.add("sheet-open");
      onOpen?.();
    },
    close() {
      if (!isOpen) return;
      isOpen = false;
      openSheets.delete(sheet);
      backdrop.classList.remove("is-open");
      aside.classList.remove("is-open");
      if (openSheets.size === 0) document.body.classList.remove("sheet-open");
    },
  };

  backdrop.addEventListener("click", sheet.close);
  aside.querySelector(".sheet-close")!.addEventListener("click", sheet.close);
  return sheet;
}
