import type { AnalyticsEvent, EventData } from "./types.js";

/** Borromic's collector, when neither the options nor the environment name another. */
export const DEFAULT_ENDPOINT = "https://app.borromic.com/api/e";

/** What the collector takes in one request: more is split, never refused. */
export const MAX_EVENTS_PER_REQUEST = 20;
export const MAX_BODY_BYTES = 16 * 1024;

const MAX_NAME_LENGTH = 100;
const MAX_DATA_KEYS = 20;
const MAX_KEY_LENGTH = 50;
const MAX_TEXT_LENGTH = 200;

/** An event as it travels: how long ago it happened instead of when, since a visitor's clock can't be trusted. */
export interface WireEvent extends Partial<AnalyticsEvent> {
  kind: AnalyticsEvent["kind"];
  ago?: number;
}

/** An event's name as the collector keeps it, or null when there's none to keep. */
export function eventName(name: unknown): string | null {
  if (typeof name !== "string") return null;
  const trimmed = name.trim().slice(0, MAX_NAME_LENGTH);
  return trimmed || null;
}

/** The data within the collector's limits: values that aren't flat are dropped, long ones cut. */
export function eventData(data: unknown): EventData | undefined {
  if (!data || typeof data !== "object") return undefined;
  const kept: EventData = {};
  for (const [key, value] of Object.entries(data).slice(0, MAX_DATA_KEYS)) {
    const flat = flatValue(value);
    if (flat !== undefined) kept[key.slice(0, MAX_KEY_LENGTH)] = flat;
  }
  return Object.keys(kept).length > 0 ? kept : undefined;
}

function flatValue(value: unknown): EventData[string] | undefined {
  if (typeof value === "string") return value.slice(0, MAX_TEXT_LENGTH);
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "boolean" || value === null) return value;
  return undefined;
}

const byteLength = (text: string) => new TextEncoder().encode(text).length;

/** One request's body, written by hand so each event is serialized once. */
const bodyOf = (siteKey: string, events: readonly string[]) =>
  `{"siteKey":${JSON.stringify(siteKey)},"events":[${events.join(",")}]}`;

/**
 * The bodies that carry these events, each within the collector's limits. An event too large to go
 * alone can't be sent at all, so it is left out rather than refused with the others.
 */
export function requestBodies(siteKey: string, events: readonly WireEvent[]): string[] {
  const bodies: string[] = [];
  const emptyBytes = byteLength(bodyOf(siteKey, []));
  let batch: string[] = [];
  let batchBytes = emptyBytes;
  for (const event of events) {
    const text = JSON.stringify(event);
    const bytes = byteLength(text) + 1;
    if (emptyBytes + bytes > MAX_BODY_BYTES) continue;
    if (batch.length === MAX_EVENTS_PER_REQUEST || batchBytes + bytes > MAX_BODY_BYTES) {
      bodies.push(bodyOf(siteKey, batch));
      batch = [];
      batchBytes = emptyBytes;
    }
    batch.push(text);
    batchBytes += bytes;
  }
  if (batch.length > 0) bodies.push(bodyOf(siteKey, batch));
  return bodies;
}
