/**
 * Does the maps site serve the maps this commit expects?
 * (docs/proposals/maps-site.md)
 *
 *   node scripts/check-maps.ts      (npm run check-maps; the app's deploy runs it)
 *
 * For every region with a bbox, fetch its version file from the maps site
 * and compare it with this commit's config (build, zoom, bbox). A phone
 * labels a downloaded map with the version its app expects, so an app
 * that expects a map the maps site doesn't have yet would let phones store
 * the old map under the new label. The app also checks before each
 * download; this stops such an app from shipping at all. On a mismatch it
 * says which workflow to run.
 */

import { archiveUrl, sameVersion, versionFileUrl, versionFor, versionTag, type BasemapVersion } from "../src/config/basemap.ts";
import { regions } from "../src/config/regions.ts";

const UA = "japlanning-build/1.0 (+https://japan.garbage.house)";

let bad = 0;
for (const region of regions.filter((r) => r.bbox)) {
  const want = versionFor(region.bbox!);
  const url = versionFileUrl(archiveUrl(region.id));
  let have: BasemapVersion | undefined;
  let why = "";
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.ok) have = (await res.json()) as BasemapVersion;
    else why = `HTTP ${res.status}`;
  } catch (e) {
    why = e instanceof Error ? e.message : String(e);
  }
  if (sameVersion(have, want)) {
    console.log(`${region.id}: published (${versionTag(want)})`);
  } else {
    bad++;
    console.error(`${region.id}: the maps site has ${have ? versionTag(have) : `nothing (${why})`}; this commit expects ${versionTag(want)}`);
  }
}
if (bad > 0) {
  console.error(
    "Publish the maps first, then run this deploy again:\n" +
      "  gh workflow run maps.yml -R jfeng94/japlanning-maps -f ref=<this commit>\n" +
      "(docs/design/adding-places.md, \"Changing a map box\")",
  );
  process.exit(1);
}
