import { describe, expect, it, vi } from "vitest";
import { createWatch, permissionState, type GeolocationLike, type LocateError, type Position } from "./locate.ts";

/** A fake Geolocation API the test drives by hand. */
function fakeGeolocation() {
  let ok: ((p: GeolocationPosition) => void) | undefined;
  let err: ((e: GeolocationPositionError) => void) | undefined;
  const cleared: number[] = [];
  let nextId = 1;
  const geo: GeolocationLike = {
    watchPosition(onOk, onErr) {
      ok = onOk;
      err = onErr;
      return nextId++;
    },
    clearWatch(id) {
      cleared.push(id);
    },
  };
  return {
    geo,
    cleared,
    fix(lat: number, lng: number, accuracy = 20) {
      ok?.({ coords: { latitude: lat, longitude: lng, accuracy }, timestamp: 1_700_000_000_000 } as GeolocationPosition);
    },
    error(code: number) {
      err?.({ code, message: "" } as GeolocationPositionError);
    },
  };
}

function harness(geo: GeolocationLike | undefined) {
  const fixes: Position[] = [];
  const errors: LocateError[] = [];
  const watch = createWatch(() => geo, { onFix: (p) => fixes.push(p), onError: (k) => errors.push(k) });
  return { watch, fixes, errors };
}

describe("createWatch", () => {
  it("translates fixes and is idempotent on start", () => {
    const fake = fakeGeolocation();
    const { watch, fixes } = harness(fake.geo);
    watch.start();
    watch.start();
    expect(watch.active).toBe(true);
    fake.fix(35.69, 139.76, 12);
    expect(fixes).toEqual([{ lat: 35.69, lng: 139.76, accuracy: 12, at: 1_700_000_000_000 }]);
    watch.stop();
    expect(watch.active).toBe(false);
    expect(fake.cleared).toEqual([1]);
  });

  it("stops on denied, keeps watching on unavailable", () => {
    const fake = fakeGeolocation();
    const { watch, errors } = harness(fake.geo);
    watch.start();
    fake.error(2);
    expect(watch.active).toBe(true);
    fake.error(1);
    expect(watch.active).toBe(false);
    expect(errors).toEqual(["unavailable", "denied"]);
  });

  it("reports a timeout once per start and never after a fix", () => {
    const fake = fakeGeolocation();
    const { watch, errors } = harness(fake.geo);
    watch.start();
    fake.error(3);
    fake.error(3);
    expect(errors).toEqual(["timeout"]);
    fake.fix(35.69, 139.76);
    fake.error(3);
    expect(errors).toEqual(["timeout"]);
    watch.stop();
    watch.start();
    fake.error(3);
    expect(errors).toEqual(["timeout", "timeout"]);
  });

  it("reports unavailable when the API is missing", () => {
    const { watch, errors } = harness(undefined);
    watch.start();
    expect(watch.active).toBe(false);
    expect(errors).toEqual(["unavailable"]);
  });
});

describe("permissionState", () => {
  it("passes the browser's answer through and degrades to unknown", async () => {
    const query = vi.fn().mockResolvedValue({ state: "granted" });
    expect(await permissionState({ query } as unknown as Permissions)).toBe("granted");
    expect(query).toHaveBeenCalledWith({ name: "geolocation" });
    expect(await permissionState(undefined)).toBe("unknown");
    const throwing = { query: () => Promise.reject(new TypeError("no geolocation")) } as unknown as Permissions;
    expect(await permissionState(throwing)).toBe("unknown");
  });
});
