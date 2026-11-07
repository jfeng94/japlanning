import { describe, expect, it } from "vitest";
import { isPassThrough, precacheList } from "./precache.ts";

describe("precacheList", () => {
  it("keeps the shell, mirrored assets and icons; drops data, basemaps, maps, sidecars and the worker itself", () => {
    const files = [
      "index.html",
      "assets/index-abc.js",
      "assets/index-abc.js.map",
      "assets/index-def.css",
      "icons/icon-192.png",
      "manifest.webmanifest",
      "fonts/Noto Sans Regular/0-255.pbf",
      "sprites/light.json",
      "data/drinks.csv",
      "basemap/tokyo.pmtiles",
      "basemap/tokyo.pmtiles.json",
      "sw.js",
      "CNAME",
    ];
    expect(precacheList(files)).toEqual([
      "/",
      "/assets/index-abc.js",
      "/assets/index-def.css",
      "/fonts/Noto Sans Regular/0-255.pbf",
      "/icons/icon-192.png",
      "/index.html",
      "/manifest.webmanifest",
      "/sprites/light.json",
    ]);
  });

  it("accepts Windows separators and leading slashes", () => {
    expect(precacheList(["assets\\a.js", "/icons/b.png"])).toEqual(["/assets/a.js", "/icons/b.png"]);
  });
});

describe("isPassThrough", () => {
  it("names the data and basemap paths", () => {
    expect(isPassThrough("/data/drinks.csv")).toBe(true);
    expect(isPassThrough("/basemap/kyoto.pmtiles")).toBe(true);
    expect(isPassThrough("/assets/x.js")).toBe(false);
    expect(isPassThrough("/")).toBe(false);
  });
});
