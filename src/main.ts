import "./style.css";
import { registerServiceWorker } from "./offline/register.ts";
import { mountApp } from "./ui/app.ts";

const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("#app missing from index.html");

const ui = mountApp(app);
registerServiceWorker(ui.offerUpdate);

// iOS ignores user-scalable=no in some contexts; its proprietary gesture
// events are the reliable hook. Pinches that start on the map stay the
// map's (MapLibre handles them); anywhere else they're swallowed.
for (const type of ["gesturestart", "gesturechange", "gestureend"]) {
  document.addEventListener(
    type,
    (e) => {
      if (!(e.target as HTMLElement | null)?.closest(".map-pane")) e.preventDefault();
    },
    { passive: false },
  );
}
