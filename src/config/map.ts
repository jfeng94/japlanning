/** Map rendering choices. The user-adjustable ones live in settings.ts. */

import { settings } from "./settings.ts";

export type { PinRendererKind, PinStyle } from "./settings.ts";

export function pinRendererKind() {
  return settings().pinRenderer;
}

export function pinStyle() {
  return settings().pinStyle;
}

export function pinLabelMinZoom(): number {
  return settings().pinLabelMinZoom;
}
