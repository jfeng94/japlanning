import { describe, expect, it } from "vitest";
import { createBookmarks, createMemoryBookmarkStorage } from "./bookmarks.ts";

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("bookmarks", () => {
  it("loads the stored set and reports ready", async () => {
    const b = createBookmarks(createMemoryBookmarkStorage(["a", "b"]));
    expect(b.size).toBe(0); // not loaded yet
    await b.ready;
    expect(b.size).toBe(2);
    expect(b.has("a")).toBe(true);
    expect([...b.all()]).toEqual(["a", "b"]);
  });

  it("toggle adds, toggles again removes, and saves through in order", async () => {
    const storage = createMemoryBookmarkStorage();
    const b = createBookmarks(storage);
    await b.ready;
    b.toggle("x");
    b.toggle("y");
    b.toggle("x");
    expect([...b.all()]).toEqual(["y"]);
    await tick();
    expect(await storage.load()).toEqual(["y"]);
  });

  it("notifies subscribers on load and on every toggle; unsubscribe stops it", async () => {
    const b = createBookmarks(createMemoryBookmarkStorage(["a"]));
    let calls = 0;
    const off = b.subscribe(() => calls++);
    await b.ready;
    expect(calls).toBe(1);
    b.toggle("b");
    expect(calls).toBe(2);
    off();
    b.toggle("c");
    expect(calls).toBe(2);
  });

  it("ignores junk in storage", async () => {
    const storage = { load: async () => [1, "ok", null] as unknown as string[], save: async () => {} };
    const b = createBookmarks({ load: async () => (await storage.load()).filter((x) => typeof x === "string"), save: storage.save });
    await b.ready;
    expect([...b.all()]).toEqual(["ok"]);
  });

  it("a failing save does not break the in-memory state", async () => {
    const b = createBookmarks({ load: async () => [], save: async () => { throw new Error("quota"); } });
    await b.ready;
    b.toggle("x");
    await tick();
    expect(b.has("x")).toBe(true);
  });
});
