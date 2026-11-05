/**
 * The device's position, as a thin layer over the Geolocation API: a
 * start/stop watch with typed callbacks, and a permission query so the
 * app can start by itself only when the browser already holds a grant.
 * Nothing here prompts; a prompt only ever follows `start()`.
 */

/** A fix from the device, as the app keeps it. */
export interface Position {
  lat: number;
  lng: number;
  /** Radius in metres the device is confident about. */
  accuracy: number;
  /** When the fix was taken, epoch ms. */
  at: number;
}

/** Why no fix arrived: the Geolocation API's three error codes, named. */
export type LocateError = "denied" | "unavailable" | "timeout";

/** The slice of `navigator.geolocation` the watch uses; injected so tests can fake it. */
export interface GeolocationLike {
  watchPosition(
    ok: (p: GeolocationPosition) => void,
    err: (e: GeolocationPositionError) => void,
    options?: PositionOptions,
  ): number;
  clearWatch(id: number): void;
}

export interface WatchCallbacks {
  onFix(position: Position): void;
  /** Denied stops the watch; unavailable keeps it (the browser retries); timeout is reported once per start, before any fix. */
  onError(kind: LocateError): void;
}

export interface Watch {
  /** Begin watching; a no-op while already watching. The permission prompt, if any, comes here. */
  start(): void;
  stop(): void;
  readonly active: boolean;
}

const ERROR_KINDS: Record<number, LocateError> = { 1: "denied", 2: "unavailable", 3: "timeout" };

const DEFAULT_OPTIONS: PositionOptions = { enableHighAccuracy: true, timeout: 10_000 };

/**
 * `geolocation` is a getter so the API is read at `start()`, not at
 * construction (the browser pane's mocks, and any browser that exposes it
 * late).
 */
export function createWatch(
  geolocation: () => GeolocationLike | undefined,
  callbacks: WatchCallbacks,
  options: PositionOptions = DEFAULT_OPTIONS,
): Watch {
  let id: number | undefined;
  let geo: GeolocationLike | undefined;
  let hadFix = false;
  let timeoutReported = false;

  const stop = (): void => {
    if (id !== undefined && geo) geo.clearWatch(id);
    id = undefined;
    geo = undefined;
  };

  return {
    get active() {
      return id !== undefined;
    },
    start() {
      if (id !== undefined) return;
      geo = geolocation();
      if (!geo) {
        callbacks.onError("unavailable");
        return;
      }
      hadFix = false;
      timeoutReported = false;
      id = geo.watchPosition(
        (p) => {
          hadFix = true;
          const { latitude: lat, longitude: lng, accuracy } = p.coords;
          callbacks.onFix({ lat, lng, accuracy, at: p.timestamp });
        },
        (e) => {
          const kind = ERROR_KINDS[e.code] ?? "unavailable";
          if (kind === "denied") stop();
          if (kind === "timeout") {
            // watchPosition times out every attempt; one toast is enough, and none after a fix.
            if (hadFix || timeoutReported) return;
            timeoutReported = true;
          }
          callbacks.onError(kind);
        },
        options,
      );
    },
    stop,
  };
}

export type PermissionState = "granted" | "denied" | "prompt" | "unknown";

/** What the browser already knows about the geolocation permission; "unknown" where the Permissions API is missing. */
export async function permissionState(permissions: Permissions | undefined = navigator.permissions): Promise<PermissionState> {
  try {
    if (!permissions) return "unknown";
    const status = await permissions.query({ name: "geolocation" });
    return status.state;
  } catch {
    return "unknown";
  }
}
