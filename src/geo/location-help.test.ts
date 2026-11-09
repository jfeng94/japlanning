import { describe, expect, it } from "vitest";
import { isIOS, unblockLocationHint } from "./location-help.ts";

const IPHONE_SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0.7339.122 Mobile/15E148 Safari/604.1";
const IPAD = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15";
const ANDROID = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36";

describe("unblockLocationHint", () => {
  it("sends the installed iPhone app to Safari Websites, even when Chrome added it", () => {
    for (const userAgent of [IPHONE_SAFARI, IPHONE_CHROME]) {
      expect(unblockLocationHint({ userAgent, standalone: true })).toContain("Location Services → Safari Websites");
    }
  });

  it("sends a Chrome tab on the iPhone to Chrome's own entry, and a Safari tab to Safari Websites", () => {
    expect(unblockLocationHint({ userAgent: IPHONE_CHROME, standalone: false })).toContain("Location Services → Chrome");
    expect(unblockLocationHint({ userAgent: IPHONE_SAFARI, standalone: false })).toContain("Location Services → Safari Websites");
  });

  it("knows an iPad by its touch points, and leaves other devices to the browser's site settings", () => {
    expect(isIOS({ userAgent: IPAD, standalone: false, maxTouchPoints: 5 })).toBe(true);
    expect(isIOS({ userAgent: IPAD, standalone: false, maxTouchPoints: 0 })).toBe(false);
    expect(unblockLocationHint({ userAgent: ANDROID, standalone: true })).toBe("Allow location for this site in the browser's site settings.");
  });
});
