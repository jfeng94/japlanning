import type { LoadResult } from "../data/types.ts";
import { renderCapabilities } from "../capabilities.ts";
import { renderDataStatus } from "./data-status.ts";

export interface Diagnostics {
  /** Re-render the data rows from the latest results. */
  update(results: LoadResult[], loading: boolean): void;
}

/** The M1 data status and M0 capability panel, behind the ⓘ button. */
export function mountDiagnostics(body: HTMLElement, onRefresh: () => void): Diagnostics {
  body.innerHTML = `
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
  const refresh = body.querySelector<HTMLButtonElement>(".refresh")!;
  refresh.addEventListener("click", onRefresh);
  void renderCapabilities(body.querySelector<HTMLDListElement>("#cap-list")!);

  return {
    update(results, loading) {
      refresh.disabled = loading;
      renderDataStatus(list, results, loading);
    },
  };
}
