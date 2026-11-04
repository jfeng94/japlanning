import { execSync } from "node:child_process";
import { defineConfig } from "vite";

/**
 * Short git SHA of the commit being built, so the page can show which
 * deploy it is. Falls back to GITHUB_SHA (set in Actions) and then "dev".
 */
function buildSha(): string {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return process.env.GITHUB_SHA?.slice(0, 7) ?? "dev";
  }
}

export default defineConfig({
  // The app is served from the root of the custom domain. On a GitHub Pages
  // project site without a custom domain this would need to be "/japlanning/".
  base: "/",
  define: {
    __BUILD_SHA__: JSON.stringify(buildSha()),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
});
