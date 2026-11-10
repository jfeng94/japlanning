/**
 * Basemap extract settings. Bumping `build` is a deliberate commit; the
 * Protomaps daily builds are listed at https://build-metadata.protomaps.dev/builds.json.
 * Size experiment (docs/proposals/m3-map.md): Tokyo at maxzoom 15 is 52 MB.
 *
 * The archives live on their own site (docs/proposals/maps-site.md),
 * published by the jfeng94/japlanning-maps repo's workflow from this
 * config; the app's deploys carry no maps. Protomaps keeps about a week of
 * daily builds, and the maps workflow copies each archive from the maps
 * site while `build`, `maxzoom` and its bbox are unchanged, so an old pin
 * is fine until one of them changes. Then set `build` to a current one in
 * the same commit and publish the maps; every region is extracted again
 * and installed apps download their maps again.
 */
export const BASEMAP = {
  /** Protomaps planet build, YYYYMMDD. */
  build: "20261103",
  /** Where the archives and their version files are served: the maps site. */
  site: "https://jfeng94.github.io/japlanning-maps",
  /**
   * Map assets mirrored into the site for offline use (M7): the glyph
   * ranges the style's Latin labels need (Japanese comes from the device's
   * own fonts) and the sprite sheets. Verified against
   * src/config/assets-lock.json; PIN_ASSETS=1 rewrites the lock.
   */
  assets: {
    base: "https://protomaps.github.io/basemaps-assets",
    fonts: ["Noto Sans Regular", "Noto Sans Medium", "Noto Sans Italic"],
    ranges: ["0-255", "256-511", "512-767", "768-1023"],
    spriteVersion: "v4",
    sprites: ["light", "dark"],
  },
  /** Max tile zoom in the extract; MapLibre overzooms beyond it. */
  maxzoom: 15,
  /** The pmtiles CLI used to extract. Archives are pinned by SHA-256; unlisted platforms are refused. */
  cli: {
    version: "1.31.2",
    assets: {
      "win32-x64": {
        file: "go-pmtiles_1.31.2_Windows_x86_64.zip",
        sha256: "a658baa4d7e55020aef6ca17bd9ff9faa1582671266b36f58c52db0ac8e785a1",
      },
      "linux-x64": {
        file: "go-pmtiles_1.31.2_Linux_x86_64.tar.gz",
        sha256: "3ed7dbf4ec2e6dfe5e25b6f70d1ffc932729f93c86db353bf514dd71010a312f",
      },
    } as Record<string, { file: string; sha256: string } | undefined>,
  },
} as const;

/** What an archive was made from: its version file (`<region>.pmtiles.json`) on the maps site, and what a phone stores with it. */
export interface BasemapVersion {
  build: string;
  maxzoom: number;
  bbox: readonly [number, number, number, number];
}

/** The version an archive for this bbox must have, from the config. */
export function versionFor(bbox: readonly [number, number, number, number]): BasemapVersion {
  return { build: BASEMAP.build, maxzoom: BASEMAP.maxzoom, bbox };
}

/** Same build, zoom and bbox. Tolerates extra fields in what a server sent. */
export function sameVersion(a: BasemapVersion | undefined, b: BasemapVersion | undefined): boolean {
  return (
    a !== undefined &&
    b !== undefined &&
    a.build === b.build &&
    a.maxzoom === b.maxzoom &&
    Array.isArray(a.bbox) &&
    a.bbox.length === 4 &&
    a.bbox.every((v, i) => v === b.bbox[i])
  );
}

/** A short form for URLs: a changed map gets a new address, so nothing cached for the old one is mixed in. */
export function versionTag(v: BasemapVersion): string {
  return `${v.build}-${v.maxzoom}-${v.bbox.join(",")}`;
}

/** The maps site's address for a region's archive; its version file is this without the query, plus ".json". */
export function archiveUrl(regionId: string, bbox?: readonly [number, number, number, number]): string {
  const base = `${BASEMAP.site}/${regionId}.pmtiles`;
  return bbox ? `${base}?v=${encodeURIComponent(versionTag(versionFor(bbox)))}` : base;
}

/** The version file's address for an archive address from archiveUrl. */
export function versionFileUrl(archive: string): string {
  return `${archive.replace(/\?.*$/, "")}.json`;
}
