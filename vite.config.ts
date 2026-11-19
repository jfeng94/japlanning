import { execSync } from "node:child_process";
// vitest/config re-exports Vite's defineConfig with the `test` key typed.
import { defineConfig } from "vitest/config";

/**
 * The paths that make up the app shell (what the service worker precaches).
 * The build stamp follows the last commit to touch one of them, so a commit
 * that changes only data (data/*.csv, fetched by the loader, never
 * precached) or docs builds byte-for-byte the same shell: same worker
 * version, so installed apps download nothing new and show no Update toast
 * (2026-11-19; until then every deploy re-sent the whole ~1.5 MB shell).
 */
const SHELL_PATHS = ["src", "public", "index.html", "vite.config.ts", "package.json", "package-lock.json", "tsconfig.json"];

/** One field of the last commit that changed the shell (`%h` its short SHA, `%cI` its time), or undefined without git. */
function lastShellCommit(format: string): string | undefined {
  try {
    const out = execSync(`git log -1 --format=${format} -- ${SHELL_PATHS.join(" ")}`, { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
    return out || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Which build the page is, for Diagnostics: the short SHA of the last
 * commit that changed the shell. Needs the history (deploy.yml checks it
 * out whole); falls back to GITHUB_SHA (set in Actions) and then "dev".
 */
function buildSha(): string {
  return lastShellCommit("%h") ?? process.env.GITHUB_SHA?.slice(0, 7) ?? "dev";
}

/** When that commit was made: not the clock, which would make every build differ. */
function buildTime(): string {
  return lastShellCommit("%cI") ?? new Date().toISOString();
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
    __BUILD_TIME__: JSON.stringify(buildTime()),
  },
  test: {
    // Parser and loader tests are pure; no DOM needed.
    environment: "node",
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
  },
});
