import { execSync } from "node:child_process";
// vitest/config re-exports Vite's defineConfig with the `test` key typed.
import { defineConfig } from "vitest/config";

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
  // Serve MapLibre from node_modules in dev rather than a pre-bundled copy, so
  // its worker and shared chunk resolve next to each other.
  optimizeDeps: { exclude: ["maplibre-gl"] },
  define: {
    __BUILD_SHA__: JSON.stringify(buildSha()),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  test: {
    // Parser and loader tests are pure; no DOM needed.
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
