/**
 * Register the service worker (built sites only: the dev server has no
 * sw.js, and caching there would hide edits) and surface updates. When a
 * new worker has installed and is waiting, `onUpdateReady` gets the way
 * to apply it (the header's update button); applying tells the worker to
 * take over, and the page reloads once it has.
 */
export function registerServiceWorker(onUpdateReady: (apply: () => void) => void): void {
  if (!("serviceWorker" in navigator) || !import.meta.env.PROD) return;

  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });

  void navigator.serviceWorker
    .register("/sw.js")
    .then((reg) => {
      const offer = (worker: ServiceWorker) => onUpdateReady(() => worker.postMessage({ type: "SKIP_WAITING" }));
      // Already waiting from an earlier visit.
      if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const next = reg.installing;
        if (!next) return;
        next.addEventListener("statechange", () => {
          // "installed" with a controller means an update (the first install has no controller yet).
          if (next.state === "installed" && navigator.serviceWorker.controller) offer(next);
        });
      });
      // Look for a newer build whenever the app comes back to the foreground.
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") void reg.update();
      });
    })
    .catch(() => {
      /* registration failing (private mode, a blocked script) leaves the app online-only, as before */
    });
}
