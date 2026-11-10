import type { LoadResult } from "../data/types.ts";
import { renderCapabilities, type Capability } from "../capabilities.ts";
import { currentRuntime, isIOS, unblockLocationSteps } from "../geo/location-help.ts";
import { permissionState } from "../geo/locate.ts";
import { renderDataStatus } from "./data-status.ts";

export interface Diagnostics {
  /** Re-render the data rows from the latest results. */
  update(results: LoadResult[], loading: boolean): void;
  /** Re-probe the device (the storage estimate moves with every download), e.g. when the sheet opens. */
  refreshCapabilities(): void;
}

/** The M1 data status and M0 capability panel, behind the ⓘ button. */
export function mountDiagnostics(body: HTMLElement, onRefresh: () => void, extraCaps?: () => Promise<Capability[]>): Diagnostics {
  body.innerHTML = `
    <section class="diag-location">
      <div class="data-head">
        <h3>Location</h3>
        <button type="button" class="refresh location-test">Test location</button>
      </div>
      <p class="note location-state"></p>
      <p class="note location-result" role="status" hidden></p>
      <p class="note">If the locate button says location is blocked, check these in order:</p>
      <ol class="note location-steps"></ol>
    </section>
    <section class="diag-data">
      <div class="data-head">
        <h3>Data</h3>
        <button type="button" class="refresh">Refresh</button>
      </div>
      <ul class="layer-list"></ul>
    </section>
    <section class="diag-caps">
      <h3>Device capabilities</h3>
      <dl id="cap-list"></dl>
    </section>
    <p class="build">build <code>${__BUILD_SHA__}</code> · ${__BUILD_TIME__}</p>
  `;
  const list = body.querySelector<HTMLElement>(".layer-list")!;
  // Scoped: Test location shares the .refresh look and comes first.
  const refresh = body.querySelector<HTMLButtonElement>(".diag-data .refresh")!;
  refresh.addEventListener("click", onRefresh);
  const caps = body.querySelector<HTMLDListElement>("#cap-list")!;
  void renderCapabilities(caps, extraCaps);

  // ---- location: what the browser reports, and a real attempt on demand ----
  const locationState = body.querySelector<HTMLElement>(".location-state")!;
  const locationResult = body.querySelector<HTMLElement>(".location-result")!;
  const locationTest = body.querySelector<HTMLButtonElement>(".location-test")!;
  const locationSteps = body.querySelector<HTMLOListElement>(".location-steps")!;
  const STATE_TEXT = { granted: "allowed", denied: "blocked", prompt: "not asked yet", unknown: "not reported by this browser" } as const;
  async function renderLocationState(): Promise<void> {
    const rt = currentRuntime();
    locationSteps.replaceChildren(...unblockLocationSteps(rt).map((step) => Object.assign(document.createElement("li"), { textContent: step })));
    const state = await permissionState();
    const doubt = isIOS(rt) ? " iPhones don't always report this correctly; Test location says for sure." : "";
    locationState.textContent = `Permission, as the browser reports it: ${STATE_TEXT[state]}.${doubt}`;
  }
  /**
   * One real request, which is also the permission prompt when there hasn't been one.
   * The permission state above can say "not asked yet" while iOS refuses outright,
   * so this is the check that settles it.
   */
  locationTest.addEventListener("click", () => {
    locationResult.hidden = false;
    if (!("geolocation" in navigator)) {
      locationResult.textContent = "This browser has no location API.";
      return;
    }
    locationTest.disabled = true;
    locationResult.textContent = "Asking the phone for a position…";
    const done = (text: string): void => {
      locationResult.textContent = text;
      locationTest.disabled = false;
      void renderLocationState();
    };
    navigator.geolocation.getCurrentPosition(
      (p) => done(`Working: a position within ±${Math.round(p.coords.accuracy)} m.`),
      (e) => {
        if (e.code === 1) done("Blocked by the phone (permission denied). Work through the steps below.");
        else if (e.code === 2) done("No position available. Location Services may be off for the whole phone, or there is no signal.");
        else done("Timed out after 15 seconds without a position. Try again, ideally outdoors.");
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  });
  void renderLocationState();

  return {
    update(results, loading) {
      refresh.disabled = loading;
      renderDataStatus(list, results, loading);
    },
    refreshCapabilities: () => {
      void renderCapabilities(caps, extraCaps);
      void renderLocationState();
    },
  };
}
