/**
 * Custom events from the server: a payment taken, an import finished. There's no visitor behind
 * them, so nothing about one is sent.
 */
import { serverEndpoint, serverSiteKey } from "./env.js";
import type { EventData } from "./types.js";
import { DEFAULT_ENDPOINT, eventData, eventName } from "./wire.js";

export type { EventData };

export interface ServerTrackOptions {
  /** Defaults to `BORROMIC_ANALYTICS_KEY`, then `NEXT_PUBLIC_BORROMIC_ANALYTICS_KEY`. */
  siteKey?: string;
  /** Defaults to `BORROMIC_ANALYTICS_ENDPOINT`, then `NEXT_PUBLIC_BORROMIC_ANALYTICS_ENDPOINT`, then Borromic's collector. */
  endpoint?: string;
  /** How long to wait for the collector, in milliseconds. */
  timeoutMs?: number;
}

const WAIT_MS = 2_000;

/**
 * Records a custom event from a route handler or a server action. It answers whether the collector
 * kept it, and never throws: an event isn't worth failing a request over.
 */
export async function track(name: string, data?: EventData, options: ServerTrackOptions = {}): Promise<boolean> {
  const siteKey = options.siteKey?.trim() || serverSiteKey();
  const named = eventName(name);
  if (!siteKey || !named) return false;
  const kept = eventData(data);
  const event = { kind: "event", name: named, ...(kept ? { data: kept } : {}) };
  try {
    const response = await fetch(endpointOf(options), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ siteKey, server: true, events: [event] }),
      signal: AbortSignal.timeout(options.timeoutMs ?? WAIT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
}

const endpointOf = (options: ServerTrackOptions) => options.endpoint?.trim() || serverEndpoint() || DEFAULT_ENDPOINT;
