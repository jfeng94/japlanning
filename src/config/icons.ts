import type { LayerConfig, Place } from "../data/types.ts";

/**
 * The global icon enum. Sheet rows pick one in their `Icon` column; a
 * layer names one as its default. Each icon has two assets because the
 * two renderers want different drawings: a monochrome silhouette for the
 * SDF symbol layer (tinted per layer at runtime) and full-colour artwork
 * for DOM markers.
 *
 * Adding an icon: drop the files in src/map/icons/{sdf,dom}/ and add a line.
 * The sdf file is a black silhouette on transparent (make one from the
 * artwork's alpha channel); the dom file is the artwork itself.
 */
export const ICONS = {
  coffee: { sdf: "coffee.webp", dom: "coffee.svg" },
  tea: { sdf: "tea.png", dom: "tea.png" },
  bar: { sdf: "bar.png", dom: "bar.png" },
  // Food (2026-11-05), for the restaurant and pastry layers to come.
  cheese: { sdf: "cheese.png", dom: "cheese.png" },
  fork: { sdf: "fork.png", dom: "fork.webp" },
  waffle: { sdf: "waffle.png", dom: "waffle.png" },
  sushi: { sdf: "sushi.png", dom: "sushi.webp" },
  icecream: { sdf: "icecream.png", dom: "icecream.png" },
  fruit: { sdf: "fruit.png", dom: "fruit.webp" },
  pastry: { sdf: "pastry.png", dom: "pastry.png" },
  meat: { sdf: "meat.png", dom: "meat.png" },
  strawberry: { sdf: "strawberry.png", dom: "strawberry.png" },
  mushroom: { sdf: "mushroom.png", dom: "mushroom.png" },
  soup: { sdf: "soup.png", dom: "soup.webp" },
} as const;

export type IconId = keyof typeof ICONS;

export const ICON_IDS = Object.keys(ICONS) as IconId[];

export function isIconId(s: string): s is IconId {
  return s in ICONS;
}

/** The icon a place renders with: its own if set and known, else its layer's. */
export function iconFor(place: Pick<Place, "icon">, layer: Pick<LayerConfig, "icon">): IconId {
  if (place.icon && isIconId(place.icon)) return place.icon;
  return isIconId(layer.icon) ? layer.icon : ICON_IDS[0]!;
}

/** Vite turns these into hashed asset URLs at build time. */
const sdfUrls = import.meta.glob("../map/icons/sdf/*", { eager: true, query: "?url", import: "default" }) as Record<string, string>;
const domUrls = import.meta.glob("../map/icons/dom/*", { eager: true, query: "?url", import: "default" }) as Record<string, string>;

export function iconAssetUrl(id: IconId, kind: "sdf" | "dom"): string {
  const file = ICONS[id][kind];
  const table = kind === "sdf" ? sdfUrls : domUrls;
  const url = table[`../map/icons/${kind}/${file}`];
  if (!url) throw new Error(`icon asset missing: ${kind}/${file}`);
  return url;
}
