/**
 * What runs in the browser: page views and events go into a small queue, which leaves in batches.
 * Nothing here may disturb the page, so every entry point swallows its own failures, and nothing is
 * written in the browser at all.
 */
import { cleanPath } from "./clean-path.js";
import { publicEndpoint, publicSiteKey } from "./env.js";
import { isOptedOut, onOptOutChange, saysDoNotTrack } from "./privacy.js";
import type { AnalyticsEvent, AnalyticsOptions, BeforeSend, EventData } from "./types.js";
import { DEFAULT_ENDPOINT, eventData, eventName, requestBodies, type WireEvent } from "./wire.js";

interface Settings {
  siteKey: string;
  endpoint: string;
  respectDoNotTrack: boolean;
  beforeSend: BeforeSend | undefined;
  debug: boolean;
}

interface Queued {
  event: AnalyticsEvent;
  at: number;
}

/** A batch leaves this long after its first event, so a page's first moments go as one request. */
const FLUSH_DELAY_MS = 2_000;
const FLUSH_AT_EVENTS = 10;
/** What is held before measuring starts: a page that never starts can't grow it without end. */
const LONGEST_QUEUE = 50;

const page = {
  settings: null as Settings | null,
  queue: [] as Queued[],
  timer: undefined as ReturnType<typeof setTimeout> | undefined,
  lastPath: undefined as string | undefined,
  referrerSent: false,
  /** Route changes count as page views. */
  counting: false,
  /** The history and page listeners are in place: once per page, whatever happens to the settings. */
  listening: false,
};

/**
 * Starts measuring this page and the next ones the site moves to. With no site key, from the
 * options or the environment, nothing happens. The answer stops counting route changes.
 */
export function inject(options: AnalyticsOptions = {}): () => void {
  if (typeof window === "undefined") return () => undefined;
  const settings = settingsOf(options);
  if (!settings) {
    if (options.debug) console.log("[@borromic/analytics] No site key: nothing is measured.");
    return () => undefined;
  }
  quietly(() => {
    page.settings = settings;
    listenToPage();
    page.counting = true;
    if (!mayMeasure()) page.queue = [];
    notePageview();
    if (page.queue.length > 0) scheduleFlush();
  });
  return () => {
    page.counting = false;
  };
}

/** Records a custom event. Flat values only: what names a person is the site's choice not to send. */
export function track(name: string, data?: EventData): void {
  quietly(() => {
    const named = eventName(name);
    if (!named) return;
    const kept = eventData(data);
    enqueue({ kind: "event", path: currentPath(), name: named, ...(kept ? { data: kept } : {}) });
  });
}

/** Records the page's web vitals and sends them at once: the page is going away. */
export function reportVitals(measures: readonly { name: string; value: number }[]): void {
  quietly(() => {
    for (const { name, value } of measures) enqueue({ kind: "vital", path: currentPath(), name, value });
    flush(true);
  });
}

/** Back to how a page starts, its listeners aside. For tests: a page has no use for it. */
export function forgetPage(): void {
  clearTimeout(page.timer);
  Object.assign(page, {
    settings: null,
    queue: [],
    timer: undefined,
    lastPath: undefined,
    referrerSent: false,
    counting: false,
  });
}

function settingsOf(options: AnalyticsOptions): Settings | null {
  const siteKey = options.siteKey?.trim() || publicSiteKey();
  if (!siteKey) return null;
  return {
    siteKey,
    endpoint: options.endpoint?.trim() || publicEndpoint() || DEFAULT_ENDPOINT,
    respectDoNotTrack: options.respectDoNotTrack ?? true,
    beforeSend: options.beforeSend,
    debug: options.debug ?? false,
  };
}

function quietly(work: () => void): void {
  try {
    work();
  } catch {
    // Measuring must never be why a page breaks.
  }
}

/** Whether this visitor may be measured: they didn't object, and their browser doesn't ask otherwise. */
function mayMeasure(): boolean {
  if (isOptedOut()) return false;
  return !((page.settings?.respectDoNotTrack ?? true) && saysDoNotTrack());
}

const currentPath = () => cleanPath(location.pathname, location.search);

function log(message: string, detail?: unknown): void {
  if (page.settings?.debug) console.log(`[@borromic/analytics] ${message}`, detail);
}

function enqueue(event: AnalyticsEvent): void {
  if (!mayMeasure()) return log("Not sent: the visitor opted out, or their browser asks not to be tracked.", event);
  page.queue.push({ event, at: Date.now() });
  if (page.queue.length > LONGEST_QUEUE) page.queue.shift();
  if (page.queue.length >= FLUSH_AT_EVENTS) flush();
  else scheduleFlush();
}

function scheduleFlush(): void {
  page.timer ??= setTimeout(() => quietly(() => flush()), FLUSH_DELAY_MS);
}

/** Counts a page when its cleaned path changes: a query dropped anyway, or a router replacing its own state, isn't a new page. */
function notePageview(): void {
  if (!page.counting) return;
  const path = currentPath();
  if (path === page.lastPath) return;
  page.lastPath = path;
  const referrer = page.referrerSent ? undefined : referrerHost();
  page.referrerSent = true;
  enqueue({ kind: "pageview", path, ...(referrer ? { referrer } : {}) });
}

/** The site the visitor came from, unless it's this one. */
function referrerHost(): string | undefined {
  if (!document.referrer) return undefined;
  try {
    const host = new URL(document.referrer).hostname.toLowerCase();
    return host && host !== location.hostname.toLowerCase() ? host : undefined;
  } catch {
    return undefined;
  }
}

/** Single-page apps move with the history API, which says nothing a library could hear unless it listens there. */
function listenToPage(): void {
  if (page.listening) return;
  page.listening = true;
  for (const method of ["pushState", "replaceState"] as const) {
    const original = history[method];
    history[method] = function navigated(this: History, ...args: Parameters<History["pushState"]>) {
      const result = original.apply(this, args);
      quietly(notePageview);
      return result;
    };
  }
  window.addEventListener("popstate", () => quietly(notePageview));
  window.addEventListener("pagehide", () => quietly(() => flush(true)));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") quietly(() => flush(true));
  });
  onOptOutChange(() => {
    if (isOptedOut()) page.queue = [];
  });
}

/** Sends what's waiting. As the page goes, only a beacon can be trusted to leave. */
function flush(pageIsHiding = false): void {
  clearTimeout(page.timer);
  page.timer = undefined;
  const { settings } = page;
  if (!settings || page.queue.length === 0) return;
  if (!mayMeasure()) {
    page.queue = [];
    return;
  }
  const now = Date.now();
  const events = page.queue.splice(0).flatMap(({ event, at }): WireEvent[] => {
    const kept = allowedBy(settings.beforeSend, event);
    return kept ? [{ ...kept, ago: Math.max(0, now - at) }] : [];
  });
  for (const body of requestBodies(settings.siteKey, events)) send(settings, body, pageIsHiding);
}

/** The event as the site's `beforeSend` leaves it. One that throws drops the event: when in doubt, send less. */
function allowedBy(beforeSend: BeforeSend | undefined, event: AnalyticsEvent): AnalyticsEvent | null {
  if (!beforeSend) return event;
  try {
    const kept = beforeSend(event);
    if (!kept) log("Dropped by beforeSend.", event);
    return kept ?? null;
  } catch {
    return null;
  }
}

/** Both go as plain text, which a browser posts to another site with no preflight request to pay for. */
function send({ endpoint, debug }: Settings, body: string, pageIsHiding: boolean): void {
  if (debug) log("Sending.", JSON.parse(body));
  if (pageIsHiding && navigator.sendBeacon?.(endpoint, body)) return;
  fetch(endpoint, { method: "POST", body, keepalive: true, credentials: "omit" }).catch(() => undefined);
}
