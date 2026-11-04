/**
 * Signed distance fields for MapLibre icons.
 *
 * A symbol layer can draw an image as an SDF: instead of colours, each
 * pixel stores how far it is from the shape's edge, and the GPU draws a
 * crisp edge at any scale and tints it with `icon-color`. MapLibre
 * expects the field already computed, with the same conventions as its
 * glyphs: an 8 px radius and a 0.25 cutoff, so the edge sits at alpha
 * 0.75. This file turns a plain silhouette into that.
 *
 * The distance transform is Felzenszwalb & Huttenlocher's 1-D squared
 * EDT run over columns then rows, as in Mapbox's tiny-sdf.
 */

export const SDF_RADIUS = 8;
export const SDF_CUTOFF = 0.25;

const INF = 1e20;

/**
 * Coverage (0..1 per pixel, 1 = inside the shape) to RGBA SDF bytes.
 * Inside pixels end up above 191, outside below, fading over `radius`.
 */
export function coverageToSdf(coverage: Float32Array, width: number, height: number, radius = SDF_RADIUS, cutoff = SDF_CUTOFF): Uint8ClampedArray {
  const n = width * height;
  const outer = new Float64Array(n);
  const inner = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = coverage[i]!;
    if (a >= 1) {
      outer[i] = 0;
      inner[i] = INF;
    } else if (a <= 0) {
      outer[i] = INF;
      inner[i] = 0;
    } else {
      const d = 0.5 - a;
      outer[i] = d > 0 ? d * d : 0;
      inner[i] = d < 0 ? d * d : 0;
    }
  }
  const size = Math.max(width, height);
  const f = new Float64Array(size);
  const v = new Uint16Array(size);
  const z = new Float64Array(size + 1);
  edt(outer, width, height, f, v, z);
  edt(inner, width, height, f, v, z);

  const out = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    const d = Math.sqrt(outer[i]!) - Math.sqrt(inner[i]!);
    const value = Math.round(255 - 255 * (d / radius + cutoff));
    const o = i * 4;
    out[o] = out[o + 1] = out[o + 2] = out[o + 3] = value; // clamped by the typed array
  }
  return out;
}

function edt(data: Float64Array, width: number, height: number, f: Float64Array, v: Uint16Array, z: Float64Array): void {
  for (let x = 0; x < width; x++) edt1d(data, x, width, height, f, v, z);
  for (let y = 0; y < height; y++) edt1d(data, y * width, 1, width, f, v, z);
}

function edt1d(grid: Float64Array, offset: number, stride: number, length: number, f: Float64Array, v: Uint16Array, z: Float64Array): void {
  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;
  f[0] = grid[offset]!;
  for (let q = 1, k = 0, s = 0; q < length; q++) {
    f[q] = grid[offset + q * stride]!;
    const q2 = q * q;
    do {
      const r = v[k]!;
      s = (f[q]! - f[r]! + q2 - r * r) / (q - r) / 2;
    } while (s <= z[k]! && --k > -1);
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }
  for (let q = 0, k = 0; q < length; q++) {
    while (z[k + 1]! < q) k++;
    const r = v[k]!;
    const qr = q - r;
    grid[offset + q * stride] = f[r]! + qr * qr;
  }
}

/**
 * Per-pixel coverage from a drawn silhouette: dark-on-transparent and
 * dark-on-white both work, since coverage = alpha × darkness.
 */
export function imageDataToCoverage(img: ImageData): Float32Array {
  const n = img.width * img.height;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const lum = (0.299 * img.data[o]! + 0.587 * img.data[o + 1]! + 0.114 * img.data[o + 2]!) / 255;
    out[i] = (img.data[o + 3]! / 255) * (1 - lum);
  }
  return out;
}

export interface SdfImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

/**
 * Load an icon file, draw it centred into a `size`×`size` canvas with a
 * margin for the distance falloff, and return SDF pixels ready for
 * `map.addImage(id, image, { sdf: true, pixelRatio })`.
 */
export async function loadSdfImage(url: string, size = 64, margin = SDF_RADIUS): Promise<SdfImage> {
  const img = await loadImage(url);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2d canvas unavailable");
  const inner = size - margin * 2;
  const scale = Math.min(inner / img.width, inner / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
  const coverage = imageDataToCoverage(ctx.getImageData(0, 0, size, size));
  return { width: size, height: size, data: coverageToSdf(coverage, size, size) };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}
