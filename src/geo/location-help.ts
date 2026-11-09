/**
 * Where to unblock location, for whichever way the app is running. The
 * case that bites: on an iPhone, a Home Screen app runs in Apple's web-app
 * container, not in the browser that added it, so iOS asks the "Safari
 * Websites" entry in Location Services, even for an app added from Chrome.
 * With that entry on Never, every web app is refused at once and no prompt
 * ever shows, while the same site in a Chrome tab (which asks as "Chrome")
 * works. Deleting and re-adding the Home Screen app doesn't change it.
 */
export interface Runtime {
  /** navigator.userAgent */
  userAgent: string;
  /** Running as an installed Home Screen app. */
  standalone: boolean;
  /** navigator.maxTouchPoints: iPads report a Mac user agent but have touch. */
  maxTouchPoints?: number;
}

const SETTINGS = "Settings → Privacy & Security → Location Services";

export function isIOS({ userAgent, maxTouchPoints = 0 }: Runtime): boolean {
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

/** One sentence saying where location is allowed for this app, in the order to check. */
export function unblockLocationHint(rt: Runtime): string {
  if (!isIOS(rt)) return "Allow location for this site in the browser's site settings.";
  if (rt.standalone) {
    return `On the iPhone: ${SETTINGS} → Safari Websites → While Using the App. The Home Screen app counts as Safari there, even when Chrome added it.`;
  }
  if (/CriOS/.test(rt.userAgent)) return `On the iPhone: ${SETTINGS} → Chrome → While Using the App.`;
  return `On the iPhone: ${SETTINGS} → Safari Websites → While Using the App.`;
}

/** This device, now. */
export function currentRuntime(): Runtime {
  const standalone = (window.matchMedia?.("(display-mode: standalone)").matches ?? false) || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return { userAgent: navigator.userAgent, standalone, maxTouchPoints: navigator.maxTouchPoints };
}
