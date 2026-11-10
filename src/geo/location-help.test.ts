import { describe, expect, it } from "vitest";
import { isIOS, unblockLocationSteps } from "./location-help.ts";

const IPHONE_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0.7339.122 Mobile/15E148 Safari/604.1";
const IPAD = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15";
const ANDROID = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36";

describe("unblockLocationSteps", () => {
  it("takes the installed iPhone app through both Safari settings, even when Chrome added it, then a relaunch", () => {
    for (const userAgent of [IPHONE_SAFARI, IPHONE_CHROME]) {
      const steps = unblockLocationSteps({ userAgent, standalone: true });
      expect(steps).toHaveLength(3);
      expect(steps[0]).toContain("Location Services → Safari Websites → While Using the App");
      expect(steps[0]).toContain("even when Chrome added it");
      expect(steps[1]).toContain("Settings → Apps → Safari → Location → Allow");
      expect(steps[2]).toContain("Close the app fully");
    }
  });

  it("sends a Chrome tab on the iPhone to Chrome's own entry, and a Safari tab through both Safari settings", () => {
    expect(unblockLocationSteps({ userAgent: IPHONE_CHROME, standalone: false })).toEqual([
      "Settings → Privacy & Security → Location Services → Chrome → While Using the App.",
      "Reload the page.",
    ]);
    const safari = unblockLocationSteps({ userAgent: IPHONE_SAFARI, standalone: false });
    expect(safari[0]).toContain("Location Services → Safari Websites");
    expect(safari[0]).not.toContain("Home Screen");
    expect(safari[1]).toContain("Safari → Location → Allow");
    expect(safari[2]).toBe("Reload the page.");
  });

  it("knows an iPad by its touch points, and leaves other devices to the browser's site settings", () => {
    expect(isIOS({ userAgent: IPAD, standalone: false, maxTouchPoints: 5 })).toBe(true);
    expect(isIOS({ userAgent: IPAD, standalone: false, maxTouchPoints: 0 })).toBe(false);
    expect(unblockLocationSteps({ userAgent: ANDROID, standalone: true })).toEqual([
      "Allow location for this site in the browser's site settings, then reload the page.",
    ]);
  });
});
