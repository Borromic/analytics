/** What a custom event may carry: flat values only, so nothing nested can hide a person's details. */
export type EventData = Record<string, string | number | boolean | null>;

/** The three things a page reports. */
export type EventKind = "pageview" | "event" | "vital";

/** One thing that happened on the page, as `beforeSend` sees it and may change it. */
export interface AnalyticsEvent {
  kind: EventKind;
  /** The page's path, with its query reduced to `utm_*` tags. */
  path: string;
  /** The site the visitor came from, as a host: only on the first page view of a visit to the page. */
  referrer?: string;
  /** A custom event's or a web vital's name. */
  name?: string;
  data?: EventData;
  /** A web vital's measure: milliseconds, or a score for CLS. */
  value?: number;
}

/** Changes an event before it leaves the browser, or drops it with `null`. */
export type BeforeSend = (event: AnalyticsEvent) => AnalyticsEvent | null;

export interface AnalyticsOptions {
  /** The website's key, from its page in Borromic. Defaults to `NEXT_PUBLIC_BORROMIC_ANALYTICS_KEY`. */
  siteKey?: string;
  /** Where events go. Defaults to `NEXT_PUBLIC_BORROMIC_ANALYTICS_ENDPOINT`, then Borromic's collector. */
  endpoint?: string;
  /** Sends nothing when the browser says Do Not Track or Global Privacy Control. On by default. */
  respectDoNotTrack?: boolean;
  beforeSend?: BeforeSend;
  /** Logs to the console what is sent, and why nothing is. */
  debug?: boolean;
}
