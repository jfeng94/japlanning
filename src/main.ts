import "./style.css";
import { renderCapabilities } from "./capabilities.ts";
import { mountDataStatus } from "./ui/data-status.ts";

const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("#app missing from index.html");

app.innerHTML = `
  <header class="masthead">
    <h1>Japlanning</h1>
    <p class="build">build <code>${__BUILD_SHA__}</code> · ${__BUILD_TIME__}</p>
  </header>
  <section class="data" aria-label="Data"></section>
  <section class="capabilities" aria-labelledby="cap-heading">
    <h2 id="cap-heading">Device capabilities</h2>
    <p class="hint">Open this inside the installed Home Screen app to check what it can do.</p>
    <dl id="cap-list"></dl>
  </section>
`;

mountDataStatus(app.querySelector<HTMLElement>(".data")!);

const list = app.querySelector<HTMLDListElement>("#cap-list");
if (list) void renderCapabilities(list);
