import {
  DEFAULT_SETTINGS,
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

/** One entry per setting under test. Dropdowns; the value types come from settings.ts. */
const FIELDS: Field<keyof Settings>[] = [
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
];

export interface SettingsSheetHandlers {
  /** Fires after every save with the new settings. */
  onChange: (s: Settings) => void;
  onDiagnostics: () => void;
}

/**
 * Reload the app from scratch: drop any service-worker-cached shell
 * (none until M7) and Cache Storage, then reload. The IndexedDB data
 * cache is data, not app, and is left alone.
 */
async function reloadFromScratch(): Promise<void> {
  try {
    if ("serviceWorker" in navigator) {
      for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister();
    }
    if ("caches" in window) {
      for (const key of await caches.keys()) await caches.delete(key);
    }
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
  intro.textContent = "Experiments. Saved on this device; a link with the same option in its URL overrides the saved value.";
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
      const raw = select.value;
      const value = typeof DEFAULT_SETTINGS[field.key] === "number" ? Number(raw) : raw;
      const next = updateSettings({ [field.key]: value } as Partial<Settings>);
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
  body.append(actions);
}
