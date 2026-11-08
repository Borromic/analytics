/**
 * The plain-script build, for a site with no bundler:
 * `<script defer src=".../dist/script.js" data-site-key="…"></script>`. Its settings are the tag's
 * data attributes, and `window.borromicAnalytics` records events.
 */
import { isOptedOut, optIn, optOut } from "./privacy.js";
import { inject, track } from "./tracker.js";
import { watchWebVitals } from "./web-vitals.js";

declare global {
  interface Window {
    borromicAnalytics?: {
      track: typeof track;
      optOut: typeof optOut;
      optIn: typeof optIn;
      isOptedOut: typeof isOptedOut;
    };
  }
}

const settings = (document.currentScript as HTMLScriptElement | null)?.dataset ?? {};

window.borromicAnalytics = { track, optOut, optIn, isOptedOut };
inject({
  siteKey: settings.siteKey,
  endpoint: settings.endpoint,
  respectDoNotTrack: settings.respectDoNotTrack !== "false",
  debug: settings.debug !== undefined,
});
if (settings.webVitals !== undefined) watchWebVitals();
