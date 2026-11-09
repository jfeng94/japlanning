import {
  coerceSetting,
  resetSettings,
  settings,
  settingsChanged,
  updateSettings,
  type Settings,
} from "../config/settings.ts";
import { chip } from "./chips.ts";

interface Field<K extends keyof Settings> {
  key: K;
  label: string;
  help?: string;
  options: [value: Settings[K], label: string][];
  /** Hide unless this returns true for the current settings. */
  when?: (s: Settings) => boolean;
}

/** One entry per setting. Dropdowns; the value types come from settings.ts. */
const FIELDS: Field<keyof Settings>[] = [
  {
    key: "location",
    label: "Location",
    help: "On shows the map's locate button; the phone asks for permission the first time you tap it. Off hides the button and stops using your position.",
    options: [
      [true, "On"],
      [false, "Off"],
    ],
  },
  {
    key: "autoDownloadMaps",
    label: "Download maps automatically",
    help: "On: each region's map (about 50 MB for Tokyo) downloads once on an online launch, and again only when a newer one is published. Off to wait for Wi-Fi and use the buttons below.",
    options: [
      [true, "On"],
      [false, "Off"],
    ],
  },
  {
    key: "autoDistanceSort",
    label: "Sort by distance when located",
    help: "On: the first fix after launch switches the list to Nearest. Off while planning from home, on during the trip. The list's own order toggle is in the footer, bottom left.",
    options: [
      [false, "Off"],
      [true, "On"],
    ],
  },
  {
    key: "pinRenderer",
    label: "Pin renderer",
    help: "DOM markers are styled with CSS and full-colour artwork. SDF symbols are tinted silhouettes drawn by the map, lighter with hundreds of pins.",
    options: [
      ["dom", "DOM markers"],
      ["sdf", "SDF symbols"],
    ],
  },
  {
    key: "pinStyle",
    label: "Pin style",
    help: "Bare shows the artwork alone with a shadow; disc puts it on a white circle with the layer colour as a ring.",
    options: [
      ["bare", "Bare artwork"],
      ["disc", "Artwork on a disc"],
    ],
    when: (s) => s.pinRenderer === "dom",
  },
  {
    key: "pinLabelMinZoom",
    label: "Pin names from zoom",
    help: "Lower shows names sooner; 20 is effectively never.",
    options: [
      [12, "12 (district)"],
      [13, "13"],
      [14, "14 (default)"],
      [15, "15"],
      [16, "16 (street)"],
      [20, "Never"],
    ],
  },
  {
    key: "showAreaShapes",
    label: "Area shapes on the map",
    help: "Draws each area's shape, made from the census, over the map, to check them before the Area map uses them. Here already goes by them.",
    options: [
      [false, "Off"],
      [true, "On"],
    ],
  },
];

export interface SettingsSheetHandlers {
  /** Fires after every save with the new settings. */
  onChange: (s: Settings) => void;
  onDiagnostics: () => void;
  /** Renders the Offline section (M7) into the given container. */
  renderOffline?: (container: HTMLElement) => void;
}

/**
 * Reload the app from scratch: drop any service-worker-cached shell
 * (none until M7) and Cache Storage, fetch the page itself straight from
 * the network (GitHub Pages serves it with a 10-minute cache lifetime
 * that a plain reload in an installed app can honour), then reload. The
 * IndexedDB data cache is data, not app, and is left alone.
 */
async function reloadFromScratch(): Promise<void> {
  try {
    if ("serviceWorker" in navigator) {
      for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
    }
    if ("caches" in window) {
      for (const key of await caches.keys()) await caches.delete(key);
    }
    // "reload" bypasses the HTTP cache and replaces the cached copy with what comes back.
    await fetch(location.pathname, { cache: "reload" });
  } catch {
    /* offline or blocked: a plain reload is still better than nothing */
  } finally {
    location.reload();
  }
}

/** Render the settings sheet body. */
export function renderSettingsSheet(body: HTMLElement, handlers: SettingsSheetHandlers): void {
  const { onChange } = handlers;
  const s = settings();
  body.replaceChildren();

  const intro = document.createElement("p");
  intro.className = "note";
  intro.textContent = "Saved on this device; a link with the same option in its URL overrides the saved value.";
  body.append(intro);

  for (const field of FIELDS) {
    if (field.when && !field.when(s)) continue;
    const row = document.createElement("label");
    row.className = "setting";
    const title = document.createElement("span");
    title.className = "setting-label";
    title.textContent = field.label;
    const select = document.createElement("select");
    select.className = "setting-select";
    for (const [value, label] of field.options) {
      const opt = document.createElement("option");
      opt.value = String(value);
      opt.textContent = label;
      opt.selected = s[field.key] === value;
      select.append(opt);
    }
    select.addEventListener("change", () => {
      const next = updateSettings({ [field.key]: coerceSetting(field.key, select.value) } as Partial<Settings>);
      renderSettingsSheet(body, handlers);
      onChange(next);
    });
    row.append(title, select);
    if (field.help) {
      const help = document.createElement("span");
      help.className = "setting-help";
      help.textContent = field.help;
      row.append(help);
    }
    body.append(row);
  }

  if (handlers.renderOffline) {
    const offline = document.createElement("section");
    offline.className = "offline-section";
    handlers.renderOffline(offline);
    body.append(offline);
  }

  const actions = document.createElement("div");
  actions.className = "sheet-actions sheet-actions--wrap";
  if (settingsChanged(s)) {
    actions.append(
      chip("Reset to defaults", {
        className: "clear",
        onClick: () => {
          const next = resetSettings();
          renderSettingsSheet(body, handlers);
          onChange(next);
        },
      }),
    );
  }
  actions.append(
    chip("Diagnostics", { onClick: handlers.onDiagnostics }),
    chip("Reload app", { onClick: () => void reloadFromScratch() }),
  );
  body.append(actions, credits());
}

/** Where the map and the area shapes come from; e-Stat's terms ask for the source and a note that it was processed. */
function credits(): HTMLParagraphElement {
  const p = document.createElement("p");
  p.className = "note credits";
  const link = (text: string, href: string) => {
    const a = document.createElement("a");
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = text;
    return a;
  };
  p.append(
    "Map data ",
    link("© OpenStreetMap contributors", "https://www.openstreetmap.org/copyright"),
    ". Area shapes processed from the 2020 census boundaries (「国勢調査 境界データ」, Statistics Bureau of Japan), via ",
    link("e-Stat", "https://www.e-stat.go.jp/"),
    ".",
  );
  return p;
}
