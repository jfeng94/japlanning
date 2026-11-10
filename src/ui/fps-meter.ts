import type { Map as MapLibreMap } from "maplibre-gl";

/**
 * `?fps=1`: a readout in the map's corner of how smoothly the last move
 * drew, for comparing pin renderers on the phone
 * (docs/proposals/webgl-pins.md). It counts the map's rendered frames
 * from the start of a pan, zoom or pinch to its end and shows frames per
 * second and the slowest frame. Updated when a move ends, so it doesn't
 * add work while measuring. Off, it isn't created at all.
 */
export function mountFpsMeter(map: MapLibreMap): void {
  const el = document.createElement("div");
  el.className = "fps-meter";
  el.textContent = "fps: move the map";
  map.getContainer().append(el);

  let moving = false;
  let frames = 0;
  let start = 0;
  let last = 0;
  let slowest = 0;
  map.on("movestart", () => {
    moving = true;
    frames = 0;
    slowest = 0;
    start = last = performance.now();
  });
  map.on("render", () => {
    if (!moving) return;
    const now = performance.now();
    frames++;
    slowest = Math.max(slowest, now - last);
    last = now;
  });
  map.on("moveend", () => {
    moving = false;
    const seconds = (last - start) / 1000;
    if (frames < 2 || seconds <= 0) return; // a jump, not a move
    el.textContent = `${Math.round(frames / seconds)} fps · slowest ${Math.round(slowest)} ms · ${frames} frames`;
  });
}
