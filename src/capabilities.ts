/**
 * Read-only probe of the web-platform features later milestones depend on.
 * Nothing here triggers a permission prompt; it only checks that the APIs
 * exist and, for storage, asks the browser for its quota estimate.
 */

export interface Capability {
  label: string;
  value: string;
  ok: boolean | null; // null = informational, no pass/fail
}

function isStandalone(): boolean {
  // Standard media query, plus the old iOS-only property for older WebKit.
  const mq = window.matchMedia?.("(display-mode: standalone)").matches ?? false;
  const ios = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return mq || ios;
}

function formatBytes(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} GB`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(0)} MB`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)} kB`;
  return `${n} B`;
}

async function probe(): Promise<Capability[]> {
  const caps: Capability[] = [];

  const standalone = isStandalone();
  caps.push({
    label: "Standalone (installed app)",
    value: standalone ? "yes" : "no, running in a browser tab",
    ok: standalone,
  });

  const sw = "serviceWorker" in navigator;
  caps.push({ label: "Service worker API", value: sw ? "present" : "missing", ok: sw });

  const geo = "geolocation" in navigator;
  caps.push({ label: "Geolocation API", value: geo ? "present" : "missing", ok: geo });

  const clip = typeof navigator.clipboard?.writeText === "function";
  caps.push({ label: "Clipboard writeText", value: clip ? "present" : "missing", ok: clip });

  const idb = "indexedDB" in window;
  caps.push({ label: "IndexedDB", value: idb ? "present" : "missing", ok: idb });

  const cache = "caches" in window;
  caps.push({ label: "Cache Storage", value: cache ? "present" : "missing", ok: cache });

  const persistApi = typeof navigator.storage?.persist === "function";
  let persisted: boolean | undefined;
  if (typeof navigator.storage?.persisted === "function") {
    try {
      persisted = await navigator.storage.persisted();
    } catch {
      /* leave unknown */
    }
  }
  caps.push({
    label: "Persistent storage",
    value: !persistApi ? "API missing" : persisted === undefined ? "state unknown" : persisted ? "granted" : "not granted yet (asked on the first map download)",
    ok: persistApi && persisted !== false ? persistApi : null,
  });

  if (typeof navigator.storage?.estimate === "function") {
    try {
      const { quota, usage } = await navigator.storage.estimate();
      caps.push({
        label: "Browser storage estimate",
        value: `${formatBytes(usage ?? 0)} used of ${formatBytes(quota ?? 0)} (WebKit may leave IndexedDB Blobs out; the app's own figure is below)`,
        ok: null,
      });
    } catch (e) {
      caps.push({ label: "Storage estimate", value: `error: ${String(e)}`, ok: false });
    }
  } else {
    caps.push({ label: "Storage estimate", value: "API missing", ok: false });
  }

  caps.push({ label: "Secure context (HTTPS)", value: window.isSecureContext ? "yes" : "no", ok: window.isSecureContext });
  caps.push({ label: "Time zone", value: Intl.DateTimeFormat().resolvedOptions().timeZone, ok: null });
  caps.push({ label: "User agent", value: navigator.userAgent, ok: null });

  return caps;
}

export async function renderCapabilities(target: HTMLDListElement, extra?: () => Promise<Capability[]>): Promise<void> {
  const caps = [...(await probe()), ...(extra ? await extra() : [])];
  target.replaceChildren(
    ...caps.flatMap(({ label, value, ok }) => {
      const dt = document.createElement("dt");
      dt.textContent = label;
      const dd = document.createElement("dd");
      dd.textContent = value;
      if (ok !== null) dd.dataset["ok"] = String(ok);
      return [dt, dd];
    }),
  );
}
