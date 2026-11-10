/**
 * Pin images for the map-layer renderer (docs/proposals/webgl-pins.md):
 * one image per (icon, badge) pair, drawn to look like the bare DOM pins:
 * the art, the badge in the upper right, and the pin's drop shadow baked
 * in. Every pin with that pair shares the image.
 *
 * The canvases are kept in main memory (`willReadFrequently`): MapLibre
 * needs the pixels back, and reading them off a GPU-backed canvas stalls,
 * 2.8 ms an image against 0.2 ms (measured 2026-11-10). Safari honours
 * the flag from iOS 18; an older iPhone ignores it and is only slower.
 */

/** Sizes in CSS px, as `.dom-pin--bare`: a 1.9rem pin with a 0.95rem badge 0.3rem over its corner. */
export const PIN_PX = 30;
export const BADGE_PX = 15;
const BADGE_OVERHANG_PX = 5;
/**
 * Room on every side, for the badge's overhang and the shadow's reach,
 * so the art stays centred on the image and so on the place.
 */
const MARGIN_PX = 5;
/** The pin's CSS `drop-shadow(0 1px 2px rgba(0, 0, 0, 0.45))`. Canvas and CSS both blur with σ = blur / 2. */
const SHADOW = { dy: 1, blur: 2, color: "rgba(0, 0, 0, 0.45)" };
/** The badge's CSS `drop-shadow(0 0 1px <background>)`: a thin halo that parts it from the art. */
const HALO_BLUR = 1;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PinArtLayout {
  /** The square image's side, in device pixels. */
  size: number;
  art: Box;
  badge: Box;
  shadow: { dy: number; blur: number };
  haloBlur: number;
}

/** Where everything goes in a pin image at a pixel ratio, in device pixels. The art is fitted like `object-fit: contain`. */
export function pinArtLayout(pixelRatio: number, artAspect = 1): PinArtLayout {
  const pr = pixelRatio;
  const size = Math.round((PIN_PX + 2 * MARGIN_PX) * pr);
  const pin = PIN_PX * pr;
  const origin = (size - pin) / 2;
  const aspect = Number.isFinite(artAspect) && artAspect > 0 ? artAspect : 1;
  const w = aspect >= 1 ? pin : pin * aspect;
  const h = aspect >= 1 ? pin / aspect : pin;
  const b = BADGE_PX * pr;
  return {
    size,
    art: { x: origin + (pin - w) / 2, y: origin + (pin - h) / 2, w, h },
    badge: { x: origin + pin + BADGE_OVERHANG_PX * pr - b, y: origin - BADGE_OVERHANG_PX * pr, w: b, h: b },
    shadow: { dy: SHADOW.dy * pr, blur: SHADOW.blur * pr },
    haloBlur: HALO_BLUR * pr,
  };
}

/** The pixel ratio to draw at: the device's, rounded, between 1 and 3 (the iPhone is 3). */
export function pinPixelRatio(devicePixelRatio = globalThis.devicePixelRatio ?? 1): number {
  return Math.min(3, Math.max(1, Math.round(devicePixelRatio || 1)));
}

type Context = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

/** Two reusable scratch canvases per size: the pin is composed on one, then drawn onto the other with its shadow. */
const scratch = new Map<number, [Context, Context]>();

function canvasContext(size: number): Context {
  const ctx =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(size, size).getContext("2d", { willReadFrequently: true })
      : Object.assign(document.createElement("canvas"), { width: size, height: size }).getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2d canvas unavailable");
  return ctx;
}

function scratchPair(size: number): [Context, Context] {
  let pair = scratch.get(size);
  if (!pair) {
    pair = [canvasContext(size), canvasContext(size)];
    scratch.set(size, pair);
  }
  return pair;
}

/** A decoded image and its intrinsic size (an SVG without one reports 0, and is drawn square). */
export interface Art {
  image: CanvasImageSource;
  width: number;
  height: number;
}

/**
 * Draw one pin: the art, the badge (if any) with a halo in `halo`, then
 * the whole pin again with its shadow, as the CSS filter on `.dom-pin`
 * shadows the art and the badge together.
 */
export function drawPinArt(art: Art, badge: Art | undefined, pixelRatio: number, halo: string): ImageData {
  const layout = pinArtLayout(pixelRatio, art.width > 0 && art.height > 0 ? art.width / art.height : 1);
  const { size } = layout;
  const [pin, out] = scratchPair(size);

  pin.clearRect(0, 0, size, size);
  pin.drawImage(art.image, layout.art.x, layout.art.y, layout.art.w, layout.art.h);
  if (badge) {
    pin.save();
    pin.shadowColor = halo;
    pin.shadowBlur = layout.haloBlur;
    pin.drawImage(badge.image, layout.badge.x, layout.badge.y, layout.badge.w, layout.badge.h);
    pin.restore();
  }

  out.clearRect(0, 0, size, size);
  out.save();
  out.shadowColor = SHADOW.color;
  out.shadowOffsetY = layout.shadow.dy;
  out.shadowBlur = layout.shadow.blur;
  out.drawImage(pin.canvas, 0, 0);
  out.restore();
  return out.getImageData(0, 0, size, size);
}

/**
 * Load an image file for drawing. The load event, not `decode()`: decode
 * waits for the page to render, so it hangs in a page that isn't drawing
 * (a hidden tab), while drawImage decodes a loaded image on the spot.
 */
export function loadArt(url: string): Promise<Art> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ image, width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error(`could not load ${url}`));
    image.src = url;
  });
}
