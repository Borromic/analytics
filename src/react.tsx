"use client";

import { useEffect, useRef } from "react";
import { inject } from "./tracker.js";
import type { AnalyticsEvent, AnalyticsOptions } from "./types.js";

export type { AnalyticsEvent, BeforeSend, EventData } from "./types.js";

export type AnalyticsProps = AnalyticsOptions;

/**
 * Put once, in the root layout or app. It renders nothing and waits for nothing: the page paints
 * the same whether the collector answers or not.
 */
export function Analytics({ siteKey, endpoint, respectDoNotTrack, beforeSend, debug }: AnalyticsProps): null {
  // Kept current without restarting: a `beforeSend` written inline is a new function on every render.
  const latestBeforeSend = useRef(beforeSend);
  useEffect(() => {
    latestBeforeSend.current = beforeSend;
  }, [beforeSend]);
  useEffect(
    () =>
      inject({
        siteKey,
        endpoint,
        respectDoNotTrack,
        debug,
        beforeSend: (event: AnalyticsEvent) => (latestBeforeSend.current ? latestBeforeSend.current(event) : event),
      }),
    [siteKey, endpoint, respectDoNotTrack, debug],
  );
  return null;
}
