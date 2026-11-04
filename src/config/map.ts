/** Map rendering choices. */

export type PinRendererKind = "sdf" | "dom";

/**
 * Default pin renderer; `?pins=sdf` or `?pins=dom` in the URL overrides it
 * for a session. DOM won on looks (M3 acceptance); SDF stays available in
 * case hundreds of markers prove heavy once every layer has pins.
 */
export const PIN_RENDERER: PinRendererKind = "dom";

export function pinRendererKind(search = location.search): PinRendererKind {
  const v = new URLSearchParams(search).get("pins");
  return v === "sdf" || v === "dom" ? v : PIN_RENDERER;
}

/** Zoom from which pin name labels show. */
export const PIN_LABEL_MIN_ZOOM = 14;
