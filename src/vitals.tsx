"use client";

import { useEffect } from "react";
import { watchWebVitals } from "./web-vitals.js";

export { watchWebVitals };

/** Reports the page's web vitals as it is hidden. Its own import, so a site that doesn't want them doesn't carry the code. */
export function WebVitals(): null {
  useEffect(() => watchWebVitals(), []);
  return null;
}
