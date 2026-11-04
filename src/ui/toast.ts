/** A one-line confirmation above the panel that fades after a moment. */

let el: HTMLElement | undefined;
let timer: ReturnType<typeof setTimeout> | undefined;

export function showToast(text: string, ms = 1500): void {
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    el.setAttribute("role", "status");
    document.body.append(el);
  }
  el.textContent = text;
  el.classList.add("is-visible");
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => el?.classList.remove("is-visible"), ms);
}
