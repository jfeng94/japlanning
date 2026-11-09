/**
 * Test helper: every layer's real data file (data/<id>.csv, the source of
 * truth), parsed the way the build checks it, icons included. Tests that
 * hold the data to the config (areas, shapes, the map box) read it here,
 * so a new layer is checked without touching them.
 */
import { ICON_IDS } from "../config/icons.ts";
import { layers } from "../config/layers.ts";
import { regionOptions } from "../config/regions.ts";
import { parseLayerCsv } from "./parse.ts";
import type { LayerConfig, ParseResult, Place } from "./types.ts";

const files = import.meta.glob("../../data/*.csv", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

/** A layer's data file as text; throws when the layer has none. */
export function repoCsv(layerId: string): string {
  const text = files[`../../data/${layerId}.csv`];
  if (text === undefined) throw new Error(`data/${layerId}.csv is missing`);
  return text;
}

export const repoData: { layer: LayerConfig; result: ParseResult }[] = layers.map((layer) => ({
  layer,
  result: parseLayerCsv(repoCsv(layer.id), layer, { ...regionOptions(), icons: ICON_IDS }),
}));

export const repoPlaces: Place[] = repoData.flatMap((d) => d.result.places);
