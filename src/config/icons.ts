import type { LayerConfig, Place } from "../data/types.ts";

/**
 * The global icon enum. Sheet rows pick one in their `Icon` column; a
 * layer names one as its default. Each icon is one full-colour artwork
 * file in src/map/icons/, drawn as-is by both pin renderers (the map
 * layer bakes it into its pin images; DOM markers show it as an <img>).
 *
 * Adding an icon: drop the artwork in src/map/icons/ and add a line.
 * (Until 2026-11-10 each icon also needed an SDF silhouette, for a third
 * renderer since removed: docs/proposals/webgl-pins.md, Part 3.)
 */
export const ICONS = {
  coffee: "coffee.svg",
  tea: "tea.png",
  bar: "bar.png",
  // Food (2026-11-05), for the restaurant and pastry layers to come.
  cheese: "cheese.png",
  fork: "fork.webp",
  waffle: "waffle.png",
  sushi: "sushi.webp",
  icecream: "icecream.png",
  fruit: "fruit.webp",
  pastry: "pastry.png",
  meat: "meat.png",
  strawberry: "strawberry.png",
  mushroom: "mushroom.png",
  soup: "soup.webp",
  // Sights, music, shops and lodging (2026-11-09).
  torii: "torii.webp", // shrines and cultural sites
  sozu: "sozu.webp", // gardens and cultural sites
  waterfall: "waterfall.webp", // natural landscapes
  orrery: "orrery.png", // science museums, teamLab
  bingbong: "bingbong.png", // generic fun attractions
  dice: "dice.webp", // board games
  fiddle: "fiddle.webp", // concerts
  metronome: "metronome.webp", // music shops
  musicbox: "musicbox.webp", // listening cafés
  pen: "pen.png", // stationery
  tent: "tent.png", // lodging
  // A place still waiting for fitting artwork: grep the data for ",question," to find them.
  question: "question.png",
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
const urls = import.meta.glob("../map/icons/*", { eager: true, query: "?url", import: "default" }) as Record<string, string>;

/** The artwork's URL in the built site. */
export function iconAssetUrl(id: IconId): string {
  const file = ICONS[id];
  const url = urls[`../map/icons/${file}`];
  if (!url) throw new Error(`icon asset missing: ${file}`);
  return url;
}
