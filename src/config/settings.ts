/**
 * User-adjustable settings: experiments (renderers, looks) and
 * preferences (sort). Resolved in this order: built-in default, then
 * what the Settings sheet saved to localStorage, then a URL parameter,
 * so a comparison link always shows what it says and a Home Screen
 * bookmark never has to change. Adding a setting: one entry here, one
 * line in src/ui/settings-sheet.ts.
 */

import { DEFAULT_NEARBY_M, NEARBY_STOPS } from "../geo/nearby.ts";

export type PinRendererKind = "dom" | "sdf";
export type PinStyle = "disc" | "bare";
export type SortKey = "name" | "distance";

export interface Settings {
  /** Use the device's position: shows the locate button; off also stops any watch. Never prompts by itself. */
  location: boolean;
  /** Download each region's basemap on an online launch when missing or outdated (M7). Off: Settings → Offline by hand. */
  autoDownloadMaps: boolean;
  pinRenderer: PinRendererKind;
  pinStyle: PinStyle;
  /** Zoom from which pin name labels show. */
  pinLabelMinZoom: number;
  /** List order. Distance needs a fix; without one the list falls back to names. */
  sort: SortKey;
  /** Switch to distance order on the first fix after launch. Off while planning from home. */
  autoDistanceSort: boolean;
  /** Nearby's radius in metres, set by its slider and remembered here; one of NEARBY_STOPS. */
  nearbyM: number;
  /** Draw the area shapes over the map, for reviewing them (Part 2 of the filter-pages proposal). */
  showAreaShapes: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  location: true,
  autoDownloadMaps: true,
  pinRenderer: "dom",
  pinStyle: "bare",
  pinLabelMinZoom: 14,
  sort: "name",
  autoDistanceSort: false,
  nearbyM: DEFAULT_NEARBY_M,
  showAreaShapes: false,
};

/** URL parameter names, kept short for sharing. */
const URL_KEYS: Record<keyof Settings, string> = {
  location: "location",
  autoDownloadMaps: "automaps",
  pinRenderer: "pins",
  pinStyle: "pinstyle",
  pinLabelMinZoom: "labelzoom",
  sort: "sort",
  autoDistanceSort: "autosort",
  nearbyM: "radius",
  showAreaShapes: "shapes",
};

const STORAGE_KEY = "japlanning.settings";

const VALID: { [K in keyof Settings]: (v: unknown) => v is Settings[K] } = {
  location: (v): v is boolean => typeof v === "boolean",
  autoDownloadMaps: (v): v is boolean => typeof v === "boolean",
  pinRenderer: (v): v is PinRendererKind => v === "dom" || v === "sdf",
  pinStyle: (v): v is PinStyle => v === "disc" || v === "bare",
  pinLabelMinZoom: (v): v is number => typeof v === "number" && v >= 0 && v <= 20,
  sort: (v): v is SortKey => v === "name" || v === "distance",
  autoDistanceSort: (v): v is boolean => typeof v === "boolean",
  nearbyM: (v): v is number => typeof v === "number" && (NEARBY_STOPS as readonly number[]).includes(v),
  showAreaShapes: (v): v is boolean => typeof v === "boolean",
};

/** A URL parameter or `<select>` value as the setting's own type; validated by the caller. */
export function coerceSetting(key: keyof Settings, raw: string): unknown {
  const kind = typeof DEFAULT_SETTINGS[key];
  if (kind === "number") return Number(raw);
  if (kind === "boolean") return raw === "1" || raw === "true";
  return raw;
}

let current: Settings | undefined;

export function settings(): Settings {
  return (current ??= resolve());
}

/** Save a change; returns the new settings. The URL override for that key is dropped so the saved value shows. */
export function updateSettings(patch: Partial<Settings>): Settings {
  const saved = { ...readStorage(), ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    /* storage blocked: the change still applies for this session */
  }
  const params = new URLSearchParams(location.search);
  for (const key of Object.keys(patch) as (keyof Settings)[]) params.delete(URL_KEYS[key]);
  const q = params.toString();
  history.replaceState(history.state, "", q ? `${location.pathname}?${q}` : location.pathname);
  current = resolve();
  return current;
}

export function resetSettings(): Settings {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  current = resolve();
  return current;
}

/** True when any value differs from the defaults. */
export function settingsChanged(s: Settings = settings()): boolean {
  return (Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]).some((k) => s[k] !== DEFAULT_SETTINGS[k]);
}

function resolve(search = location.search): Settings {
  const out: Settings = { ...DEFAULT_SETTINGS, ...readStorage() };
  const params = new URLSearchParams(search);
  for (const key of Object.keys(URL_KEYS) as (keyof Settings)[]) {
    const raw = params.get(URL_KEYS[key]);
    if (raw === null) continue;
    const v = coerceSetting(key, raw);
    if (VALID[key](v)) (out as unknown as Record<string, unknown>)[key] = v;
  }
  return out;
}

function readStorage(): Partial<Settings> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Partial<Settings> = {};
    for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
      const v = parsed[key];
      if (VALID[key](v)) (out as unknown as Record<string, unknown>)[key] = v;
    }
    return out;
  } catch {
    return {};
  }
}
