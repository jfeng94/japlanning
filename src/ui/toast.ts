/** A one-line confirmation above the panel that fades after a moment; optionally tappable. */

let el: HTMLElement | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;
let action: (() => void) | undefined;

export interface ToastOptions {
  /** Makes the toast a tap target; the toast hides on the tap. */
  onClick?: () => void;
}

export function showToast(text: string, ms = 1500, opts: ToastOptions = {}): void {
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    el.setAttribute("role", "status");
    el.addEventListener("click", () => {
      const run = action;
      el?.classList.remove("is-visible");
      action = undefined;
      run?.();
    });
    document.body.append(el);
  }
  el.textContent = text;
  action = opts.onClick;
  el.classList.toggle("has-action", action !== undefined);
  el.classList.add("is-visible");
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => el?.classList.remove("is-visible"), ms);
}
