/**
 * Where to unblock location, for whichever way the app is running. On an
 * iPhone, a Home Screen app runs in Apple's web-app container, not in the
 * browser that added it, so Safari's settings decide, even for an app added
 * from Chrome. Either of two can refuse at once with no prompt, while the
 * same site in a Chrome tab (which asks as "Chrome") works:
 *
 * - Location Services → Safari Websites: on Never, every web app is refused.
 * - Safari → Location (Ask · Deny · Allow): on Ask, iOS can keep refusing a
 *   site after an earlier "Don't Allow", without asking again. Developers
 *   report the same stuck refusal on iOS 26 and 27 after location had been
 *   allowed. Allow skips it; that was the fix on Jerry's phone (2026-11-10).
 *
 * The refusal is kept outside the app's own data, so deleting and re-adding
 * the Home Screen app changes nothing, and navigator.permissions can still
 * say "prompt" while every request is refused.
 */
export interface Runtime {
  /** navigator.userAgent */
  userAgent: string;
  /** Running as an installed Home Screen app. */
  standalone: boolean;
  /** navigator.maxTouchPoints: iPads report a Mac user agent but have touch. */
  maxTouchPoints?: number;
}

const LOCATION_SERVICES = "Settings → Privacy & Security → Location Services";
const SAFARI_LOCATION = "Settings → Apps → Safari → Location";

export function isIOS({ userAgent, maxTouchPoints = 0 }: Runtime): boolean {
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

/** Where to allow location for this app: the settings to check, in order, then how to try again. */
export function unblockLocationSteps(rt: Runtime): string[] {
  if (!isIOS(rt)) return ["Allow location for this site in the browser's site settings, then reload the page."];
  if (!rt.standalone && /CriOS/.test(rt.userAgent)) return [`${LOCATION_SERVICES} → Chrome → While Using the App.`, "Reload the page."];
  return [
    `${LOCATION_SERVICES} → Safari Websites → While Using the App.${rt.standalone ? " The Home Screen app counts as Safari there, even when Chrome added it." : ""}`,
    `${SAFARI_LOCATION} → Allow. On Ask, the iPhone can keep refusing after an earlier "Don't Allow" without asking again.`,
    rt.standalone ? "Close the app fully (swipe it away in the app switcher) and open it again." : "Reload the page.",
  ];
}

/** This device, now. */
export function currentRuntime(): Runtime {
  const standalone = (window.matchMedia?.("(display-mode: standalone)").matches ?? false) || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return { userAgent: navigator.userAgent, standalone, maxTouchPoints: navigator.maxTouchPoints };
}
