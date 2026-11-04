import { describe, expect, it } from "vitest";
import { createStore } from "./store.ts";

type A = { type: "inc" } | { type: "noop" };
const reducer = (n: number, a: A) => (a.type === "inc" ? n + 1 : n);

describe("createStore", () => {
  it("holds state and notifies on change", () => {
    const store = createStore(0, reducer);
    const seen: number[] = [];
    store.subscribe((s) => seen.push(s));
    store.dispatch({ type: "inc" });
    store.dispatch({ type: "inc" });
    expect(store.get()).toBe(2);
    expect(seen).toEqual([1, 2]);
  });

  it("skips listeners when the reducer returns the same state", () => {
    const store = createStore(0, reducer);
    let calls = 0;
    store.subscribe(() => calls++);
    store.dispatch({ type: "noop" });
    expect(calls).toBe(0);
  });

  it("unsubscribe stops notifications, even mid-notify", () => {
    const store = createStore(0, reducer);
    let a = 0;
    let b = 0;
    const offA = store.subscribe(() => {
      a++;
      offA();
    });
    store.subscribe(() => b++);
    store.dispatch({ type: "inc" });
    store.dispatch({ type: "inc" });
    expect(a).toBe(1);
    expect(b).toBe(2);
  });
});
