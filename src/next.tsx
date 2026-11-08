"use client";

/**
 * For Next.js, App Router and Pages Router alike: both move with the history API, which the
 * component listens to, and both inline `NEXT_PUBLIC_BORROMIC_ANALYTICS_KEY` into the page.
 */
export { Analytics, type AnalyticsProps } from "./react.js";
export type { AnalyticsEvent, BeforeSend, EventData } from "./types.js";
