import "./style.css";
import { mountApp } from "./ui/app.ts";

const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("#app missing from index.html");

mountApp(app);
